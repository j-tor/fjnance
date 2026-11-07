import {randomUUID} from 'node:crypto';
import {parseAmount, validDate, localDate, METHODS, CATEGORIES} from '../../shared/finance.js';
import {carteraInicial, resumirCartera, SIN_DISTRIBUIR, MEDIOS_PAGO, calcularPlan} from '../../shared/cuentas-ahorros.js';
const fallo = (m, status = 400) => Object.assign(new Error(m), {status});
function texto(v, nombre, max = 80, opcional = false) {if (typeof v !== 'string' || v.length > max || (!opcional && !v.trim())) throw fallo(`${nombre} inválido.`); return v.trim();}
function monto(v, cero = false) {const n = typeof v === 'string' ? ((cero && /^0(?:[.,]0{1,2})?$/.test(v.trim())) ? 0 : parseAmount(v)) : null; if (n === null) throw fallo('Monto inválido. Usa hasta dos decimales.'); return n;}
function fecha(v) {if (typeof v !== 'string' || !validDate(v) || v > localDate()) throw fallo('Fecha inválida o futura.'); return v;}
function cartera(s) {s.cartera ||= carteraInicial(); return s.cartera;}
function encontrar(lista, id, nombre) {const e = lista.find(e => e.id === id); if (!e) throw fallo(`${nombre} no encontrado.`, 404); return e;}
function cuenta(s, id, activa = true) {const e = encontrar(resumirCartera(s).cuentas, id, 'Origen de fondos'); if (activa && !e.activo) throw fallo('La cuenta está archivada.'); return e;}
function tarjeta(s, id, activa = true) {const e = encontrar(cartera(s).tarjetas, id, 'Tarjeta'); if (activa && !e.activo) throw fallo('La tarjeta está archivada.'); return e;}
function sinDatosSensibles(v) {if (['numero', 'number', 'pan', 'cvv', 'cvc', 'pin', 'password'].some(k => Object.hasOwn(v, k))) throw fallo('Registra solo alias y últimos cuatro dígitos, sin datos completos de tarjeta.');}
export function validarSaldos(s, anterior = s) {
  const antes = resumirCartera(anterior); const despues = resumirCartera(s);
  for (const a of despues.cuentas) {
    const previo = antes.cuentas.find(v => v.id === a.id)?.disponible || 0;
    if (a.reservado < 0 || (a.disponible < 0 && a.disponible < Math.min(0, previo))) throw fallo('Saldo disponible insuficiente. Retira reservas o registra fondos antes de gastar.');
  }
  for (const t of despues.tarjetas) if (t.tipo === 'credito' && (t.deuda < 0 || (t.limite !== null && t.deuda > t.limite))) throw fallo('La operación supera el límite o el saldo de deuda de la tarjeta.');
}
export function guardarCuenta(s, entrada, id) {
  if (entrada.origen && !['nuevo', 'sin-distribuir'].includes(entrada.origen)) throw fallo('Origen de saldo inválido.');
  const c = cartera(s); const anterior = id ? encontrar(c.cuentas, id, 'Cuenta') : null;
  const tipo = entrada.tipo; if (!['efectivo', 'corriente', 'ahorro'].includes(tipo)) throw fallo('Tipo de cuenta inválido.');
  if (anterior && tipo !== anterior.tipo) throw fallo('El tipo de una cuenta existente no se cambia; crea otra cuenta.');
  const v = {id: anterior?.id || randomUUID(), alias: texto(entrada.alias, 'Alias'), banco: tipo === 'efectivo' ? '' : texto(entrada.banco, 'Banco'), tipo, activo: anterior?.activo ?? true};
  if (anterior) Object.assign(anterior, v); else {
    c.cuentas.push(v); const saldo = monto(entrada.saldo || '0', true);
    if (saldo > 0) {try {registrarOperacion(s, {tipo: entrada.origen === 'sin-distribuir' ? 'transferencia' : 'aporte', origenId: entrada.origen === 'sin-distribuir' ? SIN_DISTRIBUIR : null, destinoId: v.id, monto: entrada.saldo, fecha: localDate(), descripcion: 'Saldo de apertura'});} catch(error){c.cuentas.pop();throw error;}}
  }
  return v;
}
export function archivarCuenta(s, id, activa = false) {
  const c = cartera(s); const e = encontrar(c.cuentas, id, 'Cuenta'); const saldo = cuenta(s, id, false);
  if (!activa && (saldo.saldo !== 0 || saldo.reservado !== 0 || c.tarjetas.some(t => t.activo && t.cuentaId === id))) throw fallo('Deja la cuenta sin saldo/reservas y archiva sus tarjetas de débito antes de archivarla.');
  e.activo = activa;
}
export function guardarTarjeta(s, entrada, id) {
  sinDatosSensibles(entrada); const c = cartera(s); const anterior = id ? encontrar(c.tarjetas, id, 'Tarjeta') : null;
  if (!['debito', 'credito'].includes(entrada.tipo)) throw fallo('Tipo de tarjeta inválido.');
  if (anterior && entrada.tipo !== anterior.tipo) throw fallo('El tipo de tarjeta no se cambia; archiva y crea otra.');
  const ultimos4 = entrada.ultimos4 ?? anterior?.ultimos4 ?? ''; if (!/^\d{4}$/.test(ultimos4) && ultimos4 !== '') throw fallo('Usa solo los últimos cuatro dígitos.');
  let cuentaId = null; let banco;
  if (entrada.tipo === 'debito') {const a = cuenta(s, entrada.cuentaId); if (!['corriente', 'ahorro'].includes(a.tipo)) throw fallo('Débito requiere una cuenta bancaria propia.'); cuentaId = a.id; banco = a.banco;}
  else banco = texto(entrada.banco, 'Banco');
  // Cambiar la cuenta de débito solo afecta gastos futuros; cada gasto guarda su cuenta.
  const v = {id: anterior?.id || randomUUID(), alias: texto(entrada.alias, 'Alias'), tipo: entrada.tipo, banco, cuentaId, ultimos4, activo: anterior?.activo ?? true,
    deudaInicial: anterior?.deudaInicial ?? (entrada.tipo === 'credito' ? monto(entrada.deudaInicial || '0', true) : 0),
    limite: entrada.tipo === 'credito' && entrada.limite ? monto(entrada.limite) : null};
  const deudaActual = anterior ? resumirCartera(s).tarjetas.find(t=>t.id===anterior.id).deuda : v.deudaInicial;
  if(v.tipo==='credito'&&v.limite!==null&&deudaActual>v.limite)throw fallo('El límite no puede ser menor que la deuda actual.');
  if (anterior) Object.assign(anterior, v); else c.tarjetas.push(v);
  validarSaldos(s); return v;
}
export function archivarTarjeta(s, id, activa = false) {tarjeta(s, id, false).activo = activa;}
export function asignarOrigen(s, gasto, entrada, anterior) {
  if (Object.hasOwn(entrada, 'medio') && !MEDIOS_PAGO.includes(entrada.medio)) throw fallo('Medio de pago inválido.');
  const medio = entrada.medio ?? anterior?.medio;
  if (!medio) {if (!anterior && s.cartera && (s.cartera.cuentas.length || s.cartera.tarjetas.length)) throw fallo('Selecciona efectivo, débito o crédito y su origen.'); return gasto;}
  if (!MEDIOS_PAGO.includes(medio)) throw fallo('Medio de pago inválido.');
  gasto.medio = medio; gasto.cuentaId = null; gasto.tarjetaId = null;
  if (medio === 'efectivo') {const id = entrada.cuentaId ?? anterior?.cuentaId; const a = cuenta(s, id, id !== anterior?.cuentaId); if (a.tipo !== 'efectivo') throw fallo('Selecciona una cuenta de efectivo.'); gasto.cuentaId = a.id;}
  else {
    const id = entrada.tarjetaId ?? anterior?.tarjetaId; const t = tarjeta(s, id, id !== anterior?.tarjetaId);
    if (t.tipo !== medio) throw fallo('La tarjeta no corresponde al medio seleccionado.');
    gasto.tarjetaId = t.id;
    if (medio === 'debito') {const origen = anterior?.tarjetaId === t.id ? anterior.cuentaId : t.cuentaId; cuenta(s, origen, origen !== anterior?.cuentaId); gasto.cuentaId = origen;}
  }
  gasto.method = medio === 'credito' ? METHODS[1] : METHODS[0]; return gasto;
}
export function registrarOperacion(s, entrada) {
  const c = cartera(s); const tipo = entrada.tipo; if (!['aporte', 'retiro', 'transferencia', 'pago_credito'].includes(tipo)) throw fallo('Operación inválida.');
  const valor = monto(entrada.monto); const antes = structuredClone(s);
  const o = {id: randomUUID(), tipo, monto: valor, fecha: fecha(entrada.fecha), descripcion: texto(entrada.descripcion || '', 'Descripción', 160, true), origenId: null, destinoId: null, tarjetaId: null};
  if (tipo !== 'aporte') {const a = cuenta(s, entrada.origenId, false); if (a.disponible < valor) throw fallo('Saldo disponible insuficiente en la cuenta de origen.'); o.origenId = a.id;}
  if (tipo === 'aporte' || tipo === 'transferencia') {o.destinoId = cuenta(s, entrada.destinoId).id; if (o.destinoId === o.origenId) throw fallo('Origen y destino deben ser diferentes.');}
  if (tipo === 'pago_credito') {const t = tarjeta(s, entrada.tarjetaId, false); if (t.tipo !== 'credito') throw fallo('El pago requiere tarjeta de crédito.'); if(resumirCartera(s).tarjetas.find(v=>v.id===t.id).deuda<valor)throw fallo('No puedes pagar más que la deuda registrada.'); o.tarjetaId = t.id;}
  c.operaciones.push(o); validarSaldos(s, antes); return o;
}
export function anularOperacion(s, id) {
  const o = encontrar(cartera(s).operaciones, id, 'Operación');
  if (o.anulada) throw fallo('La operación ya está anulada.');
  const antes = structuredClone(s); o.anulada = true; o.anulacionFecha = localDate();
  try {validarSaldos(s, antes);} catch(error){delete o.anulada;delete o.anulacionFecha;throw error;}
}
export function guardarMeta(s, entrada, id) {
  const c = cartera(s); const anterior = id ? encontrar(c.metas, id, 'Objetivo') : null;
  const unidad=entrada.unidad??'meses';const modo=entrada.modo??'manual';if(!['meses','semanas'].includes(unidad)||!['plazo','aporte','manual'].includes(modo))throw fallo('Unidad o cálculo de ahorro inválido.');
  if (!Number.isInteger(entrada.meses) || entrada.meses < 1 || entrada.meses > (unidad==='semanas'?2600:600)) throw fallo('El plazo debe ser de 1 a 600 meses.');
  const v = {id: anterior?.id || randomUUID(), nombre: texto(entrada.nombre, 'Nombre'), objetivo: monto(entrada.objetivo), meses: entrada.meses, inicio: fecha(entrada.inicio), mensual: monto(entrada.mensual || '0', true), activo: anterior?.activo ?? true, unidad, modo};
  if(modo!=='manual')Object.assign(v,calcularPlan(v,anterior?resumirCartera(s).metas.find(m=>m.id===id).ahorrado:0));
  if(v.meses>(unidad==='semanas'?2600:600))throw fallo('El aporte produce un plazo demasiado largo; aumenta el aporte.');
  if (anterior) Object.assign(anterior, v); else c.metas.push(v); return v;
}
export function archivarMeta(s, id, activa = false) {
  if (id === 'general') throw fallo('El objetivo general se conserva siempre.');
  const e = encontrar(cartera(s).metas, id, 'Objetivo'); const r = resumirCartera(s).metas.find(m => m.id === id);
  if (!activa && r.propio > 0) throw fallo('Retira o reasigna el ahorro antes de archivar este objetivo.'); e.activo = activa;
}
export function registrarAhorro(s, entrada) {
  const c = cartera(s); if (!['aporte', 'retiro'].includes(entrada.tipo)) throw fallo('Movimiento de ahorro inválido.');
  const meta = encontrar(c.metas, entrada.metaId, 'Objetivo'); if (!meta.activo) throw fallo('El objetivo está archivado.');
  const valor = monto(entrada.monto); const a = cuenta(s, entrada.cuentaId); const antes = structuredClone(s);
  if (entrada.tipo === 'aporte' && a.disponible < valor) throw fallo('No puedes reservar más que el saldo disponible.');
  const asignado = c.aportes.filter(v => v.metaId === meta.id && v.cuentaId === a.id).reduce((s, v) => s + (v.tipo === 'aporte' ? v.monto : -v.monto), 0);
  if (entrada.tipo === 'retiro' && asignado < valor) throw fallo('Ese objetivo no tiene suficiente ahorro en esa cuenta.');
  const o = {id: randomUUID(), tipo: entrada.tipo, metaId: meta.id, cuentaId: a.id, monto: valor, fecha: fecha(entrada.fecha)};
  c.aportes.push(o); validarSaldos(s, antes); return o;
}

export function categoriasUsuario(s){return s.catalogoCategorias || CATEGORIES.map((nombre,i)=>({id:'base-'+i,nombre,activo:true}));}
export function guardarCategoria(s,entrada,id){
 const lista=structuredClone(categoriasUsuario(s));const anterior=id?encontrar(lista,id,'Categoría'):null;
 if(entrada.activo!==undefined&&typeof entrada.activo!=='boolean')throw fallo('Estado de categoría inválido.');
 const nombre=texto(entrada.nombre??anterior?.nombre,'Nombre de categoría');
 if(lista.some(c=>c.id!==id&&c.nombre.toLocaleLowerCase('es')===nombre.toLocaleLowerCase('es')))throw fallo('Ya existe una categoría con ese nombre.');
 const v={id:anterior?.id||randomUUID(),nombre,activo:entrada.activo??anterior?.activo??true};
 if(anterior){if(nombre!==anterior.nombre)for(const e of s.expenses)if(e.category===anterior.nombre)e.category=nombre;Object.assign(anterior,v);}else lista.push(v);
 s.catalogoCategorias=lista;return v;
}
export function vincularSuscripcion(s,suscripcion,entrada,anterior){
 const id=Object.hasOwn(entrada,'tarjetaId')?entrada.tarjetaId:anterior?.tarjetaId;
 if(id){const t=tarjeta(s,id,id!==anterior?.tarjetaId);suscripcion.tarjetaId=t.id;}
 else if(Object.hasOwn(entrada,'tarjetaId'))suscripcion.tarjetaId=null;
 return suscripcion;
}

import {localDate, METHODS} from './finance.js';

export const MEDIOS_PAGO = ['efectivo', 'debito', 'credito'];
export const NOMBRES_MEDIOS = {efectivo: 'Efectivo', debito: 'Tarjeta de débito', credito: 'Tarjeta de crédito'};
export const SIN_DISTRIBUIR = 'sin-distribuir';
export function carteraInicial(hoy = localDate()) {
  return {version: 1, cuentas: [], tarjetas: [], operaciones: [], aportes: [], metas: [{id: 'general', nombre: 'Ahorro general', objetivo: 0, meses: 12, inicio: hoy, mensual: 0, activo: true}]};
}
export function sumarMeses(fecha, meses) {
  const [a, m, d] = fecha.split('-').map(Number); const primero = new Date(a, m - 1 + meses, 1, 12);
  const ultimo = new Date(primero.getFullYear(), primero.getMonth() + 1, 0, 12).getDate();
  return localDate(new Date(primero.getFullYear(), primero.getMonth(), Math.min(d, ultimo), 12));
}
export function proyeccionMeta(meta, ahorrado, hoy = localDate()) {
  const unidad=meta.unidad || 'meses';
  const limite = unidad==='semanas' ? sumarSemanas(meta.inicio,meta.meses) : sumarMeses(meta.inicio, meta.meses);
  const faltante = Math.max(0, meta.objetivo - ahorrado);
  let mesesRestantes = (Number(limite.slice(0, 4)) - Number(hoy.slice(0, 4))) * 12 + Number(limite.slice(5, 7)) - Number(hoy.slice(5, 7));
  if (mesesRestantes >= 0 && sumarMeses(hoy, mesesRestantes) < limite) mesesRestantes++;
  mesesRestantes = unidad==='semanas'?Math.max(0,Math.ceil((Date.parse(limite+'T12:00:00Z')-Date.parse(hoy+'T12:00:00Z'))/604800000)):Math.max(0, mesesRestantes);
  const configurada = meta.objetivo > 0;
  const estimados = !configurada ? null : faltante === 0 ? 0 : meta.mensual > 0 ? Math.ceil(faltante / meta.mensual) : null;
  return {unidad, limite, faltante, mesesRestantes, periodosRestantes:mesesRestantes, requeridoMensual: configurada && faltante > 0 && mesesRestantes > 0 ? Math.ceil(faltante / mesesRestantes) : null,
    estimados, fechaEstimada: estimados !== null && estimados <= 1200 ? (unidad==='semanas'?sumarSemanas(hoy,estimados):sumarMeses(hoy, estimados)) : null,
    porcentaje: configurada ? Math.min(100, ahorrado * 100 / meta.objetivo) : 0,
    estado: !configurada ? 'sin_configurar' : faltante === 0 ? 'cumplida' : limite <= hoy ? 'vencida' : 'en_curso'};
}
export function rankingTarjetas(expenses, tarjetas, mes) {
  return tarjetas.map(t => ({...t, gastadoMes: expenses.filter(e => e.tarjetaId === t.id && e.date.slice(0, 7) === mes).reduce((s, e) => s + e.amount, 0)})).sort((a, b) => b.gastadoMes - a.gastadoMes || a.alias.localeCompare(b.alias));
}
export function resumirCartera(estado, mes = localDate().slice(0, 7), hoy = localDate()) {
  const c = estado.cartera || carteraInicial(hoy);
  const cuentas = [{id: SIN_DISTRIBUIR, alias: 'Saldo anterior sin distribuir', banco: '', tipo: SIN_DISTRIBUIR, activo: true}, ...c.cuentas].map(a => ({...a, saldo: a.id === SIN_DISTRIBUIR ? estado.initialCapital : 0, reservado: 0}));
  const porCuenta = new Map(cuentas.map(a => [a.id, a]));
  const tarjetas = c.tarjetas.map(t => ({...t, deuda: t.tipo === 'credito' ? t.deudaInicial : 0})); const porTarjeta = new Map(tarjetas.map(t => [t.id, t]));
  for (const e of estado.expenses) {
    if (e.method === METHODS[0]) {const a = porCuenta.get(e.cuentaId || SIN_DISTRIBUIR); if (a) a.saldo -= e.amount;}
    else if (e.tarjetaId && porTarjeta.has(e.tarjetaId)) porTarjeta.get(e.tarjetaId).deuda += e.amount;
  }
  for (const o of c.operaciones) {
    if (o.anulada) continue;
    if (o.origenId && porCuenta.has(o.origenId)) porCuenta.get(o.origenId).saldo -= o.monto;
    if (o.destinoId && porCuenta.has(o.destinoId)) porCuenta.get(o.destinoId).saldo += o.monto;
    if (o.tipo === 'pago_credito' && porTarjeta.has(o.tarjetaId)) porTarjeta.get(o.tarjetaId).deuda -= o.monto;
  }
  const saldosMetas = new Map(c.metas.map(m => [m.id, 0]));
  for (const a of c.aportes) {
    const monto = a.tipo === 'aporte' ? a.monto : -a.monto;
    if (porCuenta.has(a.cuentaId)) porCuenta.get(a.cuentaId).reservado += monto;
    saldosMetas.set(a.metaId, (saldosMetas.get(a.metaId) || 0) + monto);
  }
  for (const a of cuentas) a.disponible = a.saldo - a.reservado;
  const capital = cuentas.reduce((s, a) => s + a.saldo, 0); const reservado = cuentas.reduce((s, a) => s + a.reservado, 0);
  const metas = c.metas.map(m => {const propio = saldosMetas.get(m.id) || 0; const ahorrado = m.id === 'general' ? reservado : propio; return {...m, propio, ahorrado, ...proyeccionMeta(m, ahorrado, hoy)};});
  return {cuentas, tarjetas: rankingTarjetas(estado.expenses, tarjetas, mes), metas, operaciones: [...c.operaciones].reverse(), aportes: [...c.aportes].reverse(), capital, reservado, disponible: capital - reservado,
    bancos: cuentas.filter(a => ['corriente', 'ahorro'].includes(a.tipo)).reduce((s, a) => s + a.saldo, 0), efectivo: cuentas.filter(a => a.tipo === 'efectivo').reduce((s, a) => s + a.saldo, 0),
    sinDistribuir: porCuenta.get(SIN_DISTRIBUIR).saldo,
    creditoSinAsignar: estado.expenses.filter(e => e.method === METHODS[1] && !e.tarjetaId).reduce((s, e) => s + e.amount, 0)};
}

export function sumarSemanas(fecha,semanas){const d=new Date(fecha+'T12:00:00');d.setDate(d.getDate()+7*semanas);return localDate(d);}
export function calcularPlan(meta,ahorrado=0,hoy=localDate()){
 const modo=meta.modo||'aporte';const base=proyeccionMeta(meta,ahorrado,hoy);const faltante=Math.max(0,meta.objetivo-ahorrado);
 return modo==='plazo'?{meses:meta.meses,mensual:base.requeridoMensual??0}:{meses:meta.mensual>0?Math.max(1,Math.ceil(faltante/meta.mensual)):meta.meses,mensual:meta.mensual};
}

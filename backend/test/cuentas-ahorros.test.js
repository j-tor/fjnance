import {test} from 'node:test';
import assert from 'node:assert/strict';
import {carteraInicial, resumirCartera, proyeccionMeta, sumarMeses, rankingTarjetas, SIN_DISTRIBUIR, calcularPlan, sumarSemanas} from '../../shared/cuentas-ahorros.js';
import {guardarCuenta, archivarCuenta, guardarTarjeta, archivarTarjeta, asignarOrigen, registrarOperacion, anularOperacion, guardarMeta, archivarMeta, registrarAhorro, validarSaldos, categoriasUsuario, guardarCategoria, vincularSuscripcion} from '../src/cuentas-ahorros.js';
const estado = () => ({initialCapital: 0, expenses: [], subscriptions: []});
const bancaria = (s, alias, saldo='0', tipo='corriente', origen='nuevo') => guardarCuenta(s, {alias, saldo, tipo, origen, banco:'Banco de prueba'});
const operacion = valores => ({fecha:'2020-01-01', descripcion:'Prueba', ...valores});

test('capital: bancos, efectivo, reparto anterior, transferencias y retiros sin doble conteo', () => {
  const s=estado();s.initialCapital=3500;
  const a=bancaria(s,'Banco uno','10','corriente','sin-distribuir');const b=bancaria(s,'Banco dos','25','ahorro','sin-distribuir');
  let r=resumirCartera(s);assert.equal(r.capital,3500);assert.equal(r.sinDistribuir,0);assert.equal(r.bancos,3500);
  const efectivo=bancaria(s,'Billetera','0','efectivo');
  registrarOperacion(s,operacion({tipo:'transferencia',origenId:b.id,destinoId:efectivo.id,monto:'5'}));r=resumirCartera(s);assert.equal(r.capital,3500);assert.equal(r.efectivo,500);assert.equal(r.bancos,3000);
  registrarOperacion(s,operacion({tipo:'aporte',destinoId:a.id,monto:'2.50'}));assert.equal(resumirCartera(s).capital,3750);
  registrarOperacion(s,operacion({tipo:'retiro',origenId:a.id,monto:'2.50'}));assert.equal(resumirCartera(s).capital,3500);
  assert.throws(()=>registrarOperacion(s,operacion({tipo:'transferencia',origenId:a.id,destinoId:a.id,monto:'1'})));
  assert.throws(()=>registrarOperacion(s,operacion({tipo:'retiro',origenId:a.id,monto:'999'})));
  assert.throws(()=>registrarOperacion(s,operacion({tipo:'inventado',monto:'1'})));
  assert.throws(()=>registrarOperacion(s,operacion({tipo:'aporte',destinoId:a.id,monto:'-1'})));
  assert.throws(()=>registrarOperacion(s,operacion({tipo:'aporte',destinoId:a.id,monto:'1',fecha:'2099-01-01'})));
  assert.throws(()=>bancaria(s,'Otra','1','corriente','inventado'));
  assert.throws(()=>guardarCuenta(s,{alias:'',tipo:'corriente',banco:'Banco'}));
  assert.throws(()=>archivarCuenta(s,a.id));
  archivarCuenta(s,guardarCuenta(s,{alias:'Vacía',tipo:'efectivo',saldo:'0'}).id);
  guardarCuenta(s,{alias:'Renombrada',tipo:a.tipo,banco:'Otro nombre'},a.id);assert.equal(resumirCartera(s).cuentas.find(c=>c.id===a.id).alias,'Renombrada');
});

test('tarjetas: gasto/reversión, cambio de origen, límite, pago y preservación histórica', () => {
  const s=estado();const a=bancaria(s,'Banco A','100');const b=bancaria(s,'Banco B','100');const efectivo=bancaria(s,'Efectivo','20','efectivo');
  const debito=guardarTarjeta(s,{alias:'Débito',tipo:'debito',cuentaId:a.id,ultimos4:'1234'});
  const credito=guardarTarjeta(s,{alias:'Crédito',tipo:'credito',banco:'Banco',deudaInicial:'5',limite:'50'});
  const gasto=asignarOrigen(s,{id:'gasto',method:'Efectivo/Débito',amount:1000,date:'2020-01-01'},{medio:'debito',tarjetaId:debito.id});s.expenses.push(gasto);
  assert.equal(resumirCartera(s).cuentas.find(c=>c.id===a.id).saldo,9000);assert.equal(resumirCartera(s).capital,21000);
  guardarTarjeta(s,{alias:'Débito',tipo:'debito',cuentaId:b.id},debito.id);
  const editado=asignarOrigen(s,{...gasto,amount:1500},{medio:'debito',tarjetaId:debito.id},gasto);assert.equal(editado.cuentaId,a.id);s.expenses[0]=editado;
  const anterior=structuredClone(s);s.expenses[0]=asignarOrigen(s,{...gasto,amount:1500},{medio:'credito',tarjetaId:credito.id},editado);validarSaldos(s,anterior);
  assert.equal(resumirCartera(s).capital,22000);assert.equal(resumirCartera(s).tarjetas.find(t=>t.id===credito.id).deuda,2000);
  assert.throws(()=>guardarTarjeta(s,{alias:'Crédito',tipo:'credito',banco:'Banco',limite:'1'},credito.id));
  registrarOperacion(s,operacion({tipo:'pago_credito',origenId:a.id,tarjetaId:credito.id,monto:'20'}));assert.equal(resumirCartera(s).capital,20000);assert.equal(resumirCartera(s).tarjetas.find(t=>t.id===credito.id).deuda,0);
  assert.equal(s.expenses.length,1);assert.equal(rankingTarjetas(s.expenses,s.cartera.tarjetas,'2020-01')[0].gastadoMes,1500);
  assert.throws(()=>registrarOperacion(s,operacion({tipo:'pago_credito',origenId:a.id,tarjetaId:credito.id,monto:'1'})));
  assert.throws(()=>asignarOrigen(s,{amount:1},{medio:'debito',tarjetaId:credito.id}));
  assert.throws(()=>asignarOrigen(s,{amount:1},{medio:'efectivo',cuentaId:a.id}));
  assert.equal(asignarOrigen(s,{amount:1},{medio:'efectivo',cuentaId:efectivo.id}).cuentaId,efectivo.id);
  assert.throws(()=>guardarTarjeta(s,{alias:'X',tipo:'debito',cuentaId:efectivo.id}));
  assert.throws(()=>guardarTarjeta(s,{alias:'X',tipo:'credito',banco:'B',numero:'1234567812345678'}));
  assert.throws(()=>guardarTarjeta(s,{alias:'X',tipo:'credito',banco:'B',ultimos4:'12345'}));
  archivarTarjeta(s,debito.id);assert.throws(()=>asignarOrigen(s,{amount:1},{medio:'debito',tarjetaId:debito.id}));archivarTarjeta(s,debito.id,true);
  assert.ok(s.expenses[0].tarjetaId===credito.id);
});

test('ahorro reservado: general incluye metas una vez, límites, retirada y archivo', () => {
  const s=estado();const a=bancaria(s,'Banco','100');const m=guardarMeta(s,{nombre:'Viaje',objetivo:'100',meses:10,inicio:'2020-01-01',mensual:'10'});
  registrarAhorro(s,{tipo:'aporte',metaId:m.id,cuentaId:a.id,monto:'20',fecha:'2020-01-01'});
  registrarAhorro(s,{tipo:'aporte',metaId:'general',cuentaId:a.id,monto:'10',fecha:'2020-01-01'});
  let r=resumirCartera(s);assert.equal(r.capital,10000);assert.equal(r.reservado,3000);assert.equal(r.disponible,7000);assert.equal(r.metas.find(v=>v.id==='general').ahorrado,3000);assert.equal(r.metas.find(v=>v.id===m.id).ahorrado,2000);
  assert.throws(()=>registrarAhorro(s,{tipo:'aporte',metaId:m.id,cuentaId:a.id,monto:'71',fecha:'2020-01-01'}));
  assert.throws(()=>registrarAhorro(s,{tipo:'retiro',metaId:'general',cuentaId:a.id,monto:'11',fecha:'2020-01-01'}));
  assert.throws(()=>archivarMeta(s,'general'));assert.throws(()=>archivarMeta(s,m.id));
  registrarAhorro(s,{tipo:'retiro',metaId:m.id,cuentaId:a.id,monto:'20',fecha:'2020-01-01'});archivarMeta(s,m.id);archivarMeta(s,m.id,true);
  r=resumirCartera(s);assert.equal(r.capital,10000);assert.equal(r.reservado,1000);assert.equal(r.disponible,9000);
  assert.throws(()=>guardarMeta(s,{nombre:'X',objetivo:'1',meses:0,inicio:'2020-01-01',mensual:'0'}));
  assert.throws(()=>guardarMeta(s,{nombre:'X',objetivo:'-1',meses:1,inicio:'2020-01-01',mensual:'0'}));
  assert.throws(()=>guardarMeta(s,{nombre:'X',objetivo:'1',meses:1,inicio:'2020-02-30',mensual:'0'}));
});

test('proyecciones: plazo real, redondeo, cero aporte, vencida y meta cumplida', () => {
  assert.equal(sumarMeses('2024-01-31',1),'2024-02-29');
  const m={...carteraInicial('2026-01-01').metas[0],objetivo:10001,meses:3,mensual:1000};
  let r=proyeccionMeta(m,0,'2026-01-01');assert.equal(r.requeridoMensual,3334);assert.equal(r.estimados,11);
  assert.equal(proyeccionMeta({...m,mensual:0},0,'2026-01-01').estimados,null);
  assert.equal(proyeccionMeta(m,10001,'2026-01-01').estado,'cumplida');assert.equal(proyeccionMeta(m,10001,'2026-01-01').estimados,0);
  assert.equal(proyeccionMeta(m,0,'2027-01-01').estado,'vencida');assert.equal(proyeccionMeta(m,0,'2027-01-01').mesesRestantes,0);
  assert.equal(proyeccionMeta({...m,objetivo:0},0).estado,'sin_configurar');
  const viejo=estado();viejo.initialCapital=5000;viejo.expenses=[{amount:1000,method:'Efectivo/Débito',date:'2020-01-01'}];assert.equal(resumirCartera(viejo).cuentas.find(c=>c.id===SIN_DISTRIBUIR).saldo,4000);assert.equal(viejo.cartera,undefined);
  assert.deepEqual(rankingTarjetas([],[], '2020-01'),[]);
});

test('anulaciones: reversión trazable, repetición y fondos ya consumidos',()=>{
 const s=estado();const a=bancaria(s,'Banco','10');const apertura=s.cartera.operaciones[0];
 const retiro=registrarOperacion(s,operacion({tipo:'retiro',origenId:a.id,monto:'4'}));
 anularOperacion(s,retiro.id);assert.equal(resumirCartera(s).capital,1000);assert.equal(retiro.anulada,true);assert.throws(()=>anularOperacion(s,retiro.id));
 registrarOperacion(s,operacion({tipo:'retiro',origenId:a.id,monto:'5'}));assert.throws(()=>anularOperacion(s,apertura.id));assert.equal(apertura.anulada,undefined);assert.equal(resumirCartera(s).capital,500);
 assert.throws(()=>anularOperacion(s,'ajena'),{status:404});
});

test('comparativa mensual: empate, otro mes y tarjetas sin consumo',()=>{
 const tarjetas=[{id:'b',alias:'B'},{id:'a',alias:'A'},{id:'c',alias:'C'}];const gastos=[{tarjetaId:'b',amount:200,date:'2020-01-01'},{tarjetaId:'a',amount:200,date:'2020-01-02'},{tarjetaId:'c',amount:999,date:'2020-02-01'}];
 const r=rankingTarjetas(gastos,tarjetas,'2020-01');assert.deepEqual(r.map(t=>[t.alias,t.gastadoMes]),[['A',200],['B',200],['C',0]]);assert.equal(tarjetas[0].gastadoMes,undefined);
});

test('categorías propias: crear, duplicado, renombrar historial, archivar y resumen',()=>{
 const s=estado();s.expenses=[{category:'Amigos',amount:100,date:'2020-01-01'}];const lista=categoriasUsuario(s);assert.equal(lista.length,5);assert.equal(s.catalogoCategorias,undefined);
 const c=guardarCategoria(s,{nombre:'Transporte'});assert.ok(c.activo);assert.throws(()=>guardarCategoria(s,{nombre:' transporte '}));assert.throws(()=>guardarCategoria(s,{nombre:' '}));
 guardarCategoria(s,{nombre:'Salidas'},'base-0');assert.equal(s.expenses[0].category,'Salidas');guardarCategoria(s,{activo:false},'base-0');assert.equal(s.expenses[0].category,'Salidas');guardarCategoria(s,{activo:true},'base-0');assert.throws(()=>guardarCategoria(s,{activo:'sí'},c.id));assert.throws(()=>guardarCategoria(s,{nombre:'X'},'ajena'),{status:404});
});
test('planes bidireccionales mensuales/semanales y suscripción vinculada',()=>{
 const hoy='2026-01-01';const m={objetivo:10001,mensual:0,meses:3,inicio:hoy,unidad:'meses',modo:'plazo'};assert.equal(calcularPlan(m,0,hoy).mensual,3334);assert.equal(calcularPlan({...m,modo:'aporte',mensual:2500},0,hoy).meses,5);
 assert.equal(sumarSemanas('2024-02-22',1),'2024-02-29');const w={...m,unidad:'semanas',meses:4};assert.equal(proyeccionMeta(w,0,hoy).limite,'2026-01-29');assert.equal(calcularPlan(w,2001,hoy).mensual,2000);assert.equal(calcularPlan({...w,modo:'aporte',mensual:0},0,hoy).mensual,0);assert.equal(calcularPlan({...w,modo:'aporte',mensual:100},10001,hoy).meses,1);
 const s=estado();const c=bancaria(s,'Banco','10');const t=guardarTarjeta(s,{alias:'Débito',tipo:'debito',cuentaId:c.id});assert.equal(vincularSuscripcion(s,{name:'Servicio'},{tarjetaId:t.id}).tarjetaId,t.id);archivarTarjeta(s,t.id);assert.throws(()=>vincularSuscripcion(s,{}, {tarjetaId:t.id}));assert.equal(vincularSuscripcion(s,{}, {},{tarjetaId:t.id}).tarjetaId,t.id);assert.equal(vincularSuscripcion(s,{}, {tarjetaId:null}).tarjetaId,null);assert.throws(()=>vincularSuscripcion(s,{}, {tarjetaId:'ajena'}),{status:404});assert.throws(()=>guardarMeta(s,{nombre:'Meta',objetivo:'100',meses:1,inicio:hoy,unidad:'dias'}));
});

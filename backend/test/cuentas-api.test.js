import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MongoClient} from 'mongodb';
import {appDePrueba, fetchAutenticado, baseDePrueba, autenticarCliente} from './soporte-mongodb.js';

test('API F5: bancos/tarjetas/metas, saldo, reversión, archivo, validadores e aislamiento', async () => {
  const base=await baseDePrueba();let servidor=await appDePrueba(base);await new Promise(r=>servidor.listen(0,'127.0.0.1',r));
  const url=()=>`http://127.0.0.1:${servidor.address().port}`;
  const mongo=new MongoClient(base.mongoUri);
  async function pedir(ruta,method='GET',body,otro) {const opciones={method,headers:{'Content-Type':'application/json',...(otro?{Cookie:otro.cookie,'X-CSRF-Token':otro.csrf}:{})},body:body===undefined?undefined:JSON.stringify(body)};const r=await fetchAutenticado(url()+'/api/'+ruta,opciones);return{status:r.status,data:await r.json()};}
  try {
    await mongo.connect();const db=mongo.db(base.mongoDatabase);
    const cliente=await autenticarCliente(url());
    for(const [ruta,method] of [['categorias','POST'],['cuentas','POST'],['tarjetas','POST'],['objetivos','POST'],['operaciones','POST'],['ahorros','POST'],['operaciones/ajena/anular','POST']]){
      const opciones={method,headers:{'Content-Type':'application/json'},body:'{}'};
      assert.equal((await globalThis.fetch(url()+'/api/'+ruta,opciones)).status,401);
      assert.equal((await globalThis.fetch(url()+'/api/'+ruta,{...opciones,headers:{...opciones.headers,Cookie:cliente.cookie}})).status,403);
    }
    await pedir('capital','PUT',{amount:'35'});
    let r=await pedir('cuentas','POST',{alias:'Banco uno',banco:'Banco A',tipo:'corriente',saldo:'10',origen:'sin-distribuir'});assert.equal(r.status,201);const a=r.data.resumenCuentas.cuentas.find(c=>c.alias==='Banco uno').id;
    r=await pedir('cuentas','POST',{alias:'Banco dos',banco:'Banco B',tipo:'ahorro',saldo:'25',origen:'sin-distribuir'});const b=r.data.resumenCuentas.cuentas.find(c=>c.alias==='Banco dos').id;assert.equal(r.data.capital,3500);assert.equal(r.data.resumenCuentas.sinDistribuir,0);
    assert.equal((await pedir('cuentas/'+a)).data.banco,'Banco A');assert.equal((await pedir('cuentas?mes=invalido')).status,400);
    assert.equal((await pedir('cuentas','POST',{alias:'Inválida',tipo:'corriente',banco:'Banco',saldo:'1',origen:'sin-distribuir'})).status,400);
    r=await pedir('cuentas','POST',{alias:'Efectivo',tipo:'efectivo',saldo:'10',origen:'nuevo'});const efectivo=r.data.resumenCuentas.cuentas.find(c=>c.tipo==='efectivo').id;
    r=await pedir('tarjetas','POST',{alias:'Débito A',tipo:'debito',cuentaId:a,ultimos4:'1111'});assert.equal(r.status,201);const debito=r.data.resumenCuentas.tarjetas.find(t=>t.alias==='Débito A').id;
    r=await pedir('tarjetas','POST',{alias:'Crédito B',tipo:'credito',banco:'Banco B',deudaInicial:'0',limite:'100',ultimos4:'2222'});const credito=r.data.resumenCuentas.tarjetas.find(t=>t.tipo==='credito').id;
    assert.equal((await pedir('tarjetas/'+debito)).data.cuentaId,a);assert.equal((await pedir('tarjetas?mes=2020-01')).status,200);
    assert.equal((await pedir('tarjetas','POST',{alias:'PAN',tipo:'credito',banco:'B',cvv:'123'})).status,400);
    const gasto={description:'Compra',amount:'2',date:'2020-01-01',category:'Amigos',medio:'debito',tarjetaId:debito};
    r=await pedir('expenses','POST',gasto);assert.equal(r.status,201);const id=r.data.expenses[0].id;assert.equal(r.data.capital,4300);
    assert.equal((await pedir('expenses','POST',{...gasto,medio:'credito'})).status,400);
    r=await pedir('expenses/'+id,'PUT',{...gasto,medio:'credito',tarjetaId:credito,amount:'3'});assert.equal(r.status,200);assert.equal(r.data.capital,4500);assert.equal(r.data.resumenCuentas.tarjetas.find(t=>t.id===credito).deuda,300);
    r=await pedir('operaciones','POST',{tipo:'pago_credito',origenId:b,tarjetaId:credito,monto:'3',fecha:'2020-01-01'});assert.equal(r.status,201);assert.equal(r.data.capital,4200);assert.equal(r.data.expenses.length,1);const pago=r.data.resumenCuentas.operaciones[0].id;
    assert.equal((await pedir('expenses/'+id,'DELETE',{})).status,400);
    r=await pedir('operaciones/'+pago+'/anular','POST',{});assert.equal(r.status,200);assert.equal(r.data.capital,4500);
    assert.equal((await pedir('operaciones/'+pago+'/anular','POST',{})).status,400);
    assert.equal((await pedir('expenses/'+id,'DELETE',{})).status,200);
    await pedir('cuentas/'+a,'PUT',{alias:'Banco A editado',banco:'Banco A',tipo:'corriente'});assert.equal((await pedir('cuentas/'+a)).data.alias,'Banco A editado');
    await pedir('tarjetas/'+debito,'PUT',{alias:'Débito editado',tipo:'debito',cuentaId:a,ultimos4:'1111'});assert.equal((await pedir('tarjetas/'+debito)).data.alias,'Débito editado');
    assert.equal((await pedir('tarjetas/'+debito,'DELETE',{})).status,200);assert.equal((await pedir('expenses','POST',gasto)).status,400);await pedir('tarjetas/'+debito,'PUT',{activo:true});
    r=await pedir('objetivos/general','PUT',{nombre:'General',objetivo:'100',meses:10,inicio:'2020-01-01',mensual:'10'});assert.equal(r.status,200);
    r=await pedir('objetivos','POST',{nombre:'Viaje',objetivo:'20',meses:4,inicio:'2020-01-01',mensual:'5'});const meta=r.data.resumenCuentas.metas.find(m=>m.nombre==='Viaje').id;
    assert.equal((await pedir('objetivos/'+meta)).status,200);assert.equal((await pedir('objetivos')).status,200);assert.equal((await pedir('objetivos/general','DELETE',{})).status,400);
    r=await pedir('ahorros','POST',{tipo:'aporte',metaId:meta,cuentaId:b,monto:'5',fecha:'2020-01-01'});assert.equal(r.status,201);assert.equal(r.data.capital,4500);assert.equal(r.data.resumenCuentas.reservado,500);assert.equal(r.data.resumenCuentas.disponible,4000);
    assert.equal((await pedir('ahorros')).data.reservado,500);
    assert.equal((await pedir('objetivos/'+meta,'DELETE',{})).status,400);
    assert.equal((await pedir('ahorros','POST',{tipo:'retiro',metaId:'general',cuentaId:b,monto:'1',fecha:'2020-01-01'})).status,400);
    await pedir('ahorros','POST',{tipo:'retiro',metaId:meta,cuentaId:b,monto:'5',fecha:'2020-01-01'});await pedir('objetivos/'+meta,'DELETE',{});await pedir('objetivos/'+meta,'PUT',{activo:true});
    assert.equal((await pedir('operaciones')).status,200);
    let cat=await pedir('categorias','POST',{nombre:'Transporte'});assert.equal(cat.status,201);const categoriaId=cat.data.categoriasGestion.find(c=>c.nombre==='Transporte').id;assert.equal((await pedir('categorias')).status,200);
    assert.equal((await pedir('categorias','POST',{nombre:' transporte '})).status,400);assert.equal((await pedir('categorias','POST',{nombre:''})).status,400);
    let compra=await pedir('expenses','POST',{...gasto,medio:'efectivo',cuentaId:efectivo,tarjetaId:undefined,category:'Transporte',amount:'1'});assert.equal(compra.status,201);const compraId=compra.data.expenses[0].id;
    cat=await pedir('categorias/'+categoriaId,'PUT',{nombre:'Movilidad'});assert.equal(cat.status,200);assert.equal(cat.data.expenses[0].category,'Movilidad');assert.ok(cat.data.categories.includes('Movilidad'));
    assert.equal((await pedir('categorias/'+categoriaId,'DELETE',{})).status,200);assert.equal((await pedir('expenses','POST',{...gasto,medio:'efectivo',cuentaId:efectivo,category:'Movilidad'})).status,400);await pedir('expenses/'+compraId,'DELETE',{});await pedir('categorias/'+categoriaId,'PUT',{activo:true});
    let sub=await pedir('subscriptions','POST',{name:'Servicio',amount:'1',day:5,active:true,tarjetaId:debito});assert.equal(sub.status,201);const subId=sub.data.subscriptions[0].id;assert.equal(sub.data.subscriptions[0].tarjetaId,debito);
    assert.equal((await pedir('subscriptions/'+subId,'PUT',{name:'Servicio',amount:'2',day:5,active:true,tarjetaId:credito})).status,200);
    assert.equal((await pedir('subscriptions','POST',{name:'Servicio',amount:'1',day:5,active:true,tarjetaId:'ajena'})).status,404);
    let plan=await pedir('objetivos','POST',{nombre:'Semanal',objetivo:'100',meses:4,inicio:new Date().toISOString().slice(0,10),unidad:'semanas',modo:'plazo'});assert.equal(plan.status,201);assert.equal(plan.data.resumenCuentas.metas.find(m=>m.nombre==='Semanal').mensual,2500);
    assert.equal((await pedir('objetivos','POST',{nombre:'Inválida',objetivo:'100',meses:4,inicio:'2020-01-01',unidad:'dias'})).status,400);
    const vacia=await pedir('cuentas','POST',{alias:'Vacía',tipo:'efectivo',saldo:'0'});const vaciaId=vacia.data.resumenCuentas.cuentas.find(c=>c.alias==='Vacía').id;
    assert.equal((await pedir('cuentas/'+vaciaId,'DELETE',{})).status,200);assert.equal((await pedir('cuentas/'+vaciaId,'PUT',{activo:true})).status,200);
    assert.equal((await pedir('cuentas/'+a,'DELETE',{})).status,400);
    assert.equal((await pedir('objetivos/'+meta,'PUT',{nombre:'Viaje editado',objetivo:'30',meses:3,inicio:'2020-01-01',mensual:'10'})).status,200);
    assert.equal((await pedir('objetivos','POST',{nombre:'Mala',objetivo:'1',meses:0,inicio:'2020-01-01'})).status,400);
    assert.equal((await pedir('ahorros','POST',{tipo:'inventado'})).status,400);assert.equal((await pedir('operaciones','POST',{tipo:'inventado'})).status,400);
    // Dos cargos concurrentes no pueden gastar dos veces el mismo efectivo.
    const cargos=await Promise.all([1,2].map(()=>pedir('expenses','POST',{...gasto,medio:'efectivo',tarjetaId:undefined,cuentaId:efectivo,amount:'7'})));
    assert.deepEqual(cargos.map(r=>r.status).sort(),[201,400]);
    const otra=await autenticarCliente(url(),{nombre:'Otra cuenta',correo:'otra-cartera@example.test',clave:'Otra cuenta 12345!'});
    assert.equal((await pedir('categorias/'+categoriaId,'PUT',{nombre:'Ajena'},otra)).status,404);assert.equal((await pedir('categorias','GET',undefined,otra)).data.some(c=>c.nombre==='Movilidad'),false);assert.equal((await pedir('subscriptions','POST',{name:'Ajena',amount:'1',day:1,active:true,tarjetaId:debito},otra)).status,404);
    for(const ruta of ['cuentas/'+a,'tarjetas/'+debito,'objetivos/'+meta])assert.equal((await pedir(ruta,'GET',undefined,otra)).status,404);
    assert.equal((await pedir('tarjetas','POST',{alias:'Ajena',tipo:'debito',cuentaId:a},otra)).status,404);
    assert.equal((await pedir('ahorros','POST',{tipo:'aporte',metaId:meta,cuentaId:b,monto:'1',fecha:'2020-01-01'},otra)).status,404);
    assert.equal((await pedir('operaciones','POST',{tipo:'retiro',origenId:a,monto:'1',fecha:'2020-01-01'},otra)).status,404);
    assert.equal((await pedir('operaciones/'+pago+'/anular','POST',{},otra)).status,404);
    // Restaurar fixture y verificar persistencia sin duplicar capital.
    await autenticarCliente(url(),undefined,false);
    const antes=(await pedir('state')).data;
    await new Promise(r=>servidor.close(r));servidor=await appDePrueba(base);await new Promise(r=>servidor.listen(0,'127.0.0.1',r));
    assert.equal((await pedir('state')).data.capital,antes.capital);
    const usuario=await db.collection('usuarios').findOne({correo:'finanzas@example.test'});
    await assert.rejects(db.collection('estados_usuario').updateOne({_id:usuario._id},{$set:{'valor.cartera.cuentas.0.tipo':'inventada'}}),{code:121});
    await assert.rejects(db.collection('estados_usuario').updateOne({_id:usuario._id},{$set:{'valor.cartera.tarjetas.0.cvv':'123'}}),{code:121});
    assert.equal((await db.collection('estado').findOne({_id:'principal'})).valor.expenses.length,0);
  } finally {if(servidor.listening)await new Promise(r=>servidor.close(r));await mongo.close();await base.limpiar();}
});

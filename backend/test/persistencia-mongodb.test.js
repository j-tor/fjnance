import {test} from 'node:test';
import assert from 'node:assert/strict';
import {abrirMongo} from '../src/persistencia-mongodb.js';
import {appDePrueba as createApp, fetchAutenticado as fetch, limpiarAppsPrueba} from './soporte-mongodb.js';
import {baseDePrueba} from './soporte-mongodb.js';
import {CATEGORIES, METHODS, localDate} from '../../shared/finance.js';

test('MongoDB rechaza configuración inválida y servidor inaccesible', async () => {
  await assert.rejects(abrirMongo({uri: 'incorrecta', nombre: 'prueba'}), /Configura/);
  await assert.rejects(abrirMongo({uri: 'mongodb://127.0.0.1:1', nombre: 'base.invalida'}), /Configura/);
  await assert.rejects(abrirMongo({uri: 'mongodb://127.0.0.1:1', nombre: 'prueba', inicial: {}}), /No se pudo conectar/);
});

test('MongoDB: API, concurrencia, validaciones, comprobantes límite y reconexión', async () => {
  const base = await baseDePrueba();
  let server;
  async function abrir() {server = await createApp(base); await new Promise(r => server.listen(0, '127.0.0.1', r));}
  async function cerrar() {if (server) {await new Promise(r => server.close(r)); await server.cerrarPersistencia(); server = null;}}
  const pedir = async (ruta, method = 'GET', valor) => {
    const r = await fetch(`http://127.0.0.1:${server.address().port}/api/${ruta}`, {method, headers: {'Content-Type': 'application/json'}, body: valor && JSON.stringify(valor)});
    return {status: r.status, valor: await r.json()};
  };
  try {
    await abrir();
    assert.equal((await pedir('health')).status, 200);
    assert.equal((await pedir('capital', 'PUT', {amount: '500'})).valor.capital, 50000);
    assert.equal((await pedir('capital', 'PUT', {amount: '-1'})).status, 400);
    const gasto = {description: 'Prueba aislada', amount: '1.25', date: localDate(), category: CATEGORIES[0], method: METHODS[0]};
    const bytes = Buffer.alloc(5 * 1024 * 1024, 32); bytes.write('%PDF-');
    const receipt = {name: 'limite.pdf', type: 'application/pdf', base64: bytes.toString('base64')};
    for (let i = 0; i < 3; i++) assert.equal((await pedir('expenses', 'POST', {...gasto, receipt})).status, 201);
    const resultados = await Promise.all(Array.from({length: 8}, () => pedir('expenses', 'POST', gasto)));
    assert.ok(resultados.every(r => r.status === 201));
    assert.equal((await pedir('expenses', 'POST', {...gasto, amount: '-1'})).status, 400);
    assert.equal((await pedir('expenses', 'POST', {...gasto, receipt: {...receipt, base64: Buffer.concat([bytes, Buffer.from('x')]).toString('base64')}})).status, 400);
    const sub = {name: 'Servicio prueba', amount: '3', day: 31, active: true};
    const creada = await pedir('subscriptions', 'POST', sub);
    const id = creada.valor.subscriptions.find(s => s.name === sub.name).id;
    assert.equal((await pedir(`subscriptions/${id}`, 'PUT', {...sub, day: 32})).status, 400);
    assert.equal((await pedir(`subscriptions/${id}`, 'PUT', {...sub, active: false})).status, 200);
    let estado = (await pedir('state')).valor;
    assert.equal(estado.expenses.length, 11); assert.equal(estado.capital, 48625);
    const movimiento = estado.expenses.find(e => e.receipt);
    const archivo = await fetch(`http://127.0.0.1:${server.address().port}${movimiento.receipt.url}`);
    assert.deepEqual(Buffer.from(await archivo.arrayBuffer()), bytes);
    await cerrar(); await abrir();
    estado = (await pedir('state')).valor;
    assert.equal(estado.expenses.length, 11); assert.equal(estado.capital, 48625);
    assert.equal(estado.subscriptions.find(s => s.id === id).active, false);
    assert.equal((await pedir(`expenses/${movimiento.id}`, 'PUT', {...gasto, receipt: null})).status, 200);
    assert.equal((await pedir(`receipts/${movimiento.id}`)).status, 404);
    assert.equal((await pedir(`expenses/${movimiento.id}`, 'DELETE', {})).status, 200);
    assert.equal((await pedir(`subscriptions/${id}`, 'DELETE', {})).status, 200);
  } finally {await cerrar(); await base.limpiar();}
});

test('MongoDB detecta escrituras concurrentes sin sobrescribir cambios ajenos', async () => {
  const base = await baseDePrueba();
  const opciones = {uri: base.mongoUri, nombre: base.mongoDatabase, inicial: {initialCapital: 0, expenses: [], subscriptions: []}};
  const a = await abrirMongo(opciones); const b = await abrirMongo(opciones);
  try {
    const anteriorA = await a.leer(); const anteriorB = await b.leer();
    await a.guardar({...anteriorA, initialCapital: 100}, anteriorA);
    await assert.rejects(b.guardar({...anteriorB, initialCapital: 200}, anteriorB), {status: 409});
    assert.equal((await b.leer()).initialCapital, 100);
    await a.cerrar();
    await assert.rejects(a.guardar({...anteriorA, initialCapital: 300}, anteriorA));
    assert.equal((await b.leer()).initialCapital, 100);
  } finally {await a.cerrar(); await b.cerrar(); await base.limpiar();}
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {appDePrueba as createApp, fetchAutenticado as fetch, limpiarAppsPrueba} from './soporte-mongodb.js';
import {baseDePrueba} from './soporte-mongodb.js';
import {CATEGORIES, METHODS, localDate} from '../../shared/finance.js';

test('recursos API: consultas, CRUD, comprobantes, límites y catálogo OpenAPI', async () => {
  const base = await baseDePrueba(); let servidor;
  const abrir = async () => {servidor = await createApp(base); await new Promise(r => servidor.listen(0, '127.0.0.1', r));};
  const cerrar = async () => {await new Promise(r => servidor.close(r)); await servidor.cerrarPersistencia();};
  const cobertura = new Set();
  async function pedir(ruta, method = 'GET', valor) {
    cobertura.add(method.toLowerCase() + ' /api/' + ruta.replace(/\/[a-f0-9-]{36}$/, '/{id}'));
    const r = await fetch(`http://127.0.0.1:${servidor.address().port}/api/${ruta}`, {method, headers: {'Content-Type': 'application/json'}, body: valor === undefined ? undefined : JSON.stringify(valor)});
    return {status: r.status, valor: await r.json()};
  }
  try {
    await abrir();
    for (const ruta of ['/', '/index.html', '/assets/inexistente.js']) {
      const respuesta = await fetch(`http://127.0.0.1:${servidor.address().port}${ruta}`);
      assert.equal(respuesta.status, 404);
      assert.deepEqual(await respuesta.json(), {error: 'Ruta no encontrada.'});
    }
    assert.deepEqual((await pedir('capital')).valor, {initialCapital: 0, capital: 0});
    assert.deepEqual((await pedir('expenses')).valor, []);
    assert.deepEqual((await pedir('categories')).valor, CATEGORIES); assert.deepEqual((await pedir('methods')).valor, METHODS);
    assert.equal((await pedir('health')).status, 200); assert.equal((await pedir('state')).status, 200);
    for (const ruta of ['expenses/inexistente', 'subscriptions/inexistente', 'receipts/inexistente', 'receipts/inexistente/extra', 'desconocida']) assert.equal((await pedir(ruta)).status, 404);
    const iniciales = (await pedir('subscriptions')).valor;
    for (const s of iniciales) assert.equal((await pedir('subscriptions/' + s.id, 'DELETE', {})).status, 200);
    assert.deepEqual((await pedir('subscriptions')).valor, []);
    assert.equal((await pedir('capital', 'PUT', {amount: '100'})).status, 200);
    const gasto = {description: 'Prueba recurso', amount: '2.50', date: localDate(), method: METHODS[0], category: CATEGORIES[0]};
    const creado = await pedir('expenses', 'POST', gasto); assert.equal(creado.status, 201);
    const id = creado.valor.expenses[0].id;
    assert.equal((await pedir('expenses/' + id)).valor.amount, 250);
    assert.equal((await pedir('capital')).valor.capital, 9750);
    assert.equal((await pedir('expenses/' + id, 'PUT', {...gasto, amount: '3'})).valor.expenses[0].id, id);
    assert.equal((await pedir('expenses', 'POST', {...gasto, category: 'incorrecta'})).status, 400);
    const sub = {name: 'Prueba', amount: '10', day: 31, active: true};
    const creada = await pedir('subscriptions', 'POST', sub); assert.equal(creada.status, 201);
    const sid = creada.valor.subscriptions[0].id;
    assert.equal((await pedir('subscriptions/' + sid)).valor.name, 'Prueba');
    assert.equal((await pedir('subscriptions/' + sid, 'PUT', {...sub, active: false})).status, 200);
    assert.equal((await pedir('subscriptions/' + sid)).valor.next, null);
    assert.equal((await pedir('subscriptions', 'POST', {...sub, day: 0})).status, 400);
    const archivo = {name: 'archivo.pdf', type: 'application/pdf', base64: Buffer.from('%PDF-1.4').toString('base64')};
    assert.equal((await pedir('receipts/' + id, 'DELETE', {})).status, 404);
    for (const valor of [{}, {...archivo, base64: 'mal'}, {...archivo, type: 'text/plain'}]) assert.equal((await pedir('receipts/' + id, 'PUT', valor)).status, 400);
    assert.equal((await pedir('receipts/inexistente', 'PUT', archivo)).status, 404);
    assert.equal((await pedir('receipts/inexistente', 'DELETE', {})).status, 404);
    for (const [type, firma] of [['image/png', '89504e470d0a1a0a'], ['image/jpeg', 'ffd8ff'], ['image/webp', '524946460000000057454250']]) {
      assert.equal((await pedir('receipts/' + id, 'PUT', {name: 'imagen', type, base64: Buffer.from(firma, 'hex').toString('base64')})).status, 200);
    }
    const bytes = Buffer.alloc(5 * 1024 * 1024, 32); bytes.write('%PDF-');
    const limite = {...archivo, base64: bytes.toString('base64')};
    assert.equal((await pedir('receipts/' + id, 'PUT', limite)).status, 200);
    assert.equal((await pedir('receipts/' + id, 'PUT', {...limite, base64: Buffer.concat([bytes, Buffer.from('x')]).toString('base64')})).status, 400);
    await cerrar(); await abrir();
    const descargado = await fetch(`http://127.0.0.1:${servidor.address().port}/api/receipts/${id}`);
    cobertura.add('get /api/receipts/{id}');
    assert.equal(descargado.status, 200); assert.deepEqual(Buffer.from(await descargado.arrayBuffer()), bytes);
    assert.equal((await pedir('receipts/' + id, 'PUT', archivo)).status, 200);
    assert.equal((await pedir('receipts/' + id, 'DELETE', {})).status, 200);
    assert.equal((await pedir('receipts/' + id)).status, 404);
    assert.equal((await pedir('expenses/' + id)).valor.receipt, null);
    assert.equal((await pedir('expenses/' + id, 'DELETE', {})).status, 200);
    assert.equal((await pedir('subscriptions/' + sid, 'DELETE', {})).status, 200);
    assert.deepEqual((await pedir('expenses')).valor, []); assert.deepEqual((await pedir('subscriptions')).valor, []);
    assert.equal((await pedir('capital')).valor.capital, 10000);
    const documento = JSON.parse(await readFile(new URL('../../docs/openapi.json', import.meta.url), 'utf8'));
    assert.equal(documento.openapi, '3.0.3');
    for (const [ruta, metodos] of Object.entries(documento.paths)) for (const metodo of Object.keys(metodos)) {
      if (ruta.startsWith('/api/auth/') || ruta.startsWith('/api/admin/')) continue;
      if (/^\/api\/(categorias|cuentas|tarjetas|objetivos|operaciones|ahorros)(\/|$)/.test(ruta)) continue; // Cubiertos en cuentas-api.test.js.
      assert.ok(cobertura.has(metodo + ' ' + ruta), 'Endpoint documentado probado: ' + metodo + ' ' + ruta);
    }
    function referencias(valor) {
      if (!valor || typeof valor !== 'object') return;
      if (valor.$ref) assert.ok(documento.components.schemas[valor.$ref.split('/').at(-1)], valor.$ref);
      Object.values(valor).forEach(referencias);
    }
    referencias(documento);
  } finally {if (servidor?.listening) await cerrar(); await base.limpiar();}
});

test('consultas y descarga releen MongoDB tras escritura de otra conexión', async () => {
  const base = await baseDePrueba(); const servidores = [];
  try {
    for (let i = 0; i < 2; i++) {const s = await createApp(base); await new Promise(r => s.listen(0, '127.0.0.1', r)); servidores.push(s);}
    const url = i => `http://127.0.0.1:${servidores[i].address().port}/api/`;
    const opciones = body => ({method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    const receipt = {name: 'nuevo.pdf', type: 'application/pdf', base64: Buffer.from('%PDF-nuevo').toString('base64')};
    const r = await fetch(url(0) + 'expenses', opciones({description: 'Externo', amount: '1', date: localDate(), method: METHODS[0], category: CATEGORIES[0], receipt}));
    assert.equal(r.status, 201); const id = (await r.json()).expenses[0].id;
    assert.equal(await (await fetch(url(1) + 'receipts/' + id)).text(), '%PDF-nuevo');
    assert.equal((await (await fetch(url(1) + 'expenses/' + id)).json()).description, 'Externo');
    assert.equal((await (await fetch(url(1) + 'capital')).json()).capital, -100);
  } finally {
    for (const s of servidores) {await new Promise(r => s.close(r)); await s.cerrarPersistencia();}
    await base.limpiar();
  }
});

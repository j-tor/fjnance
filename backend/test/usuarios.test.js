import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MongoClient} from 'mongodb';
import {createApp} from '../src/server.js';
import {protegerClave, verificarClave, cookieSesion, tokenPeticion} from '../src/autenticacion.js';
import {crearUsuarios} from '../src/usuarios.js';
import {crearAdministrador} from '../../scripts/crear-admin.mjs';
import {baseDePrueba, autenticarCliente} from './soporte-mongodb.js';
import {randomUUID} from 'node:crypto';

test('contraseñas: sal aleatoria, comparación y cookies seguras', async () => {
  const a = await protegerClave('Contraseña sintética 123'); const b = await protegerClave('Contraseña sintética 123');
  assert.notEqual(a, b); assert.ok(!a.includes('Contraseña')); assert.equal(await verificarClave('Contraseña sintética 123', a), true);
  assert.equal(await verificarClave('incorrecta', a), false); assert.equal(await verificarClave(null, a), false);
  await assert.rejects(protegerClave('corta')); await assert.rejects(protegerClave('x'.repeat(129)));
  assert.match(cookieSesion('token', {segura: true}), /HttpOnly; SameSite=Strict.*Secure/);
  assert.match(cookieSesion('', {borrar: true}), /Max-Age=0/);
  assert.equal(tokenPeticion({headers: {cookie: 'otra=1; fjnance_session=abc'}}), 'abc');
});

test('usuarios: aislamiento completo, sesiones, CSRF y administración', async () => {
  const base = await baseDePrueba(); const servidor = await createApp(base); const mongo = new MongoClient(base.mongoUri);
  await new Promise(r => servidor.listen(0, '127.0.0.1', r)); const url = `http://127.0.0.1:${servidor.address().port}`;
  async function pedir(cliente, ruta, metodo = 'GET', valor, csrf = cliente?.csrf) {
    const r = await fetch(url + '/api/' + ruta, {method: metodo, headers: {'Content-Type': 'application/json', ...(cliente ? {Cookie: cliente.cookie, 'X-CSRF-Token': csrf || ''} : {})}, body: valor === undefined ? undefined : JSON.stringify(valor)});
    return {status: r.status, datos: await r.json(), cookie: r.headers.get('set-cookie')};
  }
  try {
    await mongo.connect(); const db = mongo.db(base.mongoDatabase);
    for (const ruta of ['state', 'capital', 'expenses', 'subscriptions', 'receipts/id', 'admin/usuarios']) assert.equal((await pedir(null, ruta)).status, 401);
    assert.equal((await pedir(null, 'auth/registro', 'POST', {correo: 'a@b.test'})).status, 403);
    const a = await autenticarCliente(url, {nombre: 'Ana', correo: 'ana@example.test', clave: 'Contraseña Ana 123'});
    const b = await autenticarCliente(url, {nombre: 'Bruno', correo: 'bruno@example.test', clave: 'Contraseña Bruno 123'});
    const perfil = await pedir(a, 'auth/sesion'); assert.equal(perfil.status, 200); assert.equal(perfil.datos.usuario.id, a.usuario.id); assert.equal(perfil.datos.usuario.claveHash, undefined);
    const challenge = await pedir(null, 'auth/csrf');
    const rotada = await pedir({cookie: a.cookie + '; ' + challenge.cookie.split(';')[0], csrf: challenge.datos.csrf}, 'auth/acceso', 'POST', {correo: 'ana@example.test', clave: 'Contraseña Ana 123'});
    assert.equal(rotada.status, 200); assert.equal((await pedir(a, 'auth/sesion')).status, 401);
    a.cookie = rotada.cookie.split(';')[0]; a.csrf = rotada.datos.csrf;
    assert.equal((await pedir(a, 'auth/sesion')).status, 200);
    assert.equal((await pedir(null, 'capital', 'PUT', {amount: '1'})).status, 401);
    const userDoc = await db.collection('usuarios').findOne({_id: a.usuario.id});
    assert.match(userDoc.claveHash, /^[a-f0-9]{32}:/); assert.equal(userDoc.rol, 'usuario');
    const sesion = await db.collection('sesiones').findOne({usuarioId: a.usuario.id});
    assert.notEqual(sesion._id, a.cookie.split('=')[1]);
    assert.equal((await pedir(a, 'capital', 'PUT', {amount: '100'}, '')).status, 403);
    assert.equal((await pedir(a, 'capital', 'PUT', {amount: '100'})).status, 200);
    const gasto = {description: 'Privado Ana', amount: '5', date: '2020-01-01', method: 'Efectivo/Débito', category: 'Amigos', receipt: {name: 'a.pdf', type: 'application/pdf', base64: Buffer.from('%PDF-ana').toString('base64')}};
    const id = (await pedir(a, 'expenses', 'POST', gasto)).datos.expenses[0].id;
    const sid = (await pedir(a, 'subscriptions', 'POST', {name: 'Privada', amount: '1', day: 1, active: true})).datos.subscriptions[0].id;
    for (const [ruta, metodos] of [['expenses/' + id, ['GET', 'PUT', 'DELETE']], ['subscriptions/' + sid, ['GET', 'PUT', 'DELETE']], ['receipts/' + id, ['GET', 'PUT', 'DELETE']]]) {
      for (const metodo of metodos) {
        const entrada = ruta.startsWith('expenses') ? gasto : ruta.startsWith('subscriptions') ? {name: 'Otro', amount: '1', day: 1, active: true} : gasto.receipt;
        assert.equal((await pedir(b, ruta, metodo, metodo === 'PUT' ? entrada : undefined)).status, 404, ruta + ' ' + metodo);
      }
    }
    assert.deepEqual((await pedir(b, 'state')).datos.expenses, []); assert.equal((await pedir(b, 'capital')).datos.initialCapital, 0);
    await pedir(b, 'capital', 'PUT', {amount: '1', usuarioId: a.usuario.id});
    assert.equal((await pedir(a, 'capital')).datos.initialCapital, 10000);
    assert.equal((await pedir(a, 'admin/usuarios')).status, 403);
    assert.equal((await pedir(a, 'admin/auditoria')).status, 403);
    assert.equal((await pedir(a, 'admin/usuarios/' + b.usuario.id, 'PUT', {accion: 'bloquear'})).status, 403);
    const inicio = await pedir(null, 'auth/csrf'); const anon = {cookie: inicio.cookie.split(';')[0], csrf: inicio.datos.csrf};
    assert.equal((await pedir(anon, 'auth/registro', 'POST', {nombre: 'Intruso', correo: 'rol@ex.test', clave: 'Contraseña larga 123', rol: 'admin'})).status, 400);
    assert.equal((await pedir(anon, 'auth/registro', 'POST', {nombre: '', correo: 'invalido', clave: 'x'})).status, 400);
    const malo = await pedir(anon, 'auth/acceso', 'POST', {correo: 'ana@example.test', clave: 'incorrecta'});
    const ausente = await pedir(anon, 'auth/acceso', 'POST', {correo: 'noexiste@example.test', clave: 'incorrecta'});
    assert.equal(malo.status, 401); assert.deepEqual(malo.datos, ausente.datos);
    const adminDoc = await crearAdministrador({uri: base.mongoUri, nombre: base.mongoDatabase, entrada: {nombre: 'Administración', correo: 'admin@example.test', clave: 'Contraseña Admin 123'}});
    assert.equal(adminDoc.rol, 'admin'); assert.equal(adminDoc.claveHash, undefined);
    const admin = await autenticarCliente(url, {correo: 'admin@example.test', clave: 'Contraseña Admin 123'}, false);
    const lista = await pedir(admin, 'admin/usuarios?buscar=ana&pagina=1'); assert.equal(lista.status, 200); assert.equal(lista.datos.total, 1);
    assert.ok(!JSON.stringify(lista.datos).includes('claveHash'));
    assert.equal((await pedir(admin, 'admin/usuarios?pagina=0')).status, 400);
    await db.collection('usuarios').insertMany(Array.from({length: 22}, (_, i) => ({...userDoc, _id: randomUUID(), correo: `paginacion-${i}@example.test`, nombre: `Cuenta ${i}`})));
    const segunda = await pedir(admin, 'admin/usuarios?pagina=2');
    assert.equal(segunda.status, 200); assert.equal(segunda.datos.pagina, 2); assert.equal(segunda.datos.usuarios.length, 5);
    assert.equal((await pedir(admin, 'expenses/' + id)).status, 404);
    assert.equal((await pedir(admin, 'admin/usuarios/' + admin.usuario.id, 'PUT', {accion: 'bloquear'})).status, 403);
    assert.equal((await pedir(admin, 'admin/usuarios/' + randomUUID(), 'PUT', {accion: 'bloquear'})).status, 404);
    assert.equal((await pedir(admin, 'admin/usuarios/' + b.usuario.id, 'PUT', {accion: 'ascender'})).status, 400);
    assert.equal((await pedir(admin, 'admin/usuarios/' + b.usuario.id, 'PUT', {accion: 'bloquear'})).status, 200);
    assert.equal((await pedir(b, 'state')).status, 401);
    assert.equal((await pedir(anon, 'auth/acceso', 'POST', {correo: 'bruno@example.test', clave: 'Contraseña Bruno 123'})).status, 401);
    await pedir(admin, 'admin/usuarios/' + b.usuario.id, 'PUT', {accion: 'activar'});
    const nuevoB = await autenticarCliente(url, {correo: 'bruno@example.test', clave: 'Contraseña Bruno 123'}, false);
    assert.equal((await pedir(nuevoB, 'state')).status, 200);
    await pedir(admin, 'admin/usuarios/' + b.usuario.id, 'PUT', {accion: 'revocar'});
    assert.equal((await pedir(nuevoB, 'state')).status, 401);
    const eventos = (await pedir(admin, 'admin/auditoria')).datos; assert.equal(eventos.length, 3);
    assert.ok(eventos.every(e => e.actorId === admin.usuario.id && !e.clave && !e.correo));
    assert.equal((await pedir(a, 'auth/clave', 'PUT', {actual: 'incorrecta', nueva: 'Otra contraseña 123'})).status, 400);
    assert.equal((await pedir(a, 'auth/clave', 'PUT', {actual: 'Contraseña Ana 123', nueva: 'corta'})).status, 400);
    assert.equal((await pedir(a, 'auth/clave', 'PUT', {actual: 'Contraseña Ana 123', nueva: 'Otra contraseña 123'})).status, 200);
    // Incluso si falla la limpieza física, la versión anterior ya no autoriza.
    await db.collection('sesiones').insertOne(sesion);
    assert.equal((await pedir(a, 'state')).status, 401);
    const nuevaA = await autenticarCliente(url, {correo: 'ana@example.test', clave: 'Otra contraseña 123'}, false);
    assert.equal((await pedir(nuevaA, 'state')).datos.expenses.length, 1);
    await db.collection('sesiones').updateMany({usuarioId: nuevaA.usuario.id}, {$set: {expira: new Date(0)}});
    assert.equal((await pedir(nuevaA, 'state')).status, 401);
    const otra = await autenticarCliente(url, {correo: 'ana@example.test', clave: 'Otra contraseña 123'}, false);
    assert.equal((await pedir(otra, 'auth/salir', 'POST', {})).status, 200);
    assert.equal((await pedir(otra, 'auth/sesion')).status, 401);
    const servicio = crearUsuarios(db);
    for (let i = 0; i < 20; i++) await servicio.limitar('fixture-limite');
    await assert.rejects(servicio.limitar('fixture-limite'), {status: 429});
    // Colecciones de datos previos permanecen sin asignación ni lectura por las cuentas nuevas.
    assert.equal(await db.collection('estado').countDocuments({_id: 'principal'}), 1);
    assert.equal((await db.collection('estado').findOne()).valor.expenses.length, 0);
  } finally {await new Promise(r => servidor.close(r)); await servidor.cerrarPersistencia(); await mongo.close(); await base.limpiar();}
});

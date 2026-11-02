import {test} from 'node:test';
import assert from 'node:assert/strict';
import {abrirMongo} from '../src/persistencia-mongodb.js';
import {crearUsuarios} from '../src/usuarios.js';
import {sembrarDesarrollo, CUENTAS_DESARROLLO} from '../scripts/seed-desarrollo.mjs';
import {baseDePrueba} from './soporte-mongodb.js';

test('seed: crea y verifica dos cuentas, es repetible y conserva movimientos/otras cuentas', async () => {
  const base = await baseDePrueba(); const c = await abrirMongo({uri: base.mongoUri, nombre: base.mongoDatabase, inicial: {initialCapital: 0, expenses: [], subscriptions: []}});
  try {
    await sembrarDesarrollo(c.db); assert.equal(await c.db.collection('usuarios').countDocuments(), 2);
    const u = await c.db.collection('usuarios').findOne({correo: CUENTAS_DESARROLLO[1].correo});
    const propia = c.paraUsuario(u._id); const anterior = await propia.leer(); await propia.guardar({...anterior, initialCapital: 12345}, anterior);
    const servicio = crearUsuarios(c.db); const sesion = await servicio.nuevaSesion(u);
    const otro = await servicio.registrar({nombre: 'Otra cuenta', correo: 'otra@example.test', clave: 'Otra prueba 12345!'});
    await sembrarDesarrollo(c.db);
    assert.equal(await c.db.collection('usuarios').countDocuments(), 3);
    assert.equal((await servicio.acceder(CUENTAS_DESARROLLO[1]))._id, u._id);
    assert.equal((await propia.leer()).initialCapital, 12345);
    assert.ok(await c.db.collection('usuarios').findOne({_id: otro._id}));
    await assert.rejects(servicio.autenticar(sesion.token), {status: 401});
    await c.db.collection('usuarios').updateOne({_id: u._id}, {$set: {nombre: 'Identidad diferente'}});
    const versionAdmin = (await c.db.collection('usuarios').findOne({correo: CUENTAS_DESARROLLO[0].correo})).version;
    await assert.rejects(sembrarDesarrollo(c.db), /no coincide/);
    assert.equal((await c.db.collection('usuarios').findOne({correo: CUENTAS_DESARROLLO[0].correo})).version, versionAdmin);
  } finally {await c.cerrar(); await base.limpiar();}
});

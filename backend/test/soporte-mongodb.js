import {randomUUID} from 'node:crypto';
import {MongoClient} from 'mongodb';
import {createApp} from '../src/server.js';

const fetchReal = globalThis.fetch;
const clientes = new Map(); const temporales = new Map();
export async function fetchAutenticado(url, opciones = {}) {
  const cliente = clientes.get(new URL(url).origin);
  return fetchReal(url, {...opciones, headers: {...(cliente ? {Cookie: cliente.cookie, 'X-CSRF-Token': cliente.csrf} : {}), ...opciones.headers}});
}
export async function autenticarCliente(url, entrada = {nombre: 'Cuenta de prueba', correo: 'finanzas@example.test', clave: 'Prueba aislada 123!'}, registro = true) {
  const r = await fetchReal(url + '/api/auth/csrf'); const {csrf} = await r.json(); const cookie = r.headers.getSetCookie()[0].split(';')[0];
  const opciones = {method: 'POST', headers: {'Content-Type': 'application/json', Cookie: cookie, 'X-CSRF-Token': csrf}, body: JSON.stringify(entrada)};
  let acceso = await fetchReal(url + (registro ? '/api/auth/registro' : '/api/auth/acceso'), opciones);
  if (registro && acceso.status === 409) acceso = await fetchReal(url + '/api/auth/acceso', opciones);
  const datos = await acceso.json(); if (!acceso.ok) throw new Error('No se pudo autenticar la fixture: ' + acceso.status);
  const cliente = {cookie: acceso.headers.getSetCookie()[0].split(';')[0], csrf: datos.csrf, usuario: datos.usuario}; clientes.set(url, cliente); return cliente;
}
// Las suites financieras entran por la autenticación real. No existe un modo sin permisos.
export async function appDePrueba(opciones = {}) {
  let base = opciones;
  if (opciones.dataDir) {
    if (!temporales.has(opciones.dataDir)) temporales.set(opciones.dataDir, await baseDePrueba());
    base = temporales.get(opciones.dataDir);
  }
  const servidor = await createApp(base); const escuchar = servidor.listen.bind(servidor); const cerrar = servidor.close.bind(servidor);
  servidor.listen = (...args) => {
    const callback = typeof args.at(-1) === 'function' ? args.pop() : () => {};
    return escuchar(...args, async () => {try {await autenticarCliente(`http://127.0.0.1:${servidor.address().port}`); callback();} catch (e) {servidor.emit('error', e);}});
  };
  servidor.close = callback => cerrar(async error => {await servidor.cerrarPersistencia(); callback?.(error);});
  return servidor;
}
export async function limpiarAppsPrueba() {for (const base of temporales.values()) await base.limpiar(); temporales.clear(); clientes.clear();}

export async function baseDePrueba() {
  const uri = process.env.MONGODB_TEST_URI;
  if (!uri) throw new Error('Las pruebas MongoDB requieren MONGODB_TEST_URI; usa npm test desde la raíz.');
  const nombre = 'fjnance_test_' + randomUUID().replaceAll('-', '');
  return {mongoUri: uri, mongoDatabase: nombre, async limpiar() {
    if (!/^fjnance_test_[a-f0-9]{32}$/.test(nombre)) throw new Error('Limpieza de base no autorizada.');
    const cliente = new MongoClient(uri);
    try {await cliente.connect(); await cliente.db(nombre).dropDatabase();} finally {await cliente.close();}
  }};
}

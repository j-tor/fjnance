import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {get} from 'node:http';
import {fetchAutenticado, autenticarCliente} from '../backend/test/soporte-mongodb.js';
import {probarUsuariosUI} from './probar-usuarios-ui.mjs';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const proyecto = 'fjnance-prueba-' + randomBytes(6).toString('hex');
const usuario = 'pruebas';
const clave = randomBytes(32).toString('hex');
const entorno = {...process.env, MONGO_USUARIO: usuario, MONGO_CLAVE: clave, MONGO_USUARIO_URI: usuario, MONGO_CLAVE_URI: clave, MONGO_BASE: 'fjnance_prueba_contenedor', PUERTO_BACKEND: '0', PUERTO_FRONTEND: '0'};
const imagen = proyecto + ':pruebas';
function docker(args, extra = {}) {
  const r = spawnSync('docker', args, {env: entorno, encoding: 'utf8', windowsHide: true, ...extra});
  // No imprimir configuración expandida ni credenciales del entorno.
  for (const salida of [r.stdout, r.stderr]) if (salida?.trim()) console.log(salida.replaceAll(clave, '[oculto]'));
  if (r.error || r.status !== 0) throw new Error('Falló la comprobación Docker: ' + (r.error?.code || r.status));
  return r.stdout.trim();
}
const compose = args => docker(['compose', '-p', proyecto, ...args]);
const consultar = (url, opciones = {}) => fetchAutenticado(url, {...opciones, headers: {...opciones.headers, Connection: 'close'}});
function puertoPublicado(servicio = 'frontend', puerto = '80') {
  const id = compose(['ps', '-q', servicio]);
  const puertos = JSON.parse(docker(['inspect', '--format', '{{json .NetworkSettings.Ports}}', id]));
  const publicado = puertos[puerto + '/tcp'][0];
  assert.equal(publicado.HostIp, '127.0.0.1');
  assert.match(publicado.HostPort, /^[1-9]\d*$/);
  return publicado.HostPort;
}
try {
  compose(['config', '--quiet']);
  compose(['up', '--build', '-d', '--wait', '--wait-timeout', '180']);
  docker(['build', '-f', 'backend/Dockerfile', '--target', 'pruebas', '-t', imagen, '.']);
  entorno.MONGODB_TEST_URI = `mongodb://${usuario}:${clave}@mongodb:27017/?authSource=admin`;
  docker(['run', '--rm', '--network', proyecto + '_interna', '-e', 'MONGODB_TEST_URI', imagen]);
  const puerto = puertoPublicado();
  let url = 'http://127.0.0.1:' + puerto;
  assert.equal((await consultar(url)).status, 200);
  assert.match(await (await consultar(url)).text(), /<html/);
  const html = await (await consultar(url)).text();
  const recurso = html.match(/src="([^"]+\.js)"/)[1];
  assert.equal((await consultar(url + recurso)).status, 200);
  const urlBackend = 'http://127.0.0.1:' + puertoPublicado('backend', '3001');
  docker(['exec', compose(['ps', '-q', 'backend']), 'node', '-e', "process.exit(require('node:fs').existsSync('/app/frontend/dist') ? 1 : 0)"]);
  const raizBackend = await consultar(urlBackend);
  assert.equal(raizBackend.status, 404);
  assert.match(raizBackend.headers.get('content-type'), /application\/json/);
  assert.equal((await consultar(urlBackend + '/api/health')).status, 200);
  assert.equal((await consultar(url + '/api/state')).status, 401);
  await autenticarCliente(url);
  assert.equal((await consultar(url + '/api/no-existe')).status, 404);
  assert.equal((await consultar(url + '/assets/no-existe.js')).status, 404);
  assert.equal((await consultar(url + '/api/health')).status, 200);
  const r = await consultar(url + '/api/capital', {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({amount: '123.45'})});
  assert.equal(r.status, 200);
  const estado = await (await consultar(url + '/api/state')).json();
  const movimiento = {description: 'Proxy aislado', amount: '1.25', date: '2020-01-01', category: estado.categories[0], method: estado.methods[0]};
  const creado = await consultar(url + '/api/expenses', {method: 'POST', headers: {'Content-Type': 'application/json', Origin: url}, body: JSON.stringify(movimiento)});
  assert.equal(creado.status, 201);
  const idMovimiento = (await creado.json()).expenses[0].id;
  const bytes = Buffer.alloc(5 * 1024 * 1024, 32); bytes.write('%PDF-');
  const archivo = {name: 'proxy.pdf', type: 'application/pdf', base64: bytes.toString('base64')};
  const adjuntar = valor => consultar(url + '/api/receipts/' + idMovimiento, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(valor)});
  assert.equal((await adjuntar(archivo)).status, 200);
  assert.deepEqual(Buffer.from(await (await consultar(url + '/api/receipts/' + idMovimiento)).arrayBuffer()), bytes);
  assert.equal((await adjuntar({...archivo, type: 'incorrecto'})).status, 400);
  const excesivo = await consultar(url + '/api/receipts/' + idMovimiento, {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({base64: 'x'.repeat(7 * 1024 * 1024)})});
  assert.equal(excesivo.status, 413); assert.ok((await excesivo.json()).error);
  const estadoHost = await new Promise((resolve, reject) => {
    get(url + '/api/state', {headers: {Host: 'ajeno.example'}}, respuesta => {respuesta.resume(); resolve(respuesta.statusCode);}).on('error', reject);
  });
  assert.equal(estadoHost, 403);
  assert.equal((await consultar(url + '/api/capital', {method: 'PUT', headers: {'Content-Type': 'application/json', Origin: 'https://ajeno.example'}, body: '{"amount":"0"}'})).status, 403);
  compose(['restart', 'mongodb', 'backend']);
  compose(['up', '-d', '--wait', '--wait-timeout', '180']);
  url = 'http://127.0.0.1:' + puertoPublicado();
  await autenticarCliente(url, undefined, false);
  assert.equal((await (await consultar(url + '/api/state')).json()).initialCapital, 12345);
  compose(['down']);
  compose(['up', '-d', '--wait', '--wait-timeout', '180']);
  const nuevoPuerto = puertoPublicado();
  await autenticarCliente('http://127.0.0.1:' + nuevoPuerto, undefined, false);
  assert.equal((await (await consultar('http://127.0.0.1:' + nuevoPuerto + '/api/state')).json()).initialCapital, 12345);
  const idFrontend = compose(['ps', '-q', 'frontend']);
  const redesFrontend = JSON.parse(docker(['inspect', '--format', '{{json .NetworkSettings.Networks}}', idFrontend]));
  assert.ok(!Object.hasOwn(redesFrontend, proyecto + '_interna'));
  const idMongo = compose(['ps', '-q', 'mongodb']);
  const puertosMongo = JSON.parse(docker(['inspect', '--format', '{{json .NetworkSettings.Ports}}', idMongo]));
  assert.ok(Object.values(puertosMongo).every(v => v === null || Array.isArray(v) && v.length === 0));
  compose(['stop', 'mongodb']);
  assert.equal((await consultar('http://127.0.0.1:' + nuevoPuerto + '/api/health')).status, 500);
  const fallida = await consultar('http://127.0.0.1:' + nuevoPuerto + '/api/capital', {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({amount: '999'})});
  assert.equal(fallida.status, 500);
  compose(['up', '-d', '--wait', '--wait-timeout', '180']);
  assert.equal((await (await consultar('http://127.0.0.1:' + nuevoPuerto + '/api/state')).json()).initialCapital, 12345);
  compose(['stop', 'backend']);
  assert.equal((await consultar('http://127.0.0.1:' + nuevoPuerto)).status, 200);
  const sinBackend = await consultar('http://127.0.0.1:' + nuevoPuerto + '/api/state');
  assert.equal(sinBackend.status, 502); assert.ok((await sinBackend.json()).error);
  compose(['up', '-d', '--wait', '--wait-timeout', '180']);
  assert.equal((await consultar('http://127.0.0.1:' + puertoPublicado() + '/api/health')).status, 200);
  const admin = {nombre:'Administrador de pruebas', correo:'admin-ui@example.test', clave:'Admin de prueba 123!'};
  docker(['exec', '-i', compose(['ps', '-q', 'backend']), 'node', 'scripts/crear-admin.mjs'], {input: JSON.stringify(admin)});
  await probarUsuariosUI({url: 'http://127.0.0.1:' + puertoPublicado(), proyecto});
  const logsFrontend = docker(['logs', compose(['ps', '-q', 'frontend'])]);
  assert.ok(!logsFrontend.includes('/api/admin/usuarios?'), 'Búsquedas administrativas fuera de logs');
  console.log('APROBADO: interfaz, API, suite completa, reinicios y volumen aislado persistente.');
} finally {
  // El nombre aleatorio solo identifica recursos creados por esta ejecución.
  compose(['down', '--volumes', '--remove-orphans', '--rmi', 'local']);
  try {docker(['image', 'rm', imagen]);} catch {console.error('No se pudo retirar la imagen de pruebas; comprueba si llegó a construirse.');}
}

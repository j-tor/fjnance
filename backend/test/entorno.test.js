import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {configurarEntorno, ejecutarEntorno} from '../../scripts/entorno.mjs';

const contenedor = (servicio, env = []) => ({Id: servicio + '-id', Config: {Labels: {'com.docker.compose.service': servicio}, Env: env}});
test('configuración: inicialización nueva, credenciales guardadas y protección de volumen', () => {
  const nueva = configurarEntorno({generarClave: () => 'clave-sintetica'});
  assert.equal(nueva.MONGO_USUARIO, 'fjnance_admin'); assert.equal(nueva.MONGO_CLAVE, 'clave-sintetica');
  const existentes = [contenedor('mongodb', ['MONGO_INITDB_ROOT_USERNAME=usuario@local', 'MONGO_INITDB_ROOT_PASSWORD=sintetica=a:b']), contenedor('aplicacion', ['MONGODB_DATABASE=conservada'])];
  const conservada = configurarEntorno({contenedores: existentes, volumenExiste: true, variables: {MONGO_CLAVE: 'otra'}});
  assert.equal(conservada.MONGO_USUARIO_URI, 'usuario%40local'); assert.equal(conservada.MONGO_CLAVE_URI, 'sintetica%3Da%3Ab'); assert.equal(conservada.MONGO_BASE, 'conservada');
  assert.throws(() => configurarEntorno({volumenExiste: true}), /volumen existe/);
  assert.throws(() => configurarEntorno({variables: {MONGO_USUARIO: 'solo'}}), /Falta una credencial/);
  const externas = configurarEntorno({volumenExiste: true, variables: {MONGO_USUARIO: 'original', MONGO_CLAVE: 'original'}});
  assert.equal(externas.MONGO_USUARIO, 'original');
});

test('comando CLI: argumento inválido y Docker ausente fallan sin exponer configuración', () => {
  const archivo = fileURLToPath(new URL('../../scripts/entorno.mjs', import.meta.url));
  const invalido = spawnSync(process.execPath, [archivo, 'borrar'], {encoding: 'utf8'});
  assert.equal(invalido.status, 1); assert.match(invalido.stderr, /Uso:/);
  const entorno = Object.fromEntries(Object.entries(process.env).filter(([clave]) => clave.toLowerCase() !== 'path'));
  entorno.PATH = '';
  const ausente = spawnSync(process.execPath, [archivo, 'status'], {env: entorno, encoding: 'utf8'});
  assert.equal(ausente.status, 1); assert.match(ausente.stderr, /Docker no pudo completar ps/);
  assert.equal(ausente.stdout, '');
});

test('arranque: compila antes de detener servicio previo y conserva volumen/credenciales sin mostrarlas', () => {
  const llamadas = []; const existentes = [contenedor('mongodb', ['MONGO_INITDB_ROOT_USERNAME=usuario', 'MONGO_INITDB_ROOT_PASSWORD=sintetica']), contenedor('aplicacion')];
  const ejecutar = (args, env) => {
    llamadas.push({args, env});
    if (args[0] === 'ps') return 'mongo-id app-id';
    if (args[0] === 'inspect') return JSON.stringify(existentes);
    if (args[0] === 'volume') return 'fjnance_datos_mongodb';
    return '';
  };
  const resultado = ejecutarEntorno({ejecutar, variables: {}});
  const compilar = llamadas.findIndex(c => c.args.includes('build')); const parar = llamadas.findIndex(c => c.args[0] === 'stop');
  assert.ok(compilar < parar); assert.equal(llamadas[parar].args[1], 'aplicacion-id');
  assert.equal(llamadas.at(-1).env.MONGO_CLAVE, 'sintetica'); assert.ok(llamadas.at(-1).args.includes('--remove-orphans'));
  assert.ok(!llamadas.some(c => c.args.includes('--volumes'))); assert.ok(!resultado.includes('sintetica'));
  llamadas.length = 0; ejecutarEntorno({accion: 'stop', ejecutar, variables: {}});
  assert.ok(llamadas.at(-1).args.includes('stop')); assert.ok(!llamadas.some(c => c.args.includes('up')));
  llamadas.length = 0; ejecutarEntorno({accion: 'status', ejecutar, variables: {}});
  assert.ok(!llamadas.some(c => c.args[0] === 'inspect'));
  assert.throws(() => ejecutarEntorno({accion: 'borrar', ejecutar}), /Uso:/);
  assert.throws(() => ejecutarEntorno({ejecutar: () => {throw new Error('Docker inaccesible');}}), /Docker inaccesible/);
});

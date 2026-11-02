import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const raiz = fileURLToPath(new URL('../', import.meta.url));
export function configurarEntorno({variables = {}, contenedores = [], volumenExiste = false, generarClave = () => randomBytes(32).toString('hex')} = {}) {
  const mongo = contenedores.find(c => c.Config?.Labels?.['com.docker.compose.service'] === 'mongodb');
  const guardadas = Object.fromEntries((mongo?.Config?.Env || []).map(v => {const i = v.indexOf('='); return [v.slice(0, i), v.slice(i + 1)];}));
  let usuario = guardadas.MONGO_INITDB_ROOT_USERNAME || variables.MONGO_USUARIO;
  let clave = guardadas.MONGO_INITDB_ROOT_PASSWORD || variables.MONGO_CLAVE;
  if (!!usuario !== !!clave) throw new Error('Falta una credencial de MongoDB. No se cambiará el volumen.');
  if (!usuario || !clave) {
    if (volumenExiste) throw new Error('El volumen existe pero no hay credenciales recuperables. Proporciona las credenciales originales; no se reinicializarán datos.');
    usuario = 'fjnance_admin'; clave = generarClave();
  }
  const backend = contenedores.find(c => ['backend', 'aplicacion'].includes(c.Config?.Labels?.['com.docker.compose.service']));
  const baseGuardada = backend?.Config?.Env?.find(v => v.startsWith('MONGODB_DATABASE='))?.slice('MONGODB_DATABASE='.length);
  return {...variables, MONGO_USUARIO: usuario, MONGO_CLAVE: clave, MONGO_USUARIO_URI: encodeURIComponent(usuario), MONGO_CLAVE_URI: encodeURIComponent(clave), MONGO_BASE: baseGuardada || variables.MONGO_BASE || 'fjnance'};
}

function docker(args, entorno) {
  const r = spawnSync('docker', args, {cwd: raiz, env: entorno, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024});
  if (r.error || r.status !== 0) throw new Error('Docker no pudo completar ' + args.slice(0, 2).join(' ') + '. Revisa Docker Desktop y el estado de los servicios.');
  return r.stdout.trim();
}

export function ejecutarEntorno({accion = 'up', ejecutar = docker, variables = process.env} = {}) {
  if (!['up', 'stop', 'status'].includes(accion)) throw new Error('Uso: node scripts/entorno.mjs [up|stop|status]');
  const ids = ejecutar(['ps', '-a', '--filter', 'label=com.docker.compose.project=fjnance', '--format', '{{.ID}}'], variables).split(/\s+/).filter(Boolean);
  if (accion === 'status') return ejecutar(['ps', '-a', '--filter', 'label=com.docker.compose.project=fjnance', '--format', '{{.Names}} {{.Status}} {{.Ports}}'], variables);
  const contenedores = ids.length ? JSON.parse(ejecutar(['inspect', ...ids], variables)) : [];
  const volumenes = ejecutar(['volume', 'ls', '--format', '{{.Name}}'], variables).split(/\s+/);
  const entorno = configurarEntorno({variables, contenedores, volumenExiste: volumenes.includes('fjnance_datos_mongodb')});
  const compose = args => ejecutar(['compose', '-p', 'fjnance', ...args], entorno);
  if (accion === 'stop') {compose(['stop']); return 'Servicios detenidos; contenedores y volumen conservados.';}
  compose(['config', '--quiet']);
  // Compilar antes de detener el servicio anterior; no imprimir inspect ni variables.
  compose(['build']);
  const anterior = contenedores.find(c => c.Config?.Labels?.['com.docker.compose.service'] === 'aplicacion');
  if (anterior) ejecutar(['stop', anterior.Id], entorno);
  compose(['up', '-d', '--wait', '--wait-timeout', '180', '--remove-orphans']);
  return `Servicios iniciados: frontend http://localhost:${entorno.PUERTO_FRONTEND || 3002}; backend http://localhost:${entorno.PUERTO_BACKEND || 3001}. Credenciales y volumen conservados en Docker.`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {console.log(ejecutarEntorno({accion: process.argv[2] || 'up'}));}
  catch (error) {console.error(error.message); process.exitCode = 1;}
}

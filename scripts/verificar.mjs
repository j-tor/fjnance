import {spawnSync} from 'node:child_process';
import {readFileSync, readdirSync, mkdirSync, appendFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const raiz = fileURLToPath(new URL('../', import.meta.url));
process.chdir(raiz);
const argumentos = process.argv.slice(2);
const modo = argumentos[0] || '--completo';
if (argumentos.length > 1 || !['--estado', '--rapido', '--completo', '--estricto'].includes(modo)) {
  console.error('Uso: init.sh | init.ps1 [--estado|--rapido|--completo|--estricto]');
  process.exit(1);
}
mkdirSync('.arnes', {recursive: true});
const log = path.join('.arnes', `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}.log`);
function informar(texto) {
  console.log(texto);
  appendFileSync(log, `${texto}\n`);
}
function ejecutar(comando, args, cwd = raiz) {
  informar(`> ${comando} ${args.join(' ')}`);
  const resultado = spawnSync(comando, args, {cwd, encoding: 'utf8', windowsHide: true});
  if (resultado.stdout) informar(resultado.stdout.trimEnd());
  if (resultado.stderr) informar(resultado.stderr.trimEnd());
  if (resultado.error || resultado.status !== 0) throw new Error(resultado.error?.message || `Falló ${comando} (código ${resultado.status}).`);
  return resultado.stdout.trim();
}
function exigir(condicion, mensaje) { if (!condicion) throw new Error(mensaje); }
const leer = archivo => JSON.parse(readFileSync(archivo, 'utf8'));
function validarFeatures() {
  const datos = leer('feature_list.json');
  const estados = ['propuesta', 'pendiente', 'en_curso', 'en_revision', 'hecha', 'bloqueada', 'descartada'];
  const idValido = id => typeof id === 'string' && /^F[1-9]\d*$/.test(id);
  exigir(datos.proyecto === leer('package.json').name && idValido(datos.siguiente_id), 'Proyecto o siguiente_id inválido.');
  exigir(Array.isArray(datos.features) && Array.isArray(datos.ids_retirados), 'Faltan listas de features o IDs retirados.');
  exigir(datos.reglas?.una_feature_activa === true && datos.reglas?.requiere_aprobacion_del_usuario === true && datos.reglas?.requiere_revision_aprobada === true, 'Las reglas obligatorias deben estar activas.');
  exigir(JSON.stringify(datos.reglas.estados) === JSON.stringify(estados), 'Estados no válidos.');
  const ids = [...datos.ids_retirados];
  for (const feature of datos.features) {
    exigir(feature && idValido(feature.id) && estados.includes(feature.estado), 'Feature con ID o estado inválido.');
    exigir(typeof feature.titulo === 'string' && feature.titulo.trim() && Array.isArray(feature.criterios) && feature.criterios.length && feature.criterios.every(c => typeof c === 'string' && c.trim()) && Array.isArray(feature.archivos) && feature.archivos.every(a => typeof a === 'string' && a.trim()), `Falta título, criterios o archivos en ${feature.id}.`);
    ids.push(feature.id);
  }
  exigir(ids.every(idValido) && new Set(ids).size === ids.length, 'IDs inválidos, duplicados o reutilizados.');
  exigir(ids.every(id => Number(id.slice(1)) < Number(datos.siguiente_id.slice(1))), 'siguiente_id debe superar todos los IDs asignados y retirados.');
  const activas = datos.features.filter(f => ['en_curso', 'en_revision'].includes(f.estado));
  const excepcion = datos.excepciones?.find(e => e.id === 'F1-F2' && e.aprobacion_usuario && JSON.stringify(e.features) === JSON.stringify(['F1', 'F2']));
  const excepcionTres = datos.excepciones?.find(e => e.id === 'F1-F2-F3' && e.aprobacion_usuario && JSON.stringify(e.features) === JSON.stringify(['F1', 'F2', 'F3']));
  const excepcionCuatro = datos.excepciones?.find(e => e.id === 'F1-F2-F3-F4' && e.aprobacion_usuario && JSON.stringify(e.features) === JSON.stringify(['F1', 'F2', 'F3', 'F4']));
  const excepcionAplicable = (excepcion && activas.length === 2 && activas.some(f => f.id === 'F1' && f.estado === 'en_revision') && activas.some(f => f.id === 'F2')) ||
    (excepcionTres && activas.length === 3 && ['F1', 'F2'].every(id => activas.some(f => f.id === id && f.estado === 'en_revision')) && activas.some(f => f.id === 'F3')) ||
    (excepcionCuatro && activas.length === 4 && ['F1', 'F2', 'F3'].every(id => activas.some(f => f.id === id && f.estado === 'en_revision')) && activas.some(f => f.id === 'F4'));
  exigir(activas.length <= 1 || excepcionAplicable, 'Solo puede existir una feature activa sin excepción explícita aplicable.');
  if (excepcionAplicable) informar('Excepción autorizada por el usuario para features en revisión: ' + activas.map(f => f.id).join('/'));
  informar('Registro de features válido.');
}
function archivos(directorio) {
  return readdirSync(directorio, {withFileTypes: true}).flatMap(entrada => {
    if (['node_modules', 'dist', '.git', '.arnes'].includes(entrada.name)) return [];
    const nombre = path.join(directorio, entrada.name);
    return entrada.isDirectory() ? archivos(nombre) : [nombre];
  });
}
try {
  informar(`Verificación ${modo}; ${new Date().toISOString()}`);
  exigir(Number(process.versions.node.split('.')[0]) >= 22, 'Se requiere Node.js >=22.');
  validarFeatures();
  ejecutar('git', ['rev-parse', '--show-toplevel']);
  ejecutar('git', ['branch', '--show-current']);
  const estado = ejecutar('git', ['status', '--porcelain=v1', '--untracked-files=all']);
  informar(estado ? 'Árbol con cambios (permitidos salvo en --estricto).' : 'Árbol limpio.');
  if (modo !== '--estado') {
    // npm.cmd evita depender de la política de ejecución de npm.ps1 en Windows.
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    function ejecutarNpm(args, directorio = '.') {
      if (process.platform === 'win32') return ejecutar('cmd.exe', ['/d', '/s', '/c', `${npm} ${args.join(' ')}`], path.resolve(directorio));
      return ejecutar(npm, args, path.resolve(directorio));
    }
    ejecutarNpm(['--version']);
    for (const directorio of ['.', 'backend', 'frontend']) {
      ejecutarNpm(['ls', '--depth=0'], directorio);
      const scripts = leer(path.join(directorio, 'package.json')).scripts || {};
      for (const chequeo of ['lint', 'typecheck']) {
        if (scripts[chequeo]) ejecutarNpm(['run', chequeo], directorio);
        else informar(`${directorio}: ${chequeo} NO CONFIGURADO (no equivale a una validación aprobada).`);
      }
    }
    for (const archivo of ['backend', 'frontend', 'shared', 'scripts'].flatMap(archivos).filter(a => /\.(?:js|mjs)$/.test(a))) ejecutar(process.execPath, ['--check', archivo]);
    const {transformWithEsbuild} = await import('../frontend/node_modules/vite/dist/node/index.js');
    for (const archivo of archivos('frontend/src').filter(a => a.endsWith('.jsx'))) {
      await transformWithEsbuild(readFileSync(archivo, 'utf8'), archivo, {loader: 'jsx'});
      informar(`Sintaxis JSX válida: ${archivo}`);
    }
    if (modo !== '--rapido') {
      ejecutarNpm(['test']);
      ejecutarNpm(['run', 'build']);
    }
  }
  if (modo === '--estricto') {
    exigir(!ejecutar('git', ['status', '--porcelain=v1', '--untracked-files=all']), 'El modo estricto exige un árbol completamente limpio.');
    const upstream = ejecutar('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
    const remoto = ejecutar('git', ['config', '--get', 'branch.' + ejecutar('git', ['branch', '--show-current']) + '.remote']);
    exigir(remoto !== '.', 'Se requiere un remoto real para verificar sincronización.');
    ejecutar('git', ['fetch', '--prune', remoto]);
    exigir(ejecutar('git', ['rev-list', '--left-right', '--count', `HEAD...${upstream}`]).split(/\s+/).every(n => n === '0'), 'HEAD y upstream no están sincronizados.');
  }
  informar(`VALIDACIONES DISPONIBLES APROBADAS. Log: ${log}`);
} catch (error) {
  informar(`BLOQUEADO: ${error.message}`);
  process.exitCode = 1;
}

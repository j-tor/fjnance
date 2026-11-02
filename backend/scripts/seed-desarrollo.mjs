import {crearUsuarios} from '../src/usuarios.js';
import {protegerClave} from '../src/autenticacion.js';
import {abrirMongo} from '../src/persistencia-mongodb.js';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// Credenciales literales de prueba solicitadas expresamente para desarrollo.
export const CUENTAS_DESARROLLO = [
  {nombre: 'admin', correo: 'admin@example.test', clave: 'AdminPrueba123!', rol: 'admin'},
  {nombre: 'Jeffrey Torres', correo: 'jeffrey.torres@example.test', clave: 'JeffreyPrueba123!', rol: 'usuario'},
];

export async function sembrarDesarrollo(db) {
  const usuarios = db.collection('usuarios');
  // Validar ambas identidades antes de modificar nada; no promover otras cuentas.
  for (const cuenta of CUENTAS_DESARROLLO) {
    const existente = await usuarios.findOne({correo: cuenta.correo});
    if (existente && (existente.nombre !== cuenta.nombre || existente.rol !== cuenta.rol)) throw new Error('Una cuenta destino no coincide con la identidad de desarrollo. No se aplicó el seed.');
  }
  const servicio = crearUsuarios(db);
  for (const {rol, ...entrada} of CUENTAS_DESARROLLO) {
    const existente = await usuarios.findOne({correo: entrada.correo});
    if (existente) {
      await usuarios.updateOne({_id: existente._id, correo: entrada.correo, rol}, {$set: {claveHash: await protegerClave(entrada.clave), activo: true}, $inc: {version: 1}});
      await db.collection('sesiones').deleteMany({usuarioId: existente._id});
    } else await servicio.registrar(entrada, rol);
  }
  // Comprobar claves y roles sin escribir movimientos ni imprimir contraseñas.
  for (const cuenta of CUENTAS_DESARROLLO) {
    const usuario = await servicio.acceder(cuenta);
    if (usuario.rol !== cuenta.rol) throw new Error('El rol creado no coincide.');
  }
  return CUENTAS_DESARROLLO.map(({nombre, correo, rol}) => ({nombre, correo, rol}));
}

export async function ejecutarSeed() {
  const conexion = await abrirMongo({uri: process.env.MONGODB_URI, nombre: process.env.MONGODB_DATABASE, inicial: {initialCapital: 0, expenses: [], subscriptions: []}});
  try {await sembrarDesarrollo(conexion.db); console.log('Seed aplicado y verificado: admin y Jeffrey Torres.');}
  finally {await conexion.cerrar();}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.env.MONGODB_URI) await ejecutarSeed();
    else {
      const codigo = readFileSync(fileURLToPath(import.meta.url), 'utf8').replaceAll("'../src/", "'./src/") + '\nawait ejecutarSeed();\n';
      const r = spawnSync('docker', ['exec', '-i', '-w', '/app/backend', 'fjnance-backend-1', 'node', '--input-type=module'], {input: codigo, encoding: 'utf8', windowsHide: true});
      if (r.status !== 0) throw new Error('No se pudo aplicar el seed. Comprueba que el backend esté iniciado y las cuentas destino coincidan.');
      console.log(r.stdout.trim());
    }
  } catch (error) {console.error(error.message); process.exitCode = 1;}
}

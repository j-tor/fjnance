import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {abrirMongo} from '../backend/src/persistencia-mongodb.js';
import {crearUsuarios, publico} from '../backend/src/usuarios.js';

export async function crearAdministrador({uri, nombre, entrada}) {
  const conexion = await abrirMongo({uri, nombre, inicial: {initialCapital: 0, expenses: [], subscriptions: []}});
  try {
    const usuario = await crearUsuarios(conexion.db).registrar(entrada, 'admin');
    return publico(usuario);
  } finally {await conexion.cerrar();}
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    let texto = ''; for await (const parte of process.stdin) {texto += parte; if (texto.length > 8192) throw new Error('Entrada excesiva.');}
    const entrada = JSON.parse(texto);
    await crearAdministrador({uri: process.env.MONGODB_URI, nombre: process.env.MONGODB_DATABASE, entrada});
    console.log('Administrador creado. Accede con las credenciales proporcionadas.');
  } catch {console.error('No se pudo crear el administrador. Comprueba conexión, correo no registrado y contraseña de 12 a 128 caracteres.'); process.exitCode = 1;}
}

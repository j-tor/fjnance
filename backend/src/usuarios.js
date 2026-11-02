import {randomUUID, randomBytes} from 'node:crypto';
import {errorUsuario, protegerClave, verificarClave, huella} from './autenticacion.js';

export const publico = u => ({id: u._id, nombre: u.nombre, correo: u.correo, rol: u.rol, activo: u.activo, creado: u.creado});
const correoValido = valor => {
  if (typeof valor !== 'string' || valor.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) throw errorUsuario('Ingresa un correo válido.');
  return valor.trim().toLowerCase();
};
export function crearUsuarios(db) {
  const usuarios = db.collection('usuarios'); const sesiones = db.collection('sesiones');
  const auditoria = db.collection('auditoria'); const intentos = db.collection('intentos_acceso');
  // El hash ficticio iguala el trabajo de una cuenta inexistente sin guardar una contraseña real.
  const ficticia = '0'.repeat(32) + ':' + '0'.repeat(128);
  async function limitar(clave) {
    const ahora = new Date();
    const id = huella(clave + ':' + Math.floor(ahora.getTime() / 900000));
    const registro = await intentos.findOneAndUpdate({_id: id}, {$inc: {cantidad: 1}, $setOnInsert: {expira: new Date(ahora.getTime() + 1800000)}}, {upsert: true, returnDocument: 'after'});
    if (registro.cantidad > 20) throw errorUsuario('Demasiados intentos. Espera unos minutos antes de volver a intentar.', 429);
  }
  async function registrar(entrada, rol = 'usuario') {
    if (Object.hasOwn(entrada, 'rol') || Object.hasOwn(entrada, 'activo')) throw errorUsuario('No puedes asignar permisos al registrarte.');
    if (typeof entrada.nombre !== 'string' || !entrada.nombre.trim() || entrada.nombre.trim().length > 80) throw errorUsuario('Ingresa un nombre de hasta 80 caracteres.');
    const correo = correoValido(entrada.correo);
    const claveHash = await protegerClave(entrada.clave);
    const usuario = {_id: randomUUID(), nombre: entrada.nombre.trim(), correo, claveHash, rol, activo: true, version: 0, creado: new Date()};
    try {await usuarios.insertOne(usuario);} catch (e) {if (e.code === 11000) throw errorUsuario('No se pudo crear la cuenta con esos datos.', 409); throw e;}
    return usuario;
  }
  async function acceder(entrada) {
    let correo;
    try {correo = correoValido(entrada.correo);} catch {correo = '';}
    const usuario = await usuarios.findOne({correo});
    const correcta = await verificarClave(entrada.clave, usuario?.claveHash || ficticia);
    if (!usuario || !correcta || !usuario.activo) throw errorUsuario('Correo o contraseña incorrectos.', 401);
    return usuario;
  }
  async function nuevaSesion(usuario, anterior) {
    if (anterior) await sesiones.deleteOne({_id: huella(anterior)});
    const token = randomBytes(32).toString('hex'); const csrf = randomBytes(32).toString('hex');
    await sesiones.insertOne({_id: huella(token), usuarioId: usuario._id, version: usuario.version, csrfHash: huella(csrf), csrf, expira: new Date(Date.now() + 28800000)});
    return {token, csrf};
  }
  async function autenticar(token) {
    if (!/^[a-f0-9]{64}$/.test(token)) throw errorUsuario('Inicia sesión para continuar.', 401);
    const sesion = await sesiones.findOne({_id: huella(token), expira: {$gt: new Date()}});
    const usuario = sesion && await usuarios.findOne({_id: sesion.usuarioId, activo: true, version: sesion.version});
    if (!usuario) throw errorUsuario('Tu sesión terminó. Vuelve a acceder.', 401);
    return {usuario, sesion};
  }
  function comprobarCsrf(sesion, token) {
    if (typeof token !== 'string' || token.length !== 64 || huella(token) !== sesion.csrfHash) throw errorUsuario('La solicitud expiró. Recarga la página e inténtalo de nuevo.', 403);
  }
  async function cambiarClave(usuario, entrada) {
    if (!await verificarClave(entrada.actual, usuario.claveHash)) throw errorUsuario('La contraseña actual es incorrecta.', 400);
    const claveHash = await protegerClave(entrada.nueva);
    const resultado = await usuarios.updateOne({_id: usuario._id, claveHash: usuario.claveHash}, {$set: {claveHash}, $inc: {version: 1}});
    if (!resultado.matchedCount) throw errorUsuario('La cuenta cambió. Vuelve a acceder.', 409);
    await sesiones.deleteMany({usuarioId: usuario._id});
  }
  async function administrar(actor, id, accion) {
    if (actor.rol !== 'admin') throw errorUsuario('No tienes permiso para esta acción.', 403);
    const destino = await usuarios.findOne({_id: id});
    if (!destino) throw errorUsuario('Usuario no encontrado.', 404);
    if (destino._id === actor._id || destino.rol === 'admin') throw errorUsuario('Esta acción no está permitida sobre administradores.', 403);
    if (!['bloquear', 'activar', 'revocar'].includes(accion)) throw errorUsuario('Acción inválida.');
    // Registrar intención antes de cambiar acceso: una auditoría fallida no confirma acciones.
    await auditoria.insertOne({_id: randomUUID(), actorId: actor._id, usuarioId: id, accion, fecha: new Date()});
    await usuarios.updateOne({_id: id, rol: 'usuario'}, {$inc: {version: 1}, ...(accion !== 'revocar' ? {$set: {activo: accion === 'activar'}} : {})});
    await sesiones.deleteMany({usuarioId: id});
  }
  async function listar(busqueda, pagina) {
    if (typeof busqueda !== 'string' || busqueda.length > 80 || !Number.isInteger(pagina) || pagina < 1 || pagina > 100000) throw errorUsuario('Búsqueda o página inválida.');
    const filtro = busqueda ? {$or: ['nombre', 'correo'].map(campo => ({[campo]: {$regex: busqueda.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i'}}))} : {};
    const total = await usuarios.countDocuments(filtro);
    const lista = await usuarios.find(filtro, {projection: {claveHash: 0}}).sort({creado: -1, _id: 1}).skip((pagina - 1) * 20).limit(20).toArray();
    return {usuarios: lista.map(publico), total, pagina, paginas: Math.max(1, Math.ceil(total / 20))};
  }
  return {limitar, registrar, acceder, nuevaSesion, autenticar, comprobarCsrf, cambiarClave, administrar, listar,
    salir: token => sesiones.deleteOne({_id: huella(token)}),
    historial: () => auditoria.find({}, {projection: {_id: 0}}).sort({fecha: -1}).limit(100).toArray()};
}

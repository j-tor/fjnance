import {randomBytes, scrypt as derivar, timingSafeEqual, createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt = promisify(derivar);
export const errorUsuario = (mensaje, status = 400) => Object.assign(new Error(mensaje), {status});
export const huella = texto => createHash('sha256').update(texto).digest('hex');
export function validarClave(clave) {
  if (typeof clave !== 'string' || clave.length < 12 || clave.length > 128) throw errorUsuario('Usa una contraseña de 12 a 128 caracteres.');
}
export async function protegerClave(clave) {
  validarClave(clave);
  const sal = randomBytes(16).toString('hex');
  const hash = await scrypt(clave, sal, 64, {N: 16384, r: 8, p: 5, maxmem: 64 * 1024 * 1024});
  return `${sal}:${hash.toString('hex')}`;
}
export async function verificarClave(clave, guardada) {
  if (typeof clave !== 'string' || clave.length > 128) return false;
  const [sal, hash] = guardada.split(':');
  const calculada = await scrypt(clave, sal, 64, {N: 16384, r: 8, p: 5, maxmem: 64 * 1024 * 1024});
  const esperada = Buffer.from(hash, 'hex');
  return esperada.length === calculada.length && timingSafeEqual(esperada, calculada);
}
export function cookieSesion(token, {segura = false, borrar = false} = {}) {
  return `fjnance_session=${borrar ? '' : token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${borrar ? 0 : 28800}${segura ? '; Secure' : ''}`;
}
export function tokenPeticion(req) {
  const cookie = req.headers.cookie || '';
  return cookie.split(';').map(v => v.trim()).find(v => v.startsWith('fjnance_session='))?.slice('fjnance_session='.length) || '';
}

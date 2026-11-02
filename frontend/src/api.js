// El token CSRF vive solo en memoria; la cookie de sesión es HttpOnly.
let csrf = '';
async function solicitar(ruta, opciones, binario = false) {
  const marcaSesion = csrf;
  let respuesta;
  try {
    respuesta = await fetch(`/api/${ruta}`, opciones && {
      method: opciones.method || 'POST', headers: {'Content-Type': 'application/json', ...(csrf ? {'X-CSRF-Token': csrf} : {})}, body: JSON.stringify(opciones.body),
    });
  } catch {throw new Error('No se pudo conectar con el servidor.');}
  if (!respuesta.ok) {
    if (respuesta.status === 401 && marcaSesion === csrf && !['auth/acceso', 'auth/registro', 'auth/sesion'].includes(ruta) && typeof window !== 'undefined') window.dispatchEvent(new Event('sesion-expirada'));
    let mensaje = 'No se pudo completar la operación.';
    try {mensaje = (await respuesta.json()).error || mensaje;} catch { /* Un proxy puede devolver un error sin JSON. */ }
    throw Object.assign(new Error(mensaje), {status: respuesta.status});
  }
  try {const datos = await (binario ? respuesta.blob() : respuesta.json()); if (datos.csrf) csrf = datos.csrf; return datos;}
  catch {throw new Error('El servidor devolvió una respuesta inválida.');}
}
export const api = (ruta, opciones) => solicitar(ruta, opciones);
const segmento = id => {
  if (typeof id !== 'string' || !id.trim()) throw new Error('Identificador requerido.');
  return encodeURIComponent(id);
};
export const obtenerEstado = () => api('state');
export const obtenerSalud = () => api('health');
export const obtenerCapital = () => api('capital');
export const actualizarCapital = amount => api('capital', {method: 'PUT', body: {amount}});
export const obtenerMovimientos = () => api('expenses');
export const obtenerMovimiento = id => api(`expenses/${segmento(id)}`);
export const crearMovimiento = valor => api('expenses', {method: 'POST', body: valor});
export const actualizarMovimiento = (id, valor) => api(`expenses/${segmento(id)}`, {method: 'PUT', body: valor});
export const eliminarMovimiento = id => api(`expenses/${segmento(id)}`, {method: 'DELETE', body: {}});
export const obtenerSuscripciones = () => api('subscriptions');
export const obtenerSuscripcion = id => api(`subscriptions/${segmento(id)}`);
export const crearSuscripcion = valor => api('subscriptions', {method: 'POST', body: valor});
export const actualizarSuscripcion = (id, valor) => api(`subscriptions/${segmento(id)}`, {method: 'PUT', body: valor});
export const eliminarSuscripcion = id => api(`subscriptions/${segmento(id)}`, {method: 'DELETE', body: {}});
export const obtenerCategorias = () => api('categories');
export const obtenerMetodos = () => api('methods');
export const descargarComprobante = id => solicitar(`receipts/${segmento(id)}`, undefined, true);
export const guardarComprobante = (id, archivo) => api(`receipts/${segmento(id)}`, {method: 'PUT', body: archivo});
export const eliminarComprobante = id => api(`receipts/${segmento(id)}`, {method: 'DELETE', body: {}});
export const obtenerSesion = () => api('auth/sesion');
export async function accederCuenta(valor, registro = false) {
  await api('auth/csrf');
  return api(registro ? 'auth/registro' : 'auth/acceso', {method: 'POST', body: valor});
}
export async function cerrarSesion() {const r = await api('auth/salir', {method: 'POST', body: {}}); csrf = ''; return r;}
export const cambiarClave = valor => api('auth/clave', {method: 'PUT', body: valor});
export const listarUsuarios = (buscar = '', pagina = 1) => api(`admin/usuarios?buscar=${encodeURIComponent(buscar)}&pagina=${pagina}`);
export const gestionarUsuario = (id, accion) => api(`admin/usuarios/${segmento(id)}`, {method: 'PUT', body: {accion}});
export const obtenerAuditoria = () => api('admin/auditoria');

import http from 'node:http';
import {abrirMongo} from './persistencia-mongodb.js';
import {resumirCartera} from '../../shared/cuentas-ahorros.js';
import {categoriasUsuario, guardarCategoria, vincularSuscripcion, guardarCuenta, archivarCuenta, guardarTarjeta, archivarTarjeta, asignarOrigen, registrarOperacion, anularOperacion, guardarMeta, archivarMeta, registrarAhorro, validarSaldos} from './cuentas-ahorros.js';
import {crearUsuarios, publico} from './usuarios.js';
import {cookieSesion, tokenPeticion} from './autenticacion.js';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID, randomBytes} from 'node:crypto';
import {CATEGORIES, METHODS, parseAmount, validateExpense, nextSubscriptionDate, localDate} from '../../shared/finance.js';

const MAX_FILE = 5 * 1024 * 1024;
const types = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const fail = (message, status = 400) => Object.assign(new Error(message), {status});
function receiptValid(file) {
  if (!file || typeof file.name !== 'string' || file.name.length > 200 || !types.includes(file.type) || typeof file.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.base64)) return false;
  const bytes = Buffer.from(file.base64, 'base64');
  if (!bytes.length || bytes.length > MAX_FILE) return false;
  return (file.type === 'application/pdf' && bytes.subarray(0,5).toString() === '%PDF-') ||
    (file.type === 'image/png' && bytes.subarray(0,8).toString('hex') === '89504e470d0a1a0a') ||
    (file.type === 'image/jpeg' && bytes.subarray(0,3).toString('hex') === 'ffd8ff') ||
    (file.type === 'image/webp' && bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP');
}
async function body(req, limite = 7 * 1024 * 1024) {
  let size = 0; const chunks = [];
  for await (const chunk of req) {size += chunk.length; if (size > limite) throw fail(limite === 8192 ? 'La solicitud de acceso es demasiado grande.' : 'El comprobante debe pesar menos de 5 MB.', 413); chunks.push(chunk);}
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString());
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch {throw fail('JSON inválido.');}
}
function expenseFrom(input, previous, categorias = CATEGORIES) {
  if (typeof input.description !== 'string' || input.description.length > 160 || typeof input.date !== 'string') throw fail('Descripción o fecha inválida.');
  const receipt = Object.hasOwn(input, 'receipt') ? input.receipt : previous?.receipt || null;
  const expense = {id: previous?.id || randomUUID(), description: input.description.trim(), amount: typeof input.amount === 'string' ? parseAmount(input.amount) : null, date: input.date, method: input.medio ? (input.medio === 'credito' ? METHODS[1] : METHODS[0]) : input.method, category: input.category, receipt};
  const error = validateExpense(expense, categorias); if (error) throw fail(error);
  if (receipt && !receiptValid(receipt)) throw fail('Adjunta un PDF, PNG, JPEG o WebP válido de hasta 5 MB.');
  return expense;
}
function subscriptionFrom(input, id = randomUUID()) {
  const amount = typeof input.amount === 'string' ? parseAmount(input.amount) : null;
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 80) throw fail('Ingresa un nombre de hasta 80 caracteres.');
  if (amount === null) throw fail('Ingresa un monto mayor a cero con hasta dos decimales.');
  if (!Number.isInteger(input.day) || input.day < 1 || input.day > 31) throw fail('El día de corte debe estar entre 1 y 31.');
  if (typeof input.active !== 'boolean') throw fail('Indica si la suscripción está activa.');
  return {id, name: input.name.trim(), amount, day: input.day, active: input.active};
}
export async function createApp({mongoUri = process.env.MONGODB_URI, mongoDatabase = process.env.MONGODB_DATABASE} = {}) {
  const persistencia = await abrirMongo({uri: mongoUri, nombre: mongoDatabase, inicial: {initialCapital: 0, expenses: [], subscriptions: []}});
  const usuarios = crearUsuarios(persistencia.db);
  const segura = process.env.SESSION_SECURE === 'true';
  let queue = Promise.resolve();
  const server = http.createServer(async (req,res) => {
    const send = (code, value) => {res.writeHead(code, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}); res.end(JSON.stringify(value));};
    try {
      const url = new URL(req.url, 'http://localhost');
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '')) throw fail('Host no permitido.',403);
      if (['POST','PUT','PATCH','DELETE'].includes(req.method)) {
        const allowed = [`http://${req.headers.host}`, 'http://127.0.0.1:5173', 'http://localhost:5173'];
        if (req.headers.origin && !allowed.includes(req.headers.origin)) throw fail('Origen no permitido.',403);
        if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw fail('Se requiere application/json.',415);
      }
      if (req.method === 'GET' && url.pathname === '/api/health') {if (persistencia) await persistencia.ping(); return send(200, {estado: 'disponible'});}
      if (!url.pathname.startsWith('/api/')) throw fail('Ruta no encontrada.', 404);
      const escritura = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
      if (req.method === 'GET' && url.pathname === '/api/auth/csrf') {
        const csrf = randomBytes(32).toString('hex');
        res.setHeader('Set-Cookie', 'fjnance_inicio=' + csrf + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=600' + (segura ? '; Secure' : ''));
        return send(200, {csrf});
      }
      if (['/api/auth/registro', '/api/auth/acceso'].includes(url.pathname) && req.method === 'POST') {
        const inicio = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('fjnance_inicio='))?.slice('fjnance_inicio='.length);
        if (!/^[a-f0-9]{64}$/.test(inicio || '') || inicio !== req.headers['x-csrf-token']) throw fail('Recarga la página antes de acceder.', 403);
        const entrada = await body(req, 8192);
        await usuarios.limitar('ip:' + req.socket.remoteAddress);
        await usuarios.limitar('cuenta:' + String(entrada.correo || '').trim().toLowerCase());
        const usuario = url.pathname.endsWith('registro') ? await usuarios.registrar(entrada) : await usuarios.acceder(entrada);
        const sesion = await usuarios.nuevaSesion(usuario, tokenPeticion(req));
        res.setHeader('Set-Cookie', cookieSesion(sesion.token, {segura}));
        return send(url.pathname.endsWith('registro') ? 201 : 200, {usuario: publico(usuario), csrf: sesion.csrf});
      }
      const {usuario, sesion} = await usuarios.autenticar(tokenPeticion(req));
      if (escritura) usuarios.comprobarCsrf(sesion, req.headers['x-csrf-token']);
      if (req.method === 'GET' && url.pathname === '/api/auth/sesion') return send(200, {usuario: publico(usuario), csrf: sesion.csrf});
      if (req.method === 'POST' && url.pathname === '/api/auth/salir') {
        await usuarios.salir(tokenPeticion(req)); res.setHeader('Set-Cookie', cookieSesion('', {segura, borrar: true})); return send(200, {mensaje: 'Sesión cerrada.'});
      }
      if (req.method === 'PUT' && url.pathname === '/api/auth/clave') {
        await usuarios.limitar('clave:' + usuario._id);
        await usuarios.cambiarClave(usuario, await body(req, 8192)); res.setHeader('Set-Cookie', cookieSesion('', {segura, borrar: true})); return send(200, {mensaje: 'Contraseña actualizada. Vuelve a acceder.'});
      }
      if (url.pathname.startsWith('/api/admin/')) {
        if (usuario.rol !== 'admin') throw fail('No tienes permiso para esta sección.', 403);
        if (req.method === 'GET' && url.pathname === '/api/admin/usuarios') return send(200, await usuarios.listar(url.searchParams.get('buscar') || '', Number(url.searchParams.get('pagina') || 1)));
        if (req.method === 'GET' && url.pathname === '/api/admin/auditoria') return send(200, await usuarios.historial());
        const destino = url.pathname.match(/^\/api\/admin\/usuarios\/([^/]+)$/);
        if (req.method === 'PUT' && destino) {const entrada = await body(req, 8192); await usuarios.administrar(usuario, destino[1], entrada.accion); return send(200, {mensaje: 'Acción registrada.'});}
        throw fail('Ruta no encontrada.', 404);
      }
      // Estado y repositorio pertenecen exclusivamente a esta petición autenticada.
      const propia = persistencia.paraUsuario(usuario._id);
      await queue;
      let state = await propia.leer();
      function mutate(callback) {
        const resultado = queue.then(async () => {
          state = await propia.leer(); const siguiente = structuredClone(state); callback(siguiente);
          await propia.guardar(siguiente, state); state = siguiente;
        });
        queue = resultado.catch(() => {}); return resultado;
      }
      function snapshot() {
        return {initialCapital: state.initialCapital, capital: resumirCartera(state).capital, resumenCuentas: resumirCartera(state), expenses: state.expenses.map(e => ({...e, receipt: e.receipt ? {name: e.receipt.name, url: '/api/receipts/' + e.id} : null})), categories: categoriasUsuario(state).filter(c=>c.activo).map(c=>c.nombre), categoriasGestion:categoriasUsuario(state), methods: METHODS, subscriptions: state.subscriptions.map(item => ({...item, next: item.active ? nextSubscriptionDate(item.day) : null})).sort((a, b) => (a.next || '9999').localeCompare(b.next || '9999'))};
      }
      const mes = url.searchParams.get('mes') || localDate().slice(0, 7);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) throw fail('Mes inválido.');
      const categoria=url.pathname.match(/^\/api\/categorias(?:\/([^/]+))?$/);
      if(categoria){const id=categoria[1];if(req.method==='GET'&&!id)return send(200,categoriasUsuario(state));
        if((req.method==='POST'&&!id)||(req.method==='PUT'&&id)||(req.method==='DELETE'&&id)){const entrada=req.method==='DELETE'?{activo:false}:await body(req,16384);await mutate(next=>guardarCategoria(next,entrada,id));return send(req.method==='POST'?201:200,snapshot());}}
      const recurso = url.pathname.match(/^\/api\/(cuentas|tarjetas|objetivos)(?:\/([^/]+))?$/);
      if (recurso) {
        const [, tipo, id] = recurso;
        if (req.method === 'GET') {
          const resumen = resumirCartera(state, mes); const lista = tipo === 'cuentas' ? resumen.cuentas : tipo === 'tarjetas' ? resumen.tarjetas : resumen.metas;
          if (id) {const valor = lista.find(v => v.id === id); if (!valor) throw fail('Recurso no encontrado.', 404); return send(200, valor);}
          return send(200, lista);
        }
        if (req.method === 'POST' && !id || req.method === 'PUT' && id) {
          const entrada = await body(req, 16384);
          await mutate(next => {
            if (Object.hasOwn(entrada, 'activo') && id) {
              if (typeof entrada.activo !== 'boolean') throw fail('Estado inválido.');
              const accion = tipo === 'cuentas' ? archivarCuenta : tipo === 'tarjetas' ? archivarTarjeta : archivarMeta; accion(next, id, entrada.activo);
            } else {const guardar = tipo === 'cuentas' ? guardarCuenta : tipo === 'tarjetas' ? guardarTarjeta : guardarMeta; guardar(next, entrada, id);}
          }); return send(req.method === 'POST' ? 201 : 200, snapshot());
        }
        if (req.method === 'DELETE' && id) {await mutate(next => {const accion = tipo === 'cuentas' ? archivarCuenta : tipo === 'tarjetas' ? archivarTarjeta : archivarMeta; accion(next, id);}); return send(200, snapshot());}
      }
      const anulacion=url.pathname.match(/^\/api\/operaciones\/([^/]+)\/anular$/);
      if(req.method==='POST'&&anulacion){await mutate(next=>anularOperacion(next,anulacion[1]));return send(200,snapshot());}
      if (req.method === 'GET' && url.pathname === '/api/operaciones') return send(200, resumirCartera(state).operaciones);
      if (req.method === 'POST' && url.pathname === '/api/operaciones') {const entrada = await body(req, 16384);await mutate(next => registrarOperacion(next, entrada));return send(201, snapshot());}
      if (req.method === 'GET' && url.pathname === '/api/ahorros') {const r = resumirCartera(state); return send(200, {metas: r.metas, aportes: r.aportes, reservado: r.reservado, disponible: r.disponible, capital: r.capital});}
      if (req.method === 'POST' && url.pathname === '/api/ahorros') {const entrada = await body(req, 16384);await mutate(next => registrarAhorro(next, entrada));return send(201, snapshot());}
      if (req.method === 'GET') {
        if (url.pathname === '/api/state') return send(200, snapshot());
        if (url.pathname === '/api/capital') {const {initialCapital, capital} = snapshot(); return send(200, {initialCapital, capital});}
        if (url.pathname === '/api/expenses') return send(200, snapshot().expenses);
        if (url.pathname === '/api/subscriptions') return send(200, snapshot().subscriptions);
        if (url.pathname === '/api/categories') return send(200, categoriasUsuario(state).filter(c=>c.activo).map(c=>c.nombre));
        if (url.pathname === '/api/methods') return send(200, METHODS);
      }
      if (req.method === 'PUT' && url.pathname === '/api/capital') {
        const input = await body(req); const amount = input.amount === '0' || input.amount === '0.00' ? 0 : typeof input.amount === 'string' ? parseAmount(input.amount) : null;
        if (amount === null) throw fail('Ingresa un capital inicial válido.');
        await mutate(next => {const antes=structuredClone(next);next.initialCapital = amount;if(next.cartera)validarSaldos(next, antes);}); return send(200, snapshot());
      }
      if (req.method === 'POST' && url.pathname === '/api/expenses') {
        const entrada = await body(req);
        await mutate(next => {const antes=structuredClone(next);const expense = asignarOrigen(next, expenseFrom(entrada,undefined,categoriasUsuario(next).filter(c=>c.activo).map(c=>c.nombre)), entrada);next.expenses.unshift(expense);if(next.cartera)validarSaldos(next, antes);}); return send(201, snapshot());
      }
      const expenseMatch = url.pathname.match(/^\/api\/expenses\/([^/]+)$/);
      if (expenseMatch && req.method === 'GET') {
        const movimiento = snapshot().expenses.find(e => e.id === expenseMatch[1]);
        if (!movimiento) throw fail('Movimiento no encontrado.', 404);
        return send(200, movimiento);
      }
      if (expenseMatch && ['PUT','DELETE'].includes(req.method)) {
        const input = req.method === 'PUT' ? await body(req) : null;
        await mutate(next => {
          const index = next.expenses.findIndex(item => item.id === expenseMatch[1]);
          if (index < 0) throw fail('Movimiento no encontrado.',404);
          const antes=structuredClone(next);
          if (input) next.expenses[index] = asignarOrigen(next, expenseFrom(input, next.expenses[index],[...categoriasUsuario(next).filter(c=>c.activo).map(c=>c.nombre),next.expenses[index].category]), input, next.expenses[index]);
          else next.expenses.splice(index,1);
          if(next.cartera)validarSaldos(next, antes);
        });
        return send(200, snapshot());
      }
      if (req.method === 'POST' && url.pathname === '/api/subscriptions') {
        const entrada=await body(req);
        await mutate(next => {next.subscriptions.push(vincularSuscripcion(next,subscriptionFrom(entrada),entrada));});
        return send(201,snapshot());
      }
      const subscriptionMatch = url.pathname.match(/^\/api\/subscriptions\/([^/]+)$/);
      if (subscriptionMatch && req.method === 'GET') {
        const suscripcion = snapshot().subscriptions.find(s => s.id === subscriptionMatch[1]);
        if (!suscripcion) throw fail('Suscripción no encontrada.', 404);
        return send(200, suscripcion);
      }
      if (subscriptionMatch && ['PUT','DELETE'].includes(req.method)) {
        const input = req.method === 'PUT' ? await body(req) : null;
        await mutate(next => {
          const index = next.subscriptions.findIndex(item => item.id === subscriptionMatch[1]);
          if (index < 0) throw fail('Suscripción no encontrada.',404);
          if (input) next.subscriptions[index] = vincularSuscripcion(next,subscriptionFrom(input,subscriptionMatch[1]),input,next.subscriptions[index]);
          else next.subscriptions.splice(index,1);
        });
        return send(200,snapshot());
      }
      const comprobanteMatch = url.pathname.match(/^\/api\/receipts\/([^/]+)$/);
      if (comprobanteMatch && ['PUT', 'DELETE'].includes(req.method)) {
        const comprobante = req.method === 'PUT' ? await body(req) : null;
        if (comprobante && !receiptValid(comprobante)) throw fail('Adjunta un PDF, PNG, JPEG o WebP válido de hasta 5 MB.');
        await mutate(next => {
          const movimiento = next.expenses.find(e => e.id === comprobanteMatch[1]);
          if (!movimiento) throw fail('Movimiento no encontrado.', 404);
          if (req.method === 'DELETE' && !movimiento.receipt) throw fail('Comprobante no encontrado.', 404);
          movimiento.receipt = comprobante;
        });
        return send(200, snapshot());
      }
      if (req.method === 'GET' && comprobanteMatch) {
        const file = state.expenses.find(e => e.id === comprobanteMatch[1])?.receipt;
        if (!file) throw fail('Comprobante no encontrado.', 404);
        res.writeHead(200, {'Content-Type':file.type, 'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-store'}); return res.end(Buffer.from(file.base64,'base64'));
      }
      throw fail('Ruta no encontrada.', 404);
    } catch (error) {if (!res.headersSent) send(error.status || 500, {error:error.status ? error.message : 'No se pudo completar la operación.'});}
  });
  server.cerrarPersistencia = async () => {await queue; await persistencia?.cerrar();};
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const port = Number(process.env.PORT || 3001);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválido.');
    const server = await createApp();
    server.listen(port, process.env.HOST || '127.0.0.1', () => console.log('Fjnance disponible en puerto ' + port));
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
      server.close(async () => {await server.cerrarPersistencia(); process.exit(0);});
    });
  } catch (error) {console.error(error.message); process.exitCode = 1;}
}

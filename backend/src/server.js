import http from 'node:http';
import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {CATEGORIES, METHODS, parseAmount, validateExpense, subscriptions, nextSubscriptionDate} from '../../shared/finance.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
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
async function body(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) {size += chunk.length; if (size > 7 * 1024 * 1024) throw fail('El comprobante debe pesar menos de 5 MB.', 413); chunks.push(chunk);}
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString());
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch {throw fail('JSON inválido.');}
}
function expenseFrom(input, previous) {
  if (typeof input.description !== 'string' || input.description.length > 160 || typeof input.date !== 'string') throw fail('Descripción o fecha inválida.');
  const receipt = Object.hasOwn(input, 'receipt') ? input.receipt : previous?.receipt || null;
  const expense = {id: previous?.id || randomUUID(), description: input.description.trim(), amount: typeof input.amount === 'string' ? parseAmount(input.amount) : null, date: input.date, method: input.method, category: input.category, receipt};
  const error = validateExpense(expense); if (error) throw fail(error);
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
export async function createApp({dataDir = path.join(root, 'backend/data')} = {}) {
  await mkdir(dataDir, {recursive: true});
  const database = path.join(dataDir, 'finance.json');
  let state;
  try {state = JSON.parse(await readFile(database, 'utf8'));} catch (error) {
    if (error.code !== 'ENOENT') throw error;
    state = {initialCapital: 0, expenses: []};
  }
  if (!Array.isArray(state.subscriptions)) {
    state.subscriptions = subscriptions().map(({next, ...item}) => ({...item, id: randomUUID(), active: true}));
    await writeFile(`${database}.tmp`, JSON.stringify(state));
    await rename(`${database}.tmp`, database);
  }
  let queue = Promise.resolve();
  function mutate(callback) {
    const result = queue.then(async () => {
      const next = structuredClone(state); const value = callback(next);
      await writeFile(`${database}.tmp`, JSON.stringify(next)); await rename(`${database}.tmp`, database); state = next; return value;
    });
    queue = result.catch(() => {}); return result;
  }
  function snapshot() {
    return {initialCapital: state.initialCapital, capital: state.initialCapital - state.expenses.filter(e => e.method === METHODS[0]).reduce((sum,e) => sum + e.amount, 0), expenses: state.expenses.map(e => ({...e, receipt: e.receipt ? {name: e.receipt.name, url: `/api/receipts/${e.id}`} : null})), categories: CATEGORIES, methods: METHODS, subscriptions: state.subscriptions.map(item => ({...item, next: item.active ? nextSubscriptionDate(item.day) : null})).sort((a,b) => (a.next || '9999').localeCompare(b.next || '9999'))};
  }
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
      if (req.method === 'GET' && url.pathname === '/api/state') return send(200, snapshot());
      if (req.method === 'PUT' && url.pathname === '/api/capital') {
        const input = await body(req); const amount = input.amount === '0' || input.amount === '0.00' ? 0 : typeof input.amount === 'string' ? parseAmount(input.amount) : null;
        if (amount === null) throw fail('Ingresa un capital inicial válido.');
        await mutate(next => {next.initialCapital = amount;}); return send(200, snapshot());
      }
      if (req.method === 'POST' && url.pathname === '/api/expenses') {
        const expense = expenseFrom(await body(req));
        await mutate(next => {next.expenses.unshift(expense);}); return send(201, snapshot());
      }
      const expenseMatch = url.pathname.match(/^\/api\/expenses\/([^/]+)$/);
      if (expenseMatch && ['PUT','DELETE'].includes(req.method)) {
        const input = req.method === 'PUT' ? await body(req) : null;
        await mutate(next => {
          const index = next.expenses.findIndex(item => item.id === expenseMatch[1]);
          if (index < 0) throw fail('Movimiento no encontrado.',404);
          if (input) next.expenses[index] = expenseFrom(input, next.expenses[index]);
          else next.expenses.splice(index,1);
        });
        return send(200, snapshot());
      }
      if (req.method === 'POST' && url.pathname === '/api/subscriptions') {
        const subscription = subscriptionFrom(await body(req));
        await mutate(next => {next.subscriptions.push(subscription);});
        return send(201,snapshot());
      }
      const subscriptionMatch = url.pathname.match(/^\/api\/subscriptions\/([^/]+)$/);
      if (subscriptionMatch && ['PUT','DELETE'].includes(req.method)) {
        const input = req.method === 'PUT' ? subscriptionFrom(await body(req), subscriptionMatch[1]) : null;
        await mutate(next => {
          const index = next.subscriptions.findIndex(item => item.id === subscriptionMatch[1]);
          if (index < 0) throw fail('Suscripción no encontrada.',404);
          if (input) next.subscriptions[index] = input;
          else next.subscriptions.splice(index,1);
        });
        return send(200,snapshot());
      }
      if (req.method === 'GET' && url.pathname.startsWith('/api/receipts/')) {
        const file = state.expenses.find(e => e.id === url.pathname.split('/').pop())?.receipt;
        if (!file) throw fail('Comprobante no encontrado.', 404);
        res.writeHead(200, {'Content-Type':file.type, 'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`, 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-store'}); return res.end(Buffer.from(file.base64,'base64'));
      }
      if (url.pathname.startsWith('/api/')) throw fail('Ruta no encontrada.',404);
      if (req.method !== 'GET') throw fail('Método no permitido.',405);
      const dist = path.join(root, 'frontend/dist');
      const requested = path.resolve(dist, `.${decodeURIComponent(url.pathname)}`);
      if (requested !== dist && !requested.startsWith(dist + path.sep)) throw fail('Ruta inválida.',400);
      let bytes; let file = requested;
      try {bytes = await readFile(file);} catch {file = path.join(dist,'index.html'); bytes = await readFile(file);}
      const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png'};
      res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream','X-Content-Type-Options':'nosniff'}); res.end(bytes);
    } catch (error) {if (!res.headersSent) send(error.status || 500, {error:error.status ? error.message : 'No se pudo completar la operación.'});}
  });
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createApp(); const port = Number(process.env.PORT || 3001);
  server.listen(port, '127.0.0.1', () => console.log(`Fjnance API: http://127.0.0.1:${port}`));
}


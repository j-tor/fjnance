import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as cliente from '../../frontend/src/api.js';

test('cliente: todos los llamados, cuerpos y descarga binaria', async t => {
  const llamadas = [];
  t.mock.method(globalThis, 'fetch', async (url, opciones) => {llamadas.push({url, opciones}); return new Response(JSON.stringify({ok: true}), {status: 200});});
  const valor = {amount: '1.25'};
  const casos = [
    ['obtenerEstado', [], 'state'], ['obtenerSalud', [], 'health'], ['obtenerCapital', [], 'capital'],
    ['actualizarCapital', ['1.25'], 'capital', 'PUT', valor],
    ['obtenerMovimientos', [], 'expenses'], ['obtenerMovimiento', ['id'], 'expenses/id'],
    ['crearMovimiento', [valor], 'expenses', 'POST', valor], ['actualizarMovimiento', ['id', valor], 'expenses/id', 'PUT', valor], ['eliminarMovimiento', ['id'], 'expenses/id', 'DELETE', {}],
    ['obtenerSuscripciones', [], 'subscriptions'], ['obtenerSuscripcion', ['id'], 'subscriptions/id'],
    ['crearSuscripcion', [valor], 'subscriptions', 'POST', valor], ['actualizarSuscripcion', ['id', valor], 'subscriptions/id', 'PUT', valor], ['eliminarSuscripcion', ['id'], 'subscriptions/id', 'DELETE', {}],
    ['guardarCategoria', [valor], 'categorias', 'POST', valor], ['guardarCategoria', [valor,'id'], 'categorias/id', 'PUT', valor],
    ['guardarCuenta', [valor], 'cuentas', 'POST', valor], ['guardarCuenta', [valor,'id'], 'cuentas/id', 'PUT', valor],
    ['guardarTarjeta', [valor], 'tarjetas', 'POST', valor], ['guardarTarjeta', [valor,'id'], 'tarjetas/id', 'PUT', valor],
    ['guardarObjetivo', [valor], 'objetivos', 'POST', valor], ['guardarObjetivo', [valor,'general'], 'objetivos/general', 'PUT', valor],
    ['estadoCuenta', ['id',false], 'cuentas/id', 'PUT', {activo:false}], ['estadoTarjeta', ['id',true], 'tarjetas/id', 'PUT', {activo:true}], ['estadoObjetivo', ['id',true], 'objetivos/id', 'PUT', {activo:true}],
    ['registrarOperacion', [valor], 'operaciones', 'POST', valor], ['registrarAhorro', [valor], 'ahorros', 'POST', valor], ['anularOperacion', ['id'], 'operaciones/id/anular', 'POST', {}],
    ['obtenerCategorias', [], 'categories'], ['obtenerMetodos', [], 'methods'],
    ['guardarComprobante', ['id', valor], 'receipts/id', 'PUT', valor], ['eliminarComprobante', ['id'], 'receipts/id', 'DELETE', {}],
  ];
  for (const [nombre, args, ruta, metodo, cuerpo] of casos) {
    assert.deepEqual(await cliente[nombre](...args), {ok: true});
    const llamada = llamadas.at(-1); assert.equal(llamada.url, '/api/' + ruta);
    if (metodo) {assert.equal(llamada.opciones.method, metodo); assert.equal(llamada.opciones.headers['Content-Type'], 'application/json'); assert.deepEqual(JSON.parse(llamada.opciones.body), cuerpo);}
    else assert.equal(llamada.opciones, undefined);
  }
  await cliente.obtenerMovimiento('id/con espacio'); assert.equal(llamadas.at(-1).url, '/api/expenses/id%2Fcon%20espacio');
  await cliente.api('expenses', {body: valor}); assert.equal(llamadas.at(-1).opciones.method, 'POST');
  globalThis.fetch.mock.mockImplementation(async () => new Response('%PDF-1.4', {headers: {'Content-Type': 'application/pdf'}}));
  const archivo = await cliente.descargarComprobante('id'); assert.equal(archivo.type, 'application/pdf'); assert.equal(await archivo.text(), '%PDF-1.4');
});

test('cliente autenticado: CSRF en memoria, llamados de cuenta y administración', async t => {
  const llamadas = [];
  t.mock.method(globalThis, 'fetch', async (url, opciones) => {
    llamadas.push({url, opciones});
    return new Response(JSON.stringify(url.endsWith('/csrf') || url.endsWith('/sesion') || url.endsWith('/registro') || url.endsWith('/acceso') ? {usuario: {id: 'fixture'}, csrf: 'a'.repeat(64)} : {mensaje: 'ok'}));
  });
  await cliente.obtenerSesion(); await cliente.actualizarCapital('1'); assert.equal(llamadas.at(-1).opciones.headers['X-CSRF-Token'], 'a'.repeat(64));
  await cliente.accederCuenta({correo: 'fixture@example.test', clave: 'Prueba sintética 123'}, true); assert.equal(llamadas.at(-1).url, '/api/auth/registro');
  await cliente.accederCuenta({correo: 'fixture@example.test', clave: 'Prueba sintética 123'}); assert.equal(llamadas.at(-1).url, '/api/auth/acceso');
  await cliente.cambiarClave({actual: 'vieja', nueva: 'nueva'}); assert.equal(llamadas.at(-1).opciones.method, 'PUT');
  await cliente.listarUsuarios('a+b', 2); assert.equal(llamadas.at(-1).url, '/api/admin/usuarios?buscar=a%2Bb&pagina=2');
  await cliente.gestionarUsuario('id', 'bloquear'); assert.deepEqual(JSON.parse(llamadas.at(-1).opciones.body), {accion: 'bloquear'});
  await cliente.obtenerAuditoria(); assert.equal(llamadas.at(-1).url, '/api/admin/auditoria');
  await cliente.cerrarSesion(); await cliente.actualizarCapital('0'); assert.equal(llamadas.at(-1).opciones.headers['X-CSRF-Token'], undefined);
});

test('una respuesta 401 antigua no cierra una sesión nueva', async t => {
  const anterior = globalThis.window; globalThis.window = new EventTarget();
  t.after(() => {if (anterior === undefined) delete globalThis.window; else globalThis.window = anterior;});
  let eventos = 0; globalThis.window.addEventListener('sesion-expirada', () => eventos++);
  let resolver; let nueva = false;
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.endsWith('/sesion')) return new Response(JSON.stringify({csrf: (nueva ? 'b' : 'a').repeat(64)}));
    return new Promise(r => {resolver = r;});
  });
  await cliente.obtenerSesion(); const pendiente = cliente.obtenerCapital(); nueva = true; await cliente.obtenerSesion();
  resolver(new Response('{}', {status: 401})); await assert.rejects(pendiente); assert.equal(eventos, 0);
  const actual = cliente.obtenerCapital(); resolver(new Response('{}', {status: 401})); await assert.rejects(actual); assert.equal(eventos, 1);
});

test('cliente: errores HTTP, de red, JSON inválido e identificadores vacíos', async t => {
  const simulado = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({error: 'Movimiento no encontrado.'}), {status: 404}));
  await assert.rejects(cliente.obtenerMovimiento('id'), {message: 'Movimiento no encontrado.', status: 404});
  await assert.rejects(cliente.descargarComprobante('id'), {status: 404});
  simulado.mock.mockImplementation(async () => new Response('Error sin JSON', {status: 500}));
  await assert.rejects(cliente.obtenerEstado(), {status: 500});
  simulado.mock.mockImplementation(async () => {throw new TypeError('fallo de red');});
  await assert.rejects(cliente.obtenerEstado(), /No se pudo conectar/);
  simulado.mock.mockImplementation(async () => new Response('no-json'));
  await assert.rejects(cliente.obtenerEstado(), /respuesta inválida/);
  for (const nombre of ['obtenerMovimiento', 'actualizarMovimiento', 'eliminarMovimiento', 'obtenerSuscripcion', 'actualizarSuscripcion', 'eliminarSuscripcion', 'guardarComprobante', 'eliminarComprobante', 'descargarComprobante']) {
    assert.throws(() => cliente[nombre](' '), /Identificador requerido/);
  }
});

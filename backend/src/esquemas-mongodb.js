import {CATEGORIES, METHODS} from '../../shared/finance.js';

export const VERSION_ESQUEMAS = 1;
const entero = {bsonType: ['int', 'long', 'double'], multipleOf: 1};
const centavos = {...entero, minimum: 1, maximum: 99999999999};
const identificador = {bsonType: 'string', pattern: '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'};
const hash = {bsonType: 'string', pattern: '^[a-f0-9]{64}$'};
export const esquemaMovimiento = {
  bsonType: 'object', required: ['id', 'description', 'amount', 'date', 'method', 'category', 'receipt'], additionalProperties: false,
  properties: {
    id: identificador, description: {bsonType: 'string', minLength: 1, maxLength: 160, pattern: '\\S'}, amount: centavos,
    date: {bsonType: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$'}, method: {enum: METHODS}, category: {enum: CATEGORIES},
    receipt: {anyOf: [{bsonType: 'null'}, hash]},
  },
};
export const esquemaSuscripcion = {
  bsonType: 'object', required: ['id', 'name', 'amount', 'day', 'active'], additionalProperties: false,
  properties: {id: identificador, name: {bsonType: 'string', minLength: 1, maxLength: 80, pattern: '\\S'}, amount: centavos, day: {...entero, minimum: 1, maximum: 31}, active: {bsonType: 'bool'}},
};
export const esquemaComprobante = {
  bsonType: 'object', required: ['name', 'type', 'base64'],
  // F1 permitía campos adicionales en los adjuntos: conservar compatibilidad.
  properties: {name: {bsonType: 'string', maxLength: 200}, type: {enum: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']}, base64: {bsonType: 'string', minLength: 1, maxLength: 6990508, pattern: '^[A-Za-z0-9+/]*={0,2}$'}},
};
export const esquemasColecciones = {
  estado: {
    bsonType: 'object', required: ['_id', 'revision', 'valor'], additionalProperties: false,
    properties: {_id: {enum: ['principal']}, revision: {...entero, minimum: 0, maximum: Number.MAX_SAFE_INTEGER}, valor: {
      bsonType: 'object', required: ['initialCapital', 'expenses', 'subscriptions'], additionalProperties: false,
      properties: {initialCapital: {...centavos, minimum: 0}, expenses: {bsonType: 'array', items: esquemaMovimiento}, subscriptions: {bsonType: 'array', items: esquemaSuscripcion}},
    }},
  },
  comprobantes: {bsonType: 'object', required: ['_id', 'valor'], additionalProperties: false, properties: {_id: hash, valor: esquemaComprobante}},
};
const uuid = identificador;
const fecha = {bsonType: 'date'};
esquemasColecciones.estados_usuario = {...esquemasColecciones.estado, properties: {...esquemasColecciones.estado.properties, _id: uuid}};
esquemasColecciones.comprobantes_usuario = {bsonType: 'object', required: ['_id', 'usuarioId', 'valor'], additionalProperties: false, properties: {_id: {bsonType: 'string', pattern: '^[a-f0-9-]{36}:[a-f0-9]{64}$'}, usuarioId: uuid, valor: esquemaComprobante}};
esquemasColecciones.usuarios = {bsonType: 'object', required: ['_id', 'nombre', 'correo', 'claveHash', 'rol', 'activo', 'version', 'creado'], additionalProperties: false, properties: {_id: uuid, nombre: {bsonType: 'string', minLength: 1, maxLength: 80}, correo: {bsonType: 'string', maxLength: 254}, claveHash: {bsonType: 'string', pattern: '^[a-f0-9]{32}:[a-f0-9]{128}$'}, rol: {enum: ['usuario', 'admin']}, activo: {bsonType: 'bool'}, version: {...entero, minimum: 0}, creado: fecha}};
esquemasColecciones.sesiones = {bsonType: 'object', required: ['_id', 'usuarioId', 'csrf', 'csrfHash', 'version', 'expira'], additionalProperties: false, properties: {_id: hash, usuarioId: uuid, csrf: hash, csrfHash: hash, version: {...entero, minimum: 0}, expira: fecha}};
esquemasColecciones.auditoria = {bsonType: 'object', required: ['_id', 'actorId', 'usuarioId', 'accion', 'fecha'], additionalProperties: false, properties: {_id: uuid, actorId: uuid, usuarioId: uuid, accion: {enum: ['bloquear', 'activar', 'revocar']}, fecha}};
esquemasColecciones.intentos_acceso = {bsonType: 'object', required: ['_id', 'cantidad', 'expira'], additionalProperties: false, properties: {_id: hash, cantidad: {...entero, minimum: 1}, expira: fecha}};
const referencia = {anyOf: [{bsonType: 'null'}, uuid]};
const cuentaFondos = {anyOf: [{bsonType: 'null'}, uuid, {enum: ['sin-distribuir']}]};
const metaId = {anyOf: [uuid, {enum: ['general']}]};
const dineroCero = {...centavos, minimum: 0};
const fechaTexto = {bsonType: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$'};
const nombre = {bsonType: 'string', minLength: 1, maxLength: 80};
const esquemaCuenta = {bsonType: 'object', required: ['id', 'alias', 'banco', 'tipo', 'activo'], additionalProperties: false, properties: {id: uuid, alias: nombre, banco: {bsonType: 'string', maxLength: 80}, tipo: {enum: ['efectivo', 'corriente', 'ahorro']}, activo: {bsonType: 'bool'}}};
const esquemaTarjeta = {bsonType: 'object', required: ['id', 'alias', 'banco', 'tipo', 'cuentaId', 'ultimos4', 'activo', 'deudaInicial', 'limite'], additionalProperties: false, properties: {id: uuid, alias: nombre, banco: nombre, tipo: {enum: ['debito', 'credito']}, cuentaId: referencia, ultimos4: {bsonType: 'string', pattern: '^(?:\\d{4})?$'}, activo: {bsonType: 'bool'}, deudaInicial: dineroCero, limite: {anyOf: [{bsonType: 'null'}, centavos]}}};
const esquemaOperacion = {bsonType: 'object', required: ['id', 'tipo', 'monto', 'fecha', 'descripcion', 'origenId', 'destinoId', 'tarjetaId'], additionalProperties: false, properties: {id: uuid, tipo: {enum: ['aporte', 'retiro', 'transferencia', 'pago_credito']}, monto: centavos, fecha: fechaTexto, descripcion: {bsonType: 'string', maxLength: 160}, origenId: cuentaFondos, destinoId: cuentaFondos, tarjetaId: referencia, anulada: {bsonType:'bool'}, anulacionFecha: fechaTexto}};
const esquemaMeta = {bsonType: 'object', required: ['id', 'nombre', 'objetivo', 'meses', 'inicio', 'mensual', 'activo'], additionalProperties: false, properties: {id: metaId, nombre, objetivo: dineroCero, unidad:{enum:['meses','semanas']},modo:{enum:['plazo','aporte','manual']},meses: {...entero, minimum: 1, maximum: 2600}, inicio: fechaTexto, mensual: dineroCero, activo: {bsonType: 'bool'}}};
const esquemaAporte = {bsonType: 'object', required: ['id', 'tipo', 'metaId', 'cuentaId', 'monto', 'fecha'], additionalProperties: false, properties: {id: uuid, tipo: {enum: ['aporte', 'retiro']}, metaId, cuentaId: cuentaFondos, monto: centavos, fecha: fechaTexto}};
const valorUsuario = structuredClone(esquemasColecciones.estados_usuario.properties.valor);
valorUsuario.properties.catalogoCategorias={bsonType:'array',items:{bsonType:'object',required:['id','nombre','activo'],additionalProperties:false,properties:{id:{bsonType:'string',maxLength:80},nombre,activo:{bsonType:'bool'}}}};
valorUsuario.properties.subscriptions.items={...esquemaSuscripcion,properties:{...esquemaSuscripcion.properties,tarjetaId:referencia}};
valorUsuario.properties.expenses.items = {...esquemaMovimiento, properties: {...esquemaMovimiento.properties, category:nombre, medio: {enum: ['efectivo', 'debito', 'credito']}, cuentaId: referencia, tarjetaId: referencia}};
valorUsuario.properties.cartera = {bsonType: 'object', required: ['version', 'cuentas', 'tarjetas', 'operaciones', 'metas', 'aportes'], additionalProperties: false, properties: {version: {enum: [1]}, cuentas: {bsonType: 'array', items: esquemaCuenta}, tarjetas: {bsonType: 'array', items: esquemaTarjeta}, operaciones: {bsonType: 'array', items: esquemaOperacion}, metas: {bsonType: 'array', items: esquemaMeta}, aportes: {bsonType: 'array', items: esquemaAporte}}};
esquemasColecciones.estados_usuario.properties.valor = valorUsuario;

export async function prepararEsquemas(db) {
  const existentes = new Set((await db.listCollections({}, {nameOnly: true}).toArray()).map(c => c.name));
  // Comprobar todas antes de cambiar validadores. Nunca corregir datos silenciosamente.
  for (const [nombre, esquema] of Object.entries(esquemasColecciones)) {
    if (existentes.has(nombre) && await db.collection(nombre).findOne({$nor: [{$jsonSchema: esquema}]}, {projection: {_id: 1}})) {
      throw new Error(`Datos incompatibles con esquema v${VERSION_ESQUEMAS} en ${nombre}; no se modificaron documentos.`);
    }
  }
  for (const [nombre, esquema] of Object.entries(esquemasColecciones)) {
    const opciones = {validator: {$jsonSchema: esquema}, validationLevel: 'strict', validationAction: 'error'};
    if (!existentes.has(nombre)) {
      try {await db.createCollection(nombre, opciones); continue;} catch (error) {if (error.code !== 48) throw error;}
    }
    await db.command({collMod: nombre, ...opciones});
  }
  await db.collection('usuarios').createIndex({correo: 1}, {unique: true});
  await db.collection('sesiones').createIndex({expira: 1}, {expireAfterSeconds: 0});
  await db.collection('sesiones').createIndex({usuarioId: 1});
  await db.collection('intentos_acceso').createIndex({expira: 1}, {expireAfterSeconds: 0});
}

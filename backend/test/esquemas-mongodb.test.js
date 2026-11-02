import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MongoClient, Decimal128} from 'mongodb';
import {randomUUID} from 'node:crypto';
import {prepararEsquemas, VERSION_ESQUEMAS} from '../src/esquemas-mongodb.js';
import {abrirMongo} from '../src/persistencia-mongodb.js';
import {baseDePrueba} from './soporte-mongodb.js';
import {CATEGORIES, METHODS} from '../../shared/finance.js';

test('esquemas v1: compatibilidad F1, idempotencia y rechazo directo de datos inválidos', async () => {
  const base = await baseDePrueba(); const cliente = new MongoClient(base.mongoUri);
  try {
    await cliente.connect(); const db = cliente.db(base.mongoDatabase);
    const movimiento = {id: randomUUID(), description: 'Prueba', amount: 125, date: '2026-01-01', method: METHODS[0], category: CATEGORIES[0], receipt: null};
    const suscripcion = {id: randomUUID(), name: 'Servicio', amount: 100, day: 31, active: true};
    const estado = {_id: 'principal', revision: 0, valor: {initialCapital: 0, expenses: [movimiento], subscriptions: [suscripcion]}};
    const archivo = {_id: 'a'.repeat(64), valor: {name: 'prueba.pdf', type: 'application/pdf', base64: Buffer.from('%PDF-1.4').toString('base64')}};
    await db.collection('estado').insertOne(structuredClone(estado));
    await db.collection('comprobantes').insertOne(structuredClone(archivo));
    await prepararEsquemas(db); await prepararEsquemas(db);
    assert.equal(VERSION_ESQUEMAS, 1);
    assert.deepEqual(await db.collection('estado').findOne(), estado);
    assert.deepEqual(await db.collection('comprobantes').findOne(), archivo);
    await db.collection('estado').updateOne({_id: 'principal'}, {$set: {'valor.initialCapital': 12345}});
    for (const [campo, valor] of [
      ['valor.initialCapital', -1], ['valor.initialCapital', 0.5], ['revision', -1],
      ['valor.initialCapital', 100000000000], ['valor.initialCapital', Decimal128.fromString('1.0')],
      ['valor.expenses.0.amount', 0], ['valor.expenses.0.amount', 1.5], ['valor.expenses.0.id', 'incorrecto'],
      ['valor.expenses.0.category', 'inventada'], ['valor.expenses.0.method', 'inventado'], ['valor.expenses.0.description', ' '],
      ['valor.expenses.0.receipt', 'hash-invalido'], ['valor.expenses.0.date', 'ayer'],
      ['valor.subscriptions.0.day', 32], ['valor.subscriptions.0.day', 1.5], ['valor.subscriptions.0.active', 'true'],
      ['valor.subscriptions.0.name', ''], ['valor.subscriptions.0.amount', -1],
    ]) await assert.rejects(db.collection('estado').updateOne({_id: 'principal'}, {$set: {[campo]: valor}}), {code: 121});
    await assert.rejects(db.collection('estado').updateOne({_id: 'principal'}, {$unset: {'valor.expenses': ''}}), {code: 121});
    for (const valor of [{...archivo.valor, type: 'text/plain'}, {...archivo.valor, base64: '!'}, {...archivo.valor, name: 'x'.repeat(201)}]) {
      await assert.rejects(db.collection('comprobantes').updateOne({_id: archivo._id}, {$set: {valor}}), {code: 121});
    }
    await assert.rejects(db.collection('comprobantes').insertOne({_id: 'incorrecto', valor: archivo.valor}), {code: 121});
    assert.equal((await db.collection('estado').findOne()).valor.initialCapital, 12345);
    await db.collection('estado').updateOne({_id: 'principal'}, {$set: {'valor.initialCapital': 99999999999, 'valor.subscriptions.0.day': 1}});
    assert.equal((await db.collection('estado').findOne()).valor.initialCapital, 99999999999);
  } finally {await cliente.close(); await base.limpiar();}
});

test('datos incompatibles detienen arranque sin sobrescritura ni cambio de validadores', async () => {
  const base = await baseDePrueba(); const cliente = new MongoClient(base.mongoUri);
  try {
    await cliente.connect(); const db = cliente.db(base.mongoDatabase);
    await db.collection('estado').insertOne({_id: 'principal', revision: 0, valor: {initialCapital: -10, expenses: [], subscriptions: []}});
    const antes = await db.collection('estado').findOne();
    await assert.rejects(abrirMongo({uri: base.mongoUri, nombre: base.mongoDatabase, inicial: {}}), /Datos incompatibles con esquema v1 en estado/);
    assert.deepEqual(await db.collection('estado').findOne(), antes);
    assert.equal((await db.listCollections({name: 'estado'}).next()).options.validator, undefined);
    await db.collection('estado').deleteMany({});
    await db.collection('comprobantes').insertOne({_id: 'invalido', valor: {}});
    await assert.rejects(prepararEsquemas(db), /en comprobantes/);
    assert.equal(await db.collection('comprobantes').countDocuments(), 1);
  } finally {await cliente.close(); await base.limpiar();}
});

import {MongoClient} from 'mongodb';
import {createHash} from 'node:crypto';
import {prepararEsquemas} from './esquemas-mongodb.js';

// Los comprobantes se separan del estado para no acumular sus bytes en un BSON.
export async function abrirMongo({uri, nombre, inicial}) {
  if (!/^mongodb(?:\+srv)?:\/\//.test(uri || '') || !/^[a-zA-Z0-9_-]+$/.test(nombre || '')) {
    throw new Error('Configura MONGODB_URI y MONGODB_DATABASE válidos.');
  }
  const cliente = new MongoClient(uri, {serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000});
  try {
    await cliente.connect();
    const db = cliente.db(nombre);
    await prepararEsquemas(db);
    const estados = db.collection('estado');
    const archivos = db.collection('comprobantes');
    await estados.updateOne({_id: 'principal'}, {$setOnInsert: {revision: 0, valor: inicial}}, {upsert: true});
    const revisiones = new WeakMap();
    async function leer() {
      const documento = await estados.findOne({_id: 'principal'});
      const valor = documento.valor;
      revisiones.set(valor, documento.revision);
      for (const gasto of valor.expenses) {
        if (gasto.receipt) {
          const archivo = await archivos.findOne({_id: gasto.receipt});
          if (!archivo) throw new Error('Comprobante persistido no disponible.');
          gasto.receipt = archivo.valor;
        }
      }
      return valor;
    }
    async function guardar(estado, anterior) {
      const revision = revisiones.get(anterior);
      const valor = structuredClone(estado);
      for (const gasto of valor.expenses) {
        if (!gasto.receipt) continue;
        const id = createHash('sha256').update(JSON.stringify(gasto.receipt)).digest('hex');
        await archivos.updateOne({_id: id}, {$setOnInsert: {valor: gasto.receipt}}, {upsert: true});
        gasto.receipt = id;
      }
      const resultado = await estados.updateOne({_id: 'principal', revision}, {$set: {valor}, $inc: {revision: 1}});
      if (!resultado.matchedCount) throw Object.assign(new Error('El estado cambió; vuelve a intentar.'), {status: 409});
      revisiones.set(estado, revision + 1);
    }
    function paraUsuario(usuarioId) {
      if (!/^[a-f0-9-]{36}$/.test(usuarioId)) throw new Error('Propietario inválido.');
      const estadosPropios = db.collection('estados_usuario');
      const adjuntosPropios = db.collection('comprobantes_usuario');
      const revisionesPropias = new WeakMap();
      return {
        async leer() {
          await estadosPropios.updateOne({_id: usuarioId}, {$setOnInsert: {revision: 0, valor: {initialCapital: 0, expenses: [], subscriptions: []}}}, {upsert: true});
          const doc = await estadosPropios.findOne({_id: usuarioId});
          const valor = doc.valor; revisionesPropias.set(valor, doc.revision);
          for (const gasto of valor.expenses) if (gasto.receipt) {
            const archivo = await adjuntosPropios.findOne({_id: usuarioId + ':' + gasto.receipt, usuarioId});
            if (!archivo) throw new Error('Comprobante no disponible.');
            gasto.receipt = archivo.valor;
          }
          return valor;
        },
        async guardar(estado, anterior) {
          const valor = structuredClone(estado);
          for (const gasto of valor.expenses) if (gasto.receipt) {
            const hash = createHash('sha256').update(JSON.stringify(gasto.receipt)).digest('hex');
            await adjuntosPropios.updateOne({_id: usuarioId + ':' + hash, usuarioId}, {$setOnInsert: {valor: gasto.receipt}}, {upsert: true});
            gasto.receipt = hash;
          }
          const revision = revisionesPropias.get(anterior);
          const r = await estadosPropios.updateOne({_id: usuarioId, revision}, {$set: {valor}, $inc: {revision: 1}});
          if (!r.matchedCount) throw Object.assign(new Error('El estado cambió; vuelve a intentar.'), {status: 409});
          revisionesPropias.set(estado, revision + 1);
        },
      };
    }
    return {leer, guardar, paraUsuario, db, ping: () => db.command({ping: 1}), cerrar: () => cliente.close()};
  } catch (error) {
    await cliente.close();
    if (error.message.startsWith('Datos incompatibles con esquema')) throw error;
    throw new Error('No se pudo conectar o inicializar MongoDB. Revisa su disponibilidad y configuración.');
  }
}

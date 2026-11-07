import React, {useState} from 'react';
import {money, localDate} from '../../../shared/finance.js';
import {rankingTarjetas, SIN_DISTRIBUIR} from '../../../shared/cuentas-ahorros.js';
import {Modal, Icon} from '../components/Forms.jsx';
import {guardarCuenta, estadoCuenta, guardarTarjeta, estadoTarjeta, registrarOperacion, anularOperacion} from '../api.js';

const tipoCuenta = {efectivo: 'Efectivo', corriente: 'Cuenta corriente', ahorro: 'Cuenta de ahorro', 'sin-distribuir': 'Pendiente de distribuir'};
const tipoOperacion = {aporte: 'Aporte de capital', retiro: 'Retiro de capital', transferencia: 'Transferencia interna', pago_credito: 'Pago de crédito'};
export function FormularioFinanciero({titulo, cerrar, enviar, children, boton = 'Guardar'}) {
  const [ocupado, setOcupado] = useState(false); const [error, setError] = useState('');
  async function guardar(e) {e.preventDefault();if(ocupado)return;setOcupado(true);setError('');try{await enviar(Object.fromEntries(new FormData(e.currentTarget)));}catch(e){setError(e.message);}finally{setOcupado(false);}}
  return <Modal title={titulo} close={() => !ocupado && cerrar()}><form onSubmit={guardar}><fieldset disabled={ocupado}>{children}</fieldset>{error && <p className="error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="secondary" disabled={ocupado} onClick={cerrar}>Cancelar</button><button className="primary" disabled={ocupado}>{ocupado ? 'Guardando…' : boton}</button></div></form></Modal>;
}
function FormularioCuenta({modelo, resumen, cerrar, enviar}) {
  const [tipo, setTipo] = useState(modelo?.tipo || 'corriente');
  return <FormularioFinanciero titulo={modelo ? 'Editar cuenta' : 'Nueva cuenta'} cerrar={cerrar} enviar={enviar}>
    <label>Alias de la cuenta<input name="alias" maxLength="80" required defaultValue={modelo?.alias || ''} placeholder="Ej. Cuenta de nómina" autoFocus/></label>
    <label>Tipo de cuenta<select name="tipo" value={tipo} onChange={e=>setTipo(e.target.value)} disabled={!!modelo}><option value="corriente">Cuenta corriente</option><option value="ahorro">Cuenta de ahorro</option><option value="efectivo">Efectivo</option></select>{modelo && <input type="hidden" name="tipo" value={tipo}/>}</label>
    {tipo !== 'efectivo' && <label>Banco<input name="banco" maxLength="80" required defaultValue={modelo?.banco || ''}/></label>}
    {!modelo && <><label>Saldo para empezar (L)<input name="saldo" inputMode="decimal" defaultValue="0" required/></label><label>Origen de ese saldo<select name="origen" defaultValue={resumen.sinDistribuir > 0 ? 'sin-distribuir' : 'nuevo'}><option value="nuevo">Agregar capital nuevo</option>{resumen.sinDistribuir > 0 && <option value="sin-distribuir">Distribuir saldo anterior ({money(resumen.sinDistribuir)})</option>}</select></label><p className="ayuda-campo">Distribuir mueve dinero que ya tienes. Agregar capital nuevo aumenta tu capital total.</p></>}
  </FormularioFinanciero>;
}
function FormularioTarjeta({modelo, resumen, cerrar, enviar}) {
  const [tipo, setTipo] = useState(modelo?.tipo || 'debito');
  const cuentas = resumen.cuentas.filter(c => c.activo && ['corriente','ahorro'].includes(c.tipo));
  return <FormularioFinanciero titulo={modelo ? 'Editar tarjeta' : 'Nueva tarjeta'} cerrar={cerrar} enviar={enviar}>
    <label>Alias de la tarjeta<input name="alias" maxLength="80" required defaultValue={modelo?.alias || ''} placeholder="Ej. Débito principal" autoFocus/></label>
    <label>Tipo de tarjeta<select name="tipo" value={tipo} onChange={e=>setTipo(e.target.value)} disabled={!!modelo}><option value="debito">Débito</option><option value="credito">Crédito</option></select>{modelo && <input type="hidden" name="tipo" value={tipo}/>}</label>
    {tipo === 'debito' ? <label>Cuenta bancaria de cargo<select name="cuentaId" required defaultValue={modelo?.cuentaId || ''}><option value="" disabled>Selecciona una cuenta</option>{cuentas.map(c=><option key={c.id} value={c.id}>{c.alias} · {c.banco} · {money(c.disponible)}</option>)}</select>{!cuentas.length && <small>Primero agrega una cuenta bancaria.</small>}</label> : <label>Banco emisor<input name="banco" required maxLength="80" defaultValue={modelo?.banco || ''}/></label>}
    {tipo === 'credito' && <><label>Límite de crédito (L, opcional)<input name="limite" inputMode="decimal" defaultValue={modelo?.limite ? (modelo.limite/100).toFixed(2) : ''}/></label>{!modelo && <label>Deuda que ya tienes (L)<input name="deudaInicial" inputMode="decimal" defaultValue="0" required/></label>}</>}
  </FormularioFinanciero>;
}
function FormularioOperacion({resumen, tarjeta, cerrar, enviar}) {
  const [tipo, setTipo] = useState(tarjeta ? 'pago_credito' : 'aporte');
  const destino = resumen.cuentas.filter(c=>c.activo); const origen = resumen.cuentas.filter(c=>c.disponible>0);
  return <FormularioFinanciero titulo="Registrar operación de fondos" cerrar={cerrar} enviar={enviar} boton="Registrar operación">
    <label>Operación<select name="tipo" value={tipo} onChange={e=>setTipo(e.target.value)}>{Object.entries(tipoOperacion).map(([v,n])=><option value={v} key={v}>{n}</option>)}</select></label>
    {tipo !== 'aporte' && <label>Cuenta de origen<select name="origenId" required defaultValue=""><option value="" disabled>Selecciona el origen</option>{origen.map(c=><option key={c.id} value={c.id}>{c.alias} · disponible {money(c.disponible)}</option>)}</select></label>}
    {['aporte','transferencia'].includes(tipo) && <label>Cuenta de destino<select name="destinoId" required defaultValue=""><option value="" disabled>Selecciona el destino</option>{destino.map(c=><option key={c.id} value={c.id}>{c.alias}</option>)}</select></label>}
    {tipo==='pago_credito' && <label>Tarjeta a pagar<select name="tarjetaId" required defaultValue={tarjeta?.id || ''}><option value="" disabled>Selecciona tarjeta de crédito</option>{resumen.tarjetas.filter(t=>t.tipo==='credito').map(t=><option key={t.id} value={t.id}>{t.alias} · deuda {money(t.deuda)}</option>)}</select></label>}
    <div className="form-grid"><label>Monto (L)<input name="monto" inputMode="decimal" required/></label><label>Fecha<input name="fecha" type="date" defaultValue={localDate()} max={localDate()} required/></label></div>
    <label>Descripción (opcional)<input name="descripcion" maxLength="160"/></label><p className="ayuda-campo">Transferir y pagar una tarjeta mueve fondos; no vuelve a contar el consumo como gasto.</p>
  </FormularioFinanciero>;
}
export default function Cuentas({data, actualizar}) {
  const r = data.resumenCuentas; const [vista, setVista] = useState('cuentas'); const [modal, setModal] = useState(null); const [archivadas, setArchivadas] = useState(false); const [mes, setMes] = useState(localDate().slice(0,7)); const [error,setError]=useState(''); const [ocupado,setOcupado]=useState(false);
  const tarjetas = rankingTarjetas(data.expenses, r.tarjetas, mes); const mayor = tarjetas[0]?.gastadoMes || 0;
  async function estado(tipo, item) {setError('');setOcupado(true);try{actualizar(await (tipo==='cuenta'?estadoCuenta:estadoTarjeta)(item.id,!item.activo),'Estado actualizado. El historial se conserva.');}catch(e){setError(e.message);}finally{setOcupado(false);}}
  async function guardar(valor) {const respuesta=modal.tipo==='cuenta'?await guardarCuenta(valor,modal.item?.id):modal.tipo==='tarjeta'?await guardarTarjeta(valor,modal.item?.id):await registrarOperacion(valor);actualizar(respuesta,'Tus saldos están actualizados.');setModal(null);}
  async function anular(o){setError('');setOcupado(true);try{actualizar(await anularOperacion(o.id),'Operación anulada. El registro se conserva.');}catch(e){setError(e.message);}finally{setOcupado(false);}}
  const cuentaNombre=id=>r.cuentas.find(c=>c.id===id)?.alias || '—';
  return <>
    <section className="resumen-fondos" aria-label="Capital distribuido"><div><span>Capital total</span><strong>{money(r.capital)}</strong></div><div><span>Reservado en ahorros</span><strong>{money(r.reservado)}</strong></div><div><span>Disponible para gastar</span><strong>{money(r.disponible)}</strong></div></section>
    <div className="acciones-seccion"><div className="pestanas" role="group" aria-label="Gestión de cuentas">{[['cuentas','Cuentas'],['tarjetas','Tarjetas'],['operaciones','Operaciones']].map(([v,n])=><button key={v} className={vista===v?'seleccionada':''} aria-pressed={vista===v} onClick={()=>setVista(v)}>{n}</button>)}</div><button className="primary" onClick={()=>setModal({tipo:vista==='cuentas'?'cuenta':vista==='tarjetas'?'tarjeta':'operacion'})}>{vista==='cuentas'?'Agregar cuenta':vista==='tarjetas'?'Agregar tarjeta':'Mover fondos'}</button></div>
    {error && <p className="error" role="alert">{error}</p>}
    <section className="panel">
    {vista==='cuentas' && <><div className="section-heading"><h2>Tu capital, por ubicación</h2><span>Bancos {money(r.bancos)} · Efectivo {money(r.efectivo)}</span></div><p className="muted">Las tarjetas de débito usan el saldo de su cuenta; no suman dinero adicional.</p>{r.sinDistribuir!==0 && <div className="saldo-anterior"><strong>Saldo anterior sin distribuir: {money(r.sinDistribuir)}</strong><p>Así conservamos tu capital previo sin inventar un banco. Puedes distribuirlo al agregar una cuenta o transferirlo.</p></div>}
    <label className="checkbox-label mostrar-archivadas"><input type="checkbox" checked={archivadas} onChange={e=>setArchivadas(e.target.checked)}/>Mostrar cuentas archivadas</label>
    {!r.cuentas.some(c=>c.id!==SIN_DISTRIBUIR) && <div className="empty"><Icon name="wallet"/><h3>¿Dónde tienes tu dinero?</h3><p>Agrega una cuenta bancaria o una caja de efectivo.</p></div>}
    <div className="lista-cuentas">{r.cuentas.filter(c=>c.id!==SIN_DISTRIBUIR&&(c.activo||archivadas)).map(c=><article className="fila-cuenta" key={c.id}><div><strong>{c.alias}</strong><p>{c.banco || 'Efectivo'} · {tipoCuenta[c.tipo]}{!c.activo?' · Archivada':''}</p></div><div className="saldo-cuenta"><strong>{money(c.saldo)}</strong><small>Disponible {money(c.disponible)} · reservado {money(c.reservado)}</small></div><div className="row-actions"><button className="text-button" onClick={()=>setModal({tipo:'cuenta',item:c})}>Editar cuenta</button><button className="text-button" disabled={ocupado} onClick={()=>estado('cuenta',c)}>{c.activo?'Archivar':'Reactivar'}</button></div></article>)}</div></>}
    {vista==='tarjetas' && <><div className="section-heading"><h2>Tus tarjetas</h2><label>Mes<input type="month" value={mes} onChange={e=>{if(e.target.value)setMes(e.target.value);}}/></label></div><p className="muted">{mayor>0?`Mayor gasto: ${tarjetas.filter(t=>t.gastadoMes===mayor).map(t=>t.alias).join(', ')} · ${money(mayor)}`:'Todavía no hay gastos con tarjetas en este mes.'}</p>{r.creditoSinAsignar>0 && <p className="saldo-anterior">Crédito anterior sin tarjeta asignada: {money(r.creditoSinAsignar)}. No se atribuye automáticamente a una tarjeta.</p>}
    {!tarjetas.length && <div className="empty"><Icon name="card"/><h3>Agrega tus tarjetas</h3><p>Podrás elegir cuál usas al registrar cada gasto.</p></div>}
    <div className="lista-tarjetas">{tarjetas.map(t=><article className="fila-tarjeta" key={t.id}><div className="tarjeta-identidad"><Icon name="card"/><div><h3>{t.alias}</h3><p>{t.banco} · {t.tipo==='debito'?'Débito':'Crédito'}{!t.activo?' · Archivada':''}</p>{t.tipo==='debito' && <small>Cuenta: {cuentaNombre(t.cuentaId)}</small>}</div></div><dl><div><dt>Gastado en {mes}</dt><dd>{money(t.gastadoMes)}</dd></div>{t.tipo==='credito'?<div><dt>Deuda actual</dt><dd>{money(t.deuda)}</dd></div>:<div><dt>Disponible en su cuenta</dt><dd>{money(r.cuentas.find(c=>c.id===t.cuentaId)?.disponible || 0)}</dd></div>}</dl><div className="row-actions">{t.tipo==='credito'&&t.deuda>0&&<button className="secondary" onClick={()=>setModal({tipo:'operacion',item:t})}>Pagar tarjeta</button>}<button className="text-button" onClick={()=>setModal({tipo:'tarjeta',item:t})}>Editar tarjeta</button><button className="text-button" disabled={ocupado} onClick={()=>estado('tarjeta',t)}>{t.activo?'Archivar':'Reactivar'}</button></div></article>)}</div></>}
    {vista==='operaciones' && <><h2>Movimientos de fondos</h2><p className="muted">Aportes, retiros, transferencias y pagos de deuda. El consumo se consulta en Movimientos.</p>{!r.operaciones.length?<p className="empty">Todavía no hay operaciones de fondos.</p>:<div className="table-scroll"><table><thead><tr><th>Fecha</th><th>Operación</th><th>Origen / destino</th><th>Monto</th><th>Estado</th></tr></thead><tbody>{r.operaciones.map(o=><tr key={o.id}><td>{o.fecha}</td><td>{tipoOperacion[o.tipo]}<small className="correo-usuario">{o.descripcion}</small></td><td>{cuentaNombre(o.origenId)} → {o.tarjetaId?r.tarjetas.find(t=>t.id===o.tarjetaId)?.alias:cuentaNombre(o.destinoId)}</td><td>{money(o.monto)}</td><td>{o.anulada?'Anulada':<button className="text-button" disabled={ocupado} onClick={()=>anular(o)}>Anular operación</button>}</td></tr>)}</tbody></table></div>}</>}
    </section>
    {modal?.tipo==='cuenta' && <FormularioCuenta modelo={modal.item} resumen={r} cerrar={()=>setModal(null)} enviar={guardar}/>}
    {modal?.tipo==='tarjeta' && <FormularioTarjeta modelo={modal.item} resumen={r} cerrar={()=>setModal(null)} enviar={guardar}/>}
    {modal?.tipo==='operacion' && <FormularioOperacion resumen={r} tarjeta={modal.item} cerrar={()=>setModal(null)} enviar={guardar}/>}
  </>;
}

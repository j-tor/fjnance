import React, {useState} from 'react';
import {money, localDate, parseAmount} from '../../../shared/finance.js';
import {FormularioFinanciero} from './Cuentas.jsx';
import {calcularPlan,proyeccionMeta} from '../../../shared/cuentas-ahorros.js';
import {guardarObjetivo, registrarAhorro, estadoObjetivo} from '../api.js';

const estadoMeta = {sin_configurar: 'Por configurar', cumplida: 'Cumplida', vencida: 'Plazo vencido', en_curso: 'En curso'};
export function ResumenMeta({meta}) {
  return <><div className="progreso-meta"><strong>{money(meta.ahorrado)}</strong><span>{meta.objetivo>0?`de ${money(meta.objetivo)}`:'Configura el monto de tu objetivo'}</span></div><progress value={meta.porcentaje} max="100" aria-label={`Progreso de ${meta.nombre}`}/><div className="meta-plazo"><span>{estadoMeta[meta.estado]}</span><span>{meta.estado==='cumplida'?'Objetivo alcanzado':meta.objetivo>0?`${meta.mesesRestantes} ${meta.unidad||'meses'} de plazo restantes`:'Sin plazo configurado'}</span></div></>;
}
export function DialogosAhorro({modal, cerrar, resumen, actualizar}) {
  const [tipo, setTipo] = useState(modal?.movimiento || 'aporte');
  async function guardar(v) {const r=modal.tipo==='meta'?await guardarObjetivo({...v,meses:Number(v.meses)},modal.item?.id):await registrarAhorro(v);actualizar(r,'Tus ahorros están actualizados.');cerrar();}
  const [unidad,setUnidad]=useState(modal.item?.unidad||'meses');const [modo,setModo]=useState(modal.item?.modo==='plazo'?'plazo':modal.item?'aporte':'plazo');
  const [objetivo,setObjetivo]=useState(modal.item?.objetivo?(modal.item.objetivo/100).toFixed(2):'');const [periodos,setPeriodos]=useState(modal.item?.meses||12);const [aporte,setAporte]=useState(((modal.item?.mensual||0)/100).toFixed(2));const [inicio,setInicio]=useState(modal.item?.inicio||localDate());
  const base={objetivo:parseAmount(objetivo)||0,mensual:parseAmount(aporte)||0,meses:Number(periodos)||1,unidad,modo,inicio};const plan=calcularPlan(base,modal.item?.ahorrado||0);const vista=proyeccionMeta({...base,...plan},modal.item?.ahorrado||0);
  if(modal.tipo==='meta')return <FormularioFinanciero titulo={modal.item?'Configurar objetivo':'Nuevo objetivo de ahorro'} cerrar={cerrar} enviar={guardar}>
    <label>Nombre del objetivo<input name="nombre" defaultValue={modal.item?.nombre || ''} required maxLength="80" autoFocus/></label><label>Monto objetivo (L)<input name="objetivo" inputMode="decimal" required value={objetivo} onChange={e=>setObjetivo(e.target.value)}/></label>
    <input type="hidden" name="modo" value={modo}/><label>Unidad del plan<select name="unidad" value={unidad} onChange={e=>setUnidad(e.target.value)}><option value="meses">Meses · aporte mensual</option><option value="semanas">Semanas · aporte semanal</option></select></label>
    <div className="form-grid"><label>Plazo en {unidad}<input name="meses" type="number" min="1" max={unidad==='semanas'?2600:600} required value={modo==='aporte'?plan.meses:periodos} onChange={e=>{setModo('plazo');setPeriodos(e.target.value);}}/></label><label>Aporte {unidad==='semanas'?'semanal':'mensual'} (L)<input name="mensual" inputMode="decimal" required value={modo==='plazo'?(plan.mensual/100).toFixed(2):aporte} onChange={e=>{setModo('aporte');setAporte(e.target.value);}}/></label></div>
    <label>Fecha de inicio<input name="inicio" type="date" max={localDate()} required value={inicio} onChange={e=>setInicio(e.target.value)}/></label>
    <p className="ayuda-campo" role="status">{modo==='plazo'?'Aporte calculado según el plazo.':'Plazo calculado según el aporte.'} {vista.estimados===null?'Sin estimación con aporte cero.':vista.estimados===0?'Objetivo alcanzado.':'Estimación: '+vista.estimados+' '+unidad+'.'} Cambia cualquiera de los dos campos para recalcular el otro. Sin intereses ni descuentos automáticos.</p>
  </FormularioFinanciero>;
  const cuentas=resumen.cuentas.filter(c=>c.activo&&(tipo==='aporte'?c.disponible>0:c.reservado>0));
  return <FormularioFinanciero titulo="Movimiento de ahorro" cerrar={cerrar} enviar={guardar} boton={tipo==='aporte'?'Reservar ahorro':'Retirar reserva'}>
    <label>Movimiento<select name="tipo" value={tipo} onChange={e=>setTipo(e.target.value)}><option value="aporte">Reservar ahorro</option><option value="retiro">Retirar reserva</option></select></label>
    <label>Objetivo<select name="metaId" required defaultValue={modal.item?.id || 'general'}>{resumen.metas.filter(m=>m.activo).map(m=><option key={m.id} value={m.id}>{m.id==='general'?'General · sin meta específica':m.nombre}</option>)}</select></label>
    <label>Cuenta donde está el dinero<select name="cuentaId" required defaultValue=""><option value="" disabled>Selecciona una cuenta</option>{cuentas.map(c=><option value={c.id} key={c.id}>{c.alias} · {tipo==='aporte'?'disponible':'reservado'} {money(tipo==='aporte'?c.disponible:c.reservado)}</option>)}</select></label>
    <div className="form-grid"><label>Monto (L)<input name="monto" inputMode="decimal" required/></label><label>Fecha<input name="fecha" type="date" required defaultValue={localDate()} max={localDate()}/></label></div><p className="ayuda-campo">Reservar mantiene el dinero en tu cuenta y reduce el disponible. Retirar una reserva lo libera, sin aumentar ni disminuir tu capital.</p>
    {!cuentas.length&&<p className="error">No hay una cuenta con saldo {tipo==='aporte'?'disponible':'reservado'}. Revisa Cuentas.</p>}
  </FormularioFinanciero>;
}
export default function Ahorros({data, actualizar}) {
  const r=data.resumenCuentas;const general=r.metas.find(m=>m.id==='general');const [modal,setModal]=useState(null);const [error,setError]=useState('');const [ocupado,setOcupado]=useState(false);
  async function archivar(m){setOcupado(true);setError('');try{actualizar(await estadoObjetivo(m.id,!m.activo),'Objetivo actualizado. El historial se conserva.');}catch(e){setError(e.message);}finally{setOcupado(false);}}
  return <><section className="resumen-fondos" aria-label="Resumen de ahorros"><div><span>Total ahorrado</span><strong>{money(r.reservado)}</strong></div><div><span>Capital total</span><strong>{money(r.capital)}</strong></div><div><span>Disponible sin reservar</span><strong>{money(r.disponible)}</strong></div></section>
    <section className="panel objetivo-general"><div className="section-heading"><div><h2>{general.nombre}</h2><p className="muted">Tu objetivo general incluye todas las metas una sola vez.</p></div><button className="secondary" onClick={()=>setModal({tipo:'meta',item:general})}>Configurar objetivo general</button></div><ResumenMeta meta={general}/><div className="acciones-ahorro"><a href="#/ahorros/general">Ver detalle del ahorro general</a><button className="primary" onClick={()=>setModal({tipo:'aporte'})}>Registrar ahorro</button></div></section>
    <div className="acciones-seccion"><h2>Tus objetivos específicos</h2><button className="secondary" onClick={()=>setModal({tipo:'meta'})}>Crear objetivo</button></div>{error&&<p role="alert" className="error">{error}</p>}
    {!r.metas.some(m=>m.id!=='general')&&<section className="panel empty"><h3>¿Qué te gustaría alcanzar?</h3><p>Define el monto, el plazo y tu aporte mensual. Puedes tener varias metas.</p></section>}
    <div className="lista-objetivos">{r.metas.filter(m=>m.id!=='general').map(m=><article className="panel objetivo" key={m.id}><div className="section-heading"><h3><a href={`#/ahorros/${m.id}`}>{m.nombre}</a></h3>{!m.activo&&<span className="status-badge paused">Archivado</span>}</div><ResumenMeta meta={m}/><div className="row-actions"><a href={`#/ahorros/${m.id}`}>Ver detalle</a><button className="text-button" onClick={()=>setModal({tipo:'meta',item:m})}>Editar objetivo</button><button className="text-button" disabled={ocupado} onClick={()=>archivar(m)}>{m.activo?'Archivar':'Reactivar'}</button></div></article>)}</div>
    {modal&&<DialogosAhorro key={modal.tipo+modal.item?.id} modal={modal} cerrar={()=>setModal(null)} resumen={r} actualizar={actualizar}/>}
  </>;
}

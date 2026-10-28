import React, {useState} from 'react';
import {money} from '../../../shared/finance.js';
import {Icon} from '../components/Forms';

export default function Subscriptions({items, create, edit, remove}) {
  const [filter,setFilter] = useState('all');
  const active = items.filter(item => item.active);
  const visible = items.filter(item => filter === 'all' || item.active === (filter === 'active'));
  return <>
    <section className="panel subscriptions-summary"><div><h2>Compromisos mensuales</h2><p className="muted">{active.length} activas de {items.length} suscripciones</p></div><strong>{money(active.reduce((sum,item) => sum + item.amount,0))}</strong></section>
    <section className="panel management-panel"><div className="section-heading"><h2>Tus suscripciones</h2><label className="filter-label">Mostrar<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Todas</option><option value="active">Activas</option><option value="paused">Pausadas</option></select></label></div><p className="muted">Administra nombre, monto, día de corte y estado. Los recordatorios no generan gastos automáticamente.</p>
      {!items.length ? <div className="empty"><Icon name="calendar" width="36" height="36"/><h3>Organiza tus pagos recurrentes</h3><p>Agrega tu primera suscripción para recordar su próximo corte.</p><button className="secondary" onClick={create}>Agregar suscripción</button></div> : !visible.length ? <p className="empty">No hay suscripciones con este estado.</p> : <div className="table-scroll"><table><thead><tr><th>Servicio</th><th>Monto mensual</th><th>Día de corte</th><th>Próximo corte</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{visible.map(item => <tr key={item.id}><td>{item.name}</td><td className="amount">{money(item.amount)}</td><td>Día {item.day}</td><td>{item.next || 'Sin cargo programado'}</td><td><span className={`status-badge ${item.active ? 'active' : 'paused'}`}>{item.active ? 'Activa' : 'Pausada'}</span></td><td><div className="row-actions"><button className="secondary" aria-label={`Editar ${item.name}`} onClick={() => edit(item)}>Editar</button><button className="text-button danger-text" aria-label={`Eliminar ${item.name}`} onClick={() => remove(item)}>Eliminar</button></div></td></tr>)}</tbody></table></div>}
    </section>
  </>;
}

import React from 'react';
import {money} from '../../../shared/finance.js';
import {Icon} from '../components/Forms';

export default function Dashboard({data, summary, month, configureCapital}) {
  const active = data.subscriptions.filter(item => item.active);
  return <>
    <section className="balances" aria-label="Resumen de saldos">
      <article className="balance capital"><div className="balance-label"><Icon name="wallet"/><h2>Capital / Ahorros</h2></div><strong className="balance-value">{money(data.capital)}</strong><div className="balance-footer"><span>Disponible actual</span><button onClick={configureCapital}>Configurar capital</button></div></article>
      <article className="balance credit"><div className="balance-label"><Icon name="card"/><h2>Deuda de Tarjeta de Crédito (Mes)</h2></div><strong className="balance-value">{money(summary.debt)}</strong><div className="balance-footer"><span>Por pagar · {month}</span><span>Sin afectar tus ahorros</span></div></article>
    </section>
    <div className="detail-grid dashboard-details">
      <section className="panel"><div className="section-heading"><h2>¿En qué estás gastando?</h2><span>{money(summary.total)}</span></div><p className="muted">Distribución de gastos del mes seleccionado</p><div className="categories">{summary.totals.map((item,index) => <div className="category" key={item.category}><div><span><i className={`dot color-${index}`}/>{item.category}</span><strong>{money(item.amount)}</strong></div><progress className={`color-${index}`} max={summary.total || 1} value={item.amount} aria-label={item.category}/></div>)}</div></section>
      <section className="panel"><h2>Un vistazo al mes</h2><dl className="summary-list"><div><dt>Gastos registrados</dt><dd>{summary.expenses.length}</dd></div><div><dt>Total gastado</dt><dd>{money(summary.total)}</dd></div><div><dt>Suscripciones activas</dt><dd>{active.length}</dd></div><div><dt>Compromiso mensual fijo</dt><dd>{money(active.reduce((sum,item) => sum + item.amount,0))}</dd></div></dl><p className="muted">Las suscripciones son recordatorios y no se descuentan automáticamente.</p><div className="dashboard-links"><a href="#/movimientos">Gestionar movimientos</a><a href="#/suscripciones">Gestionar suscripciones</a></div></section>
    </div>
  </>;
}

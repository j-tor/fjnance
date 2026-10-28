import React, {useState} from 'react';
import {money} from '../../../shared/finance.js';
import {Icon} from '../components/Forms';

export default function Movements({data, expenses, create, edit, remove}) {
  const [search,setSearch] = useState('');
  const filtered = expenses.filter(item => `${item.description} ${item.category} ${item.method}`.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')));
  return <section className="panel movements management-panel">
    <div className="section-heading"><h2>Movimientos del mes</h2><span>{expenses.length} registros</span></div>
    <label className="search-field">Buscar movimientos<input type="search" placeholder="Descripción, categoría o método" value={search} onChange={event => setSearch(event.target.value)}/></label>
    {!expenses.length ? <div className="empty"><Icon name="receipt" width="36" height="36"/><h3>Aún no hay movimientos este mes</h3><p>Registra un gasto o selecciona otro mes.</p><button className="secondary" onClick={create}>Registrar gasto</button></div> : !filtered.length ? <p className="empty">No hay movimientos que coincidan con la búsqueda.</p> : <div className="table-scroll"><table><thead><tr><th>Descripción</th><th>Categoría</th><th>Fecha</th><th>Método de pago</th><th>Monto</th><th>Comprobante</th><th>Acciones</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id}><td>{item.description}</td><td>{item.category}</td><td>{item.date}</td><td><span className={`method ${item.method === data.methods[1] ? 'is-credit' : ''}`}>{item.method}</span></td><td className="amount">{money(item.amount)}</td><td>{item.receipt ? <a href={item.receipt.url} download={item.receipt.name}>Descargar factura</a> : <span className="muted">Sin adjunto</span>}</td><td><div className="row-actions"><button className="secondary" aria-label={`Editar ${item.description}`} onClick={() => edit(item)}>Editar</button><button className="text-button danger-text" aria-label={`Eliminar ${item.description}`} onClick={() => remove(item)}>Eliminar</button></div></td></tr>)}</tbody></table></div>}
  </section>;
}

import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {localDate, monthSummary} from '../../shared/finance';
import {api, Icon, ExpenseForm, CapitalForm} from './components/Forms';
import SubscriptionForm from './components/SubscriptionForm';
import DeleteConfirm from './components/DeleteConfirm';
import Dashboard from './pages/Dashboard';
import Movements from './pages/Movements';
import Subscriptions from './pages/Subscriptions';
import './styles.css';

const routes = {
  '/': {label:'Inicio', title:'Tu dinero, en perspectiva.', description:'Todo lo que tienes. Todo lo que debes. Un solo lugar.', icon:'overview'},
  '/movimientos': {label:'Movimientos', title:'Tus movimientos', description:'Registra y edita tus gastos. Cada cambio actualiza tus saldos.', icon:'receipt'},
  '/suscripciones': {label:'Suscripciones', title:'Tus suscripciones', description:'Mantén tus pagos recurrentes y próximos cortes bajo control.', icon:'calendar'},
};
function currentRoute() {return window.location.hash.slice(1) || '/';}
function App() {
  const [route,setRoute] = useState(currentRoute);
  const [data,setData] = useState(null); const [error,setError] = useState(''); const [loading,setLoading] = useState(true);
  const [modal,setModal] = useState(null); const [month,setMonth] = useState(localDate().slice(0,7)); const [notice,setNotice] = useState('');
  async function load() {setLoading(true);setError('');try{setData(await api('state'));}catch{setError('No se pudo conectar con el servidor. Comprueba que el backend esté ejecutándose.');}finally{setLoading(false);}}
  useEffect(() => {load();},[]);
  useEffect(() => {
    function navigate() {setRoute(currentRoute());setModal(null);setNotice('');window.scrollTo({top:0});}
    window.addEventListener('hashchange',navigate);return () => window.removeEventListener('hashchange',navigate);
  },[]);
  const page = routes[route];
  useEffect(() => {document.title = `${page?.label || 'Página no encontrada'} · Fjnance`;},[page]);
  const summary = data && monthSummary(data,month);
  function finish(updated,message) {setData(updated);setModal(null);setNotice(message);}
  function createExpense() {setModal({type:'expense'});}
  return <div className="app-shell"><aside className="sidebar"><a className="brand" href="#/"><span className="brand-mark">f.</span> fjnance</a><p className="sidebar-caption">Tu espacio personal</p><nav aria-label="Navegación principal">{Object.entries(routes).map(([path,item]) => <a key={path} href={`#${path}`} aria-current={route === path ? 'page' : undefined}><Icon name={item.icon}/>{item.label}</a>)}</nav><div className="sidebar-bottom"><Icon name="wallet"/><p>Decisiones pequeñas.<br/><strong>Más tranquilidad.</strong></p></div></aside>
    <main><header className="topbar"><span>Finanzas personales / {page?.label || 'Página no encontrada'}</span><span className="currency">HNL · Lempiras</span></header>
      <div className="page-heading"><div><h1>{page?.title || 'Página no encontrada'}</h1><p className="muted">{page?.description || 'Selecciona una sección del menú para continuar.'}</p></div>{data && route === '/movimientos' && <button className="primary" onClick={createExpense}><Icon name="plus"/>Registrar gasto</button>}{data && route === '/suscripciones' && <button className="primary" onClick={() => setModal({type:'subscription'})}><Icon name="plus"/>Agregar suscripción</button>}</div>
      {loading && <p className="status" role="status">Cargando tus finanzas…</p>}{error && <div className="error" role="alert">{error}<button className="secondary" onClick={load}>Reintentar</button></div>}
      {data && page && <>
        {route !== '/suscripciones' && <div className="period"><label htmlFor="month">{route === '/' ? 'Tu resumen de' : 'Movimientos de'}</label><input id="month" type="month" required value={month} onChange={event => {if(event.target.value)setMonth(event.target.value);}}/><span>Crédito y gastos por mes calendario</span></div>}
        <p role="status" className="notice">{notice || 'Tus datos se guardan en este servidor y se mantienen al recargar.'}</p>
        {route === '/' && <Dashboard data={data} summary={summary} month={month} configureCapital={() => setModal({type:'capital'})}/>}
        {route === '/movimientos' && <Movements data={data} expenses={summary.expenses} create={createExpense} edit={item => setModal({type:'expense',item})} remove={item => setModal({type:'delete',kind:'expense',item})}/>}
        {route === '/suscripciones' && <Subscriptions items={data.subscriptions} create={() => setModal({type:'subscription'})} edit={item => setModal({type:'subscription',item})} remove={item => setModal({type:'delete',kind:'subscription',item})}/>}
        <footer>Fjnance · Una visión clara de tus finanzas.</footer>
      </>}
    </main>
    {modal?.type === 'expense' && <ExpenseForm data={data} expense={modal.item} close={() => setModal(null)} save={async expense => {const updated = await api(modal.item ? `expenses/${modal.item.id}` : 'expenses',{method:modal.item ? 'PUT' : 'POST',body:expense});setMonth(expense.date.slice(0,7));finish(updated,modal.item ? 'Movimiento actualizado. Tus saldos están al día.' : 'Gasto registrado. Tus saldos están actualizados.');}}/>}
    {modal?.type === 'capital' && <CapitalForm data={data} close={() => setModal(null)} save={async amount => finish(await api('capital',{method:'PUT',body:{amount}}),'Capital inicial actualizado.')}/>}
    {modal?.type === 'subscription' && <SubscriptionForm subscription={modal.item} close={() => setModal(null)} save={async subscription => finish(await api(modal.item ? `subscriptions/${modal.item.id}` : 'subscriptions',{method:modal.item ? 'PUT' : 'POST',body:subscription}),modal.item ? 'Suscripción actualizada.' : 'Suscripción agregada.')}/>}
    {modal?.type === 'delete' && <DeleteConfirm target={modal} close={() => setModal(null)} remove={async () => finish(await api(`${modal.kind === 'expense' ? 'expenses' : 'subscriptions'}/${modal.item.id}`,{method:'DELETE',body:{}}),modal.kind === 'expense' ? 'Movimiento eliminado. Saldos recalculados.' : 'Suscripción eliminada.')}/>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);

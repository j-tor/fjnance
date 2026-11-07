import React, {useEffect, useState, useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {localDate, monthSummary} from '../../shared/finance';
import {Icon, ExpenseForm} from './components/Forms';
import SubscriptionForm from './components/SubscriptionForm';
import DeleteConfirm from './components/DeleteConfirm';
import Dashboard from './pages/Dashboard';
import Movements from './pages/Movements';
import Subscriptions from './pages/Subscriptions';
import './styles.css';
import Acceso from './components/Acceso.jsx';
import Perfil from './components/Perfil.jsx';
import PerfilSidebar from './components/PerfilSidebar.jsx';
import Cuentas from './pages/Cuentas.jsx';
import Ahorros from './pages/Ahorros.jsx';
import ObjetivoAhorro from './pages/ObjetivoAhorro.jsx';
import Usuarios from './pages/Usuarios.jsx';
import {obtenerSesion, cerrarSesion} from './api.js';
import {obtenerEstado, crearMovimiento, actualizarMovimiento, eliminarMovimiento, crearSuscripcion, actualizarSuscripcion, eliminarSuscripcion} from './api.js';

const routes = {
  '/': {label:'Inicio', title:'Tu dinero, en perspectiva.', description:'Todo lo que tienes. Todo lo que debes. Un solo lugar.', icon:'overview'},
  '/movimientos': {label:'Movimientos', title:'Tus movimientos', description:'Registra y edita tus gastos. Cada cambio actualiza tus saldos.', icon:'receipt'},
  '/suscripciones': {label:'Suscripciones', title:'Tus suscripciones', description:'Mantén tus pagos recurrentes y próximos cortes bajo control.', icon:'calendar'},
  '/cuentas': {label:'Cuentas y tarjetas', title:'Tu dinero, bien ubicado.', description:'Organiza bancos, efectivo y tarjetas. Cada saldo cuenta una sola vez.', icon:'wallet'},
  '/ahorros': {label:'Ahorros', title:'Dale un destino a tu ahorro.', description:'Un objetivo general y varias metas, con un plan que puedes ajustar.', icon:'calendar'},
  '/cuenta': {label:'Mi cuenta', title:'Tu cuenta', description:'Tus datos de acceso y la seguridad de tu cuenta.', icon:'wallet'},
  '/usuarios': {label:'Usuarios', title:'Administración de usuarios', description:'Gestiona cuentas y permisos de acceso.', icon:'overview'},
};
function currentRoute() {return window.location.hash.slice(1) || '/';}
function App() {
  const identidad = useRef(null); const secuenciaCarga = useRef(0);
  const [usuario, setUsuario] = useState(null); const [comprobando, setComprobando] = useState(true);
  const [route,setRoute] = useState(currentRoute);
  const [data,setData] = useState(null); const [error,setError] = useState(''); const [loading,setLoading] = useState(true);
  const [modal,setModal] = useState(null); const [month,setMonth] = useState(localDate().slice(0,7)); const [notice,setNotice] = useState('');
  async function load() {const secuencia = ++secuenciaCarga.current;setLoading(true);setError('');try{const estado=await obtenerEstado();if(secuencia===secuenciaCarga.current)setData(estado);}catch(e){if(secuencia===secuenciaCarga.current)setError(e.message);}finally{if(secuencia===secuenciaCarga.current)setLoading(false);}}
  useEffect(() => {obtenerSesion().then(r => {identidad.current=r.usuario.id;setUsuario(r.usuario); load();}).catch(e => {if(e.status !== 401)setError(e.message);}).finally(() => setComprobando(false));},[]);
  useEffect(() => {const expirar = () => {identidad.current=null;secuenciaCarga.current++;setUsuario(null);setData(null);setModal(null);setError('Tu sesión terminó. Vuelve a acceder.');};window.addEventListener('sesion-expirada', expirar);return () => window.removeEventListener('sesion-expirada', expirar);}, []);
  useEffect(() => {
    function navigate() {setRoute(currentRoute());setModal(null);setNotice('');window.scrollTo({top:0});}
    window.addEventListener('hashchange',navigate);return () => window.removeEventListener('hashchange',navigate);
  },[]);
  const objetivoId = route.startsWith('/ahorros/') ? route.slice('/ahorros/'.length) : null;
  const page = objetivoId ? {...routes['/ahorros'], title:'Tu objetivo de ahorro'} : route === '/usuarios' && usuario?.rol !== 'admin' ? null : routes[route];
  useEffect(() => {document.title = `${page?.label || 'Página no encontrada'} · Fjnance`;},[page]);
  const summary = data && monthSummary(data,month);
  function finish(updated,message) {if(identidad.current!==usuario?.id)return;setData(updated);setModal(null);setNotice(message);}
  function createExpense() {setModal({type:'expense'});}
  async function salir(mensaje = '') {try {if(!mensaje)await cerrarSesion();identidad.current=null;secuenciaCarga.current++;setUsuario(null);setData(null);setModal(null);setError(mensaje);} catch(e){setError(e.message);}}
  if (comprobando) return <div className="sesion-cargando" role="status">Preparando tu espacio…</div>;
  if (!usuario) return <Acceso aviso={error} entrar={u => {identidad.current=u.id;setData(null);setUsuario(u);setError('');load();}}/>;
  return <div className="app-shell"><aside className="sidebar"><a className="brand" href="#/"><span className="brand-mark">f.</span> fjnance</a><p className="sidebar-caption">Tu espacio personal</p><nav aria-label="Navegación principal">{Object.entries(routes).filter(([path]) => path !== '/cuenta' && (path !== '/usuarios' || usuario.rol === 'admin')).map(([path,item]) => <a key={path} href={`#${path}`} aria-current={route === path ? 'page' : undefined}><Icon name={item.icon}/>{item.label}</a>)}</nav><PerfilSidebar usuario={usuario} salir={salir} activo={route==='/cuenta'}/></aside>
    <main><header className="topbar"><span>Finanzas personales / {page?.label || 'Página no encontrada'}</span><div className="cuenta-barra"><span>{usuario.nombre}</span></div></header>
      <div className="page-heading"><div><h1>{page?.title || 'Página no encontrada'}</h1><p className="muted">{page?.description || 'Selecciona una sección del menú para continuar.'}</p></div>{data && route === '/movimientos' && <button className="primary" onClick={createExpense}><Icon name="plus"/>Registrar gasto</button>}{data && route === '/suscripciones' && <button className="primary" onClick={() => setModal({type:'subscription'})}><Icon name="plus"/>Agregar suscripción</button>}</div>
      {loading && <p className="status" role="status">Cargando tus finanzas…</p>}{error && <div className="error" role="alert">{error}<button className="secondary" onClick={load}>Reintentar</button></div>}
      {data && page && <>
        {['/', '/movimientos'].includes(route) && <div className="period"><label htmlFor="month">{route === '/' ? 'Tu resumen de' : 'Movimientos de'}</label><input id="month" type="month" required value={month} onChange={event => {if(event.target.value)setMonth(event.target.value);}}/><span>Crédito y gastos por mes calendario</span></div>}
        <p role="status" className="notice">{notice || 'Tus datos se guardan en este servidor y se mantienen al recargar.'}</p>
        {route === '/cuentas' && <Cuentas data={data} actualizar={finish}/>}
        {route === '/ahorros' && <Ahorros data={data} actualizar={finish}/>}
        {objetivoId && <ObjetivoAhorro key={objetivoId} id={objetivoId} data={data} actualizar={finish}/>}
        {route === '/cuenta' && <Perfil usuario={usuario} salir={salir} data={data} actualizar={finish}/>}
        {route === '/usuarios' && usuario.rol === 'admin' && <Usuarios usuario={usuario}/>}
        {route === '/' && <Dashboard data={data} summary={summary} month={month} configureCapital={() => {window.location.hash='/cuentas';}}/>}
        {route === '/movimientos' && <Movements data={data} expenses={summary.expenses} create={createExpense} edit={item => setModal({type:'expense',item})} remove={item => setModal({type:'delete',kind:'expense',item})}/>}
        {route === '/suscripciones' && <Subscriptions tarjetas={data.resumenCuentas.tarjetas} items={data.subscriptions} create={() => setModal({type:'subscription'})} edit={item => setModal({type:'subscription',item})} remove={item => setModal({type:'delete',kind:'subscription',item})}/>}
        <footer>Fjnance · Una visión clara de tus finanzas.</footer>
      </>}
    </main>
    {modal?.type === 'expense' && <ExpenseForm data={data} expense={modal.item} close={() => setModal(null)} save={async expense => {const updated = await (modal.item ? actualizarMovimiento(modal.item.id, expense) : crearMovimiento(expense));setMonth(expense.date.slice(0,7));finish(updated,modal.item ? 'Movimiento actualizado. Tus saldos están al día.' : 'Gasto registrado. Tus saldos están actualizados.');}}/>}
    {modal?.type === 'subscription' && <SubscriptionForm tarjetas={data.resumenCuentas.tarjetas} subscription={modal.item} close={() => setModal(null)} save={async subscription => finish(await (modal.item ? actualizarSuscripcion(modal.item.id, subscription) : crearSuscripcion(subscription)),modal.item ? 'Suscripción actualizada.' : 'Suscripción agregada.')}/>}
    {modal?.type === 'delete' && <DeleteConfirm target={modal} close={() => setModal(null)} remove={async () => finish(await (modal.kind === 'expense' ? eliminarMovimiento(modal.item.id) : eliminarSuscripcion(modal.item.id)),modal.kind === 'expense' ? 'Movimiento eliminado. Saldos recalculados.' : 'Suscripción eliminada.')}/>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);

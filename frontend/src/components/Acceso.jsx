import React, {useState} from 'react';
import {accederCuenta} from '../api.js';

export default function Acceso({entrar, aviso}) {
  const [registro, setRegistro] = useState(false); const [error, setError] = useState(''); const [ocupado, setOcupado] = useState(false);
  async function enviar(evento) {
    evento.preventDefault(); if (ocupado) return;
    const datos = new FormData(evento.currentTarget); setError(''); setOcupado(true);
    try {const r = await accederCuenta(Object.fromEntries(datos), registro); entrar(r.usuario);}
    catch (e) {setError(e.message);} finally {setOcupado(false);}
  }
  return <div className="acceso-layout"><aside className="acceso-presentacion"><a className="brand" href="#/"><span className="brand-mark">f.</span> fjnance</a><div><h1>Tu dinero.<br/>Tu espacio.</h1><p>Una cuenta para organizar tus movimientos, tus pagos y tus próximas decisiones.</p></div><p>Cada cuenta mantiene sus finanzas separadas.</p></aside><main className="acceso-contenido"><div className="acceso-formulario"><h2>{registro ? 'Crea tu cuenta' : 'Bienvenido de nuevo'}</h2><p className="muted">{registro ? 'Empieza con un espacio propio para tus finanzas.' : 'Accede para continuar donde lo dejaste.'}</p>{aviso && <p className="notice" role="status">{aviso}</p>}<form onSubmit={enviar} aria-label={registro ? 'Crear cuenta' : 'Acceder'}><fieldset disabled={ocupado}>
    {registro && <label>Nombre<input name="nombre" autoComplete="name" maxLength="80" required/></label>}
    <label>Correo electrónico<input name="correo" type="email" autoComplete="username" maxLength="254" required/></label>
    <label>Contraseña<input name="clave" type="password" autoComplete={registro ? 'new-password' : 'current-password'} minLength={registro ? 12 : undefined} maxLength="128" required/></label>
    {registro && <p className="ayuda-campo">Usa entre 12 y 128 caracteres. Puedes pegar una contraseña de tu gestor.</p>}
    {error && <p role="alert" className="error">{error}</p>}
    <button className="primary acceso-enviar" type="submit">{ocupado ? 'Un momento…' : registro ? 'Crear cuenta' : 'Acceder'}</button>
    </fieldset></form><p className="acceso-alternar">{registro ? '¿Ya tienes cuenta?' : '¿Primera vez aquí?'} <button className="text-button" onClick={() => {setRegistro(!registro); setError('');}} disabled={ocupado}>{registro ? 'Accede' : 'Crea una cuenta'}</button></p></div></main></div>;
}

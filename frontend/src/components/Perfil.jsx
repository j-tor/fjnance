import React, {useState} from 'react';
import {cambiarClave} from '../api.js';
export default function Perfil({usuario, salir}) {
  const [error, setError] = useState(''); const [ocupado, setOcupado] = useState(false);
  async function enviar(e) {
    e.preventDefault(); setError(''); setOcupado(true);
    const datos = new FormData(e.currentTarget);
    try {await cambiarClave(Object.fromEntries(datos)); salir('Contraseña actualizada. Vuelve a acceder.');} catch (r) {setError(r.message);} finally {setOcupado(false);}
  }
  return <section className="panel perfil-panel"><h2>Tu cuenta</h2><dl className="summary-list"><div><dt>Nombre</dt><dd>{usuario.nombre}</dd></div><div><dt>Correo</dt><dd>{usuario.correo}</dd></div><div><dt>Acceso</dt><dd>{usuario.rol === 'admin' ? 'Administrador' : 'Usuario'}</dd></div></dl><h3>Cambiar contraseña</h3><p className="muted">Al cambiarla se cerrarán todas tus sesiones.</p><form onSubmit={enviar} aria-label="Cambiar contraseña"><fieldset disabled={ocupado}><label>Contraseña actual<input name="actual" type="password" autoComplete="current-password" required maxLength="128"/></label><label>Nueva contraseña<input name="nueva" type="password" autoComplete="new-password" minLength="12" maxLength="128" required/></label>{error && <p className="error" role="alert">{error}</p>}<div className="form-actions"><button className="primary">{ocupado ? 'Guardando…' : 'Actualizar contraseña'}</button></div></fieldset></form></section>;
}

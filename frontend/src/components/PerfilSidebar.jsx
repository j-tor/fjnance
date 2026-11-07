import React from 'react';
export default function PerfilSidebar({usuario, salir, activo}) {
  const iniciales = usuario.nombre.trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase();
  return <div className="perfil-sidebar"><a href="#/cuenta" aria-label="Mi perfil" aria-current={activo ? 'page' : undefined}><span className="avatar-perfil" aria-hidden="true">{iniciales}</span><span className="identidad-perfil"><strong>{usuario.nombre}</strong><small>Mi perfil</small></span><span aria-hidden="true">›</span></a><button className="text-button" onClick={() => salir()}>Salir</button></div>;
}

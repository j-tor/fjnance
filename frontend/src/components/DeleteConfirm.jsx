import React, {useRef, useState} from 'react';
import {Modal} from './Forms';

export default function DeleteConfirm({target, close, remove}) {
  const [busy,setBusy] = useState(false);const [error,setError] = useState('');const lock = useRef(false);
  return <Modal title={target.kind === 'expense' ? 'Eliminar movimiento' : 'Eliminar suscripción'} close={() => !busy && close()}><p>¿Eliminar «{target.item.description || target.item.name}»?</p><p className="method-note">{target.kind === 'expense' ? 'Se recalcularán el capital, la deuda y las categorías. El comprobante también se eliminará.' : 'Dejará de aparecer en tus recordatorios y totales.'} Esta acción no se puede deshacer.</p>{error && <p className="error" role="alert">{error}</p>}<div className="form-actions"><button className="secondary" disabled={busy} autoFocus onClick={close}>Cancelar</button><button className="primary danger-button" disabled={busy} onClick={async () => {if(lock.current)return;lock.current=true;setBusy(true);try{await remove();}catch(err){setError(err.message);}finally{lock.current=false;setBusy(false);}}}>{busy ? 'Eliminando…' : 'Eliminar'}</button></div></Modal>;
}

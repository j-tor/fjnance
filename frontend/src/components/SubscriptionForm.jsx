import React, {useRef, useState} from 'react';
import {parseAmount} from '../../../shared/finance.js';
import {Modal} from './Forms';

export default function SubscriptionForm({subscription, save, close}) {
  const [form,setForm] = useState(subscription ? {...subscription,amount:(subscription.amount / 100).toFixed(2)} : {name:'',amount:'',day:1,active:true});
  const [error,setError] = useState(''); const [busy,setBusy] = useState(false); const lock = useRef(false);
  function change(event) {const {name,value,type,checked} = event.target;setForm({...form,[name]:type === 'checkbox' ? checked : name === 'day' ? Number(value) : value});}
  async function submit(event) {
    event.preventDefault();if(lock.current) return;
    if(!form.name.trim() || parseAmount(form.amount) === null || !Number.isInteger(form.day) || form.day < 1 || form.day > 31) return setError('Revisa el nombre, el monto y el día de corte (1 a 31).');
    lock.current=true;setBusy(true);setError('');
    try {await save({name:form.name.trim(),amount:form.amount,day:form.day,active:form.active});}catch(err){setError(err.message);}finally{lock.current=false;setBusy(false);}
  }
  return <Modal title={subscription ? 'Editar suscripción' : 'Agregar suscripción'} close={() => !busy && close()}><form onSubmit={submit}><fieldset disabled={busy}><label>Nombre del servicio<input autoFocus name="name" value={form.name} onChange={change} required maxLength="80" placeholder="Ej. Spotify"/></label><div className="form-grid"><label>Monto mensual (L)<input name="amount" inputMode="decimal" value={form.amount} onChange={change} required placeholder="0.00"/></label><label>Día de corte<input name="day" type="number" min="1" max="31" step="1" value={form.day} onChange={change} required/></label></div><p className="method-note">Si el mes no tiene ese día, el corte será el último día del mes.</p><label className="checkbox-label"><input name="active" type="checkbox" checked={form.active} onChange={change}/>Suscripción activa</label><p className="method-note">Las pausadas no cuentan en el total mensual ni muestran próximo corte.</p></fieldset>{error && <p className="error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="secondary" disabled={busy} onClick={close}>Cancelar</button><button className="primary" disabled={busy}>{busy ? 'Guardando…' : subscription ? 'Guardar cambios' : 'Agregar suscripción'}</button></div></form></Modal>;
}

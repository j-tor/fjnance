import React, {useEffect, useRef, useState} from 'react';

import {localDate, parseAmount, validateExpense} from '../../../shared/finance.js';


export async function api(path, options) {
  const response = await fetch(`/api/${path}`, options && {method: options.method || 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(options.body)});
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'No se pudo guardar.'); return data;
}
export function Icon({name, ...props}) {
  const paths = {overview: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z', plus:'M12 5v14M5 12h14', close:'m6 6 12 12M6 18 18 6', receipt:'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6', wallet:'M3 6h17v14H3zM3 6V4h14v2M15 11h6v5h-6z', card:'M3 5h18v14H3zM3 10h18', calendar:'M4 5h16v16H4zM8 3v4M16 3v4M4 11h16'};
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.receipt}/></svg>;
}
export function Modal({title, close, children}) {
  const ref = useRef();
  useEffect(() => {const previous = document.activeElement; const dialog = ref.current; dialog.showModal(); return () => {dialog.close(); previous?.focus();};}, []);
  return <dialog ref={ref} onCancel={event => {event.preventDefault();close();}} onClick={event => {if(event.target === ref.current) close();}} aria-labelledby="modal-title"><div className="dialog-head"><h2 id="modal-title">{title}</h2><button className="icon-button" aria-label="Cerrar" onClick={close}><Icon name="close"/></button></div>{children}</dialog>;
}
export function ExpenseForm({data, save, close, expense}) {
  const [form, setForm] = useState(expense ? {...expense, amount: (expense.amount / 100).toFixed(2)} : {amount:'', description:'', date:localDate(), method:data.methods[0], category:''});
  const [receipt, setReceipt] = useState(undefined); const [busy,setBusy] = useState(false); const [reading,setReading] = useState(false); const [error,setError] = useState('');
  const lock = useRef(false);
  function change(event) {setForm({...form,[event.target.name]:event.target.value});}
  async function attach(event) {
    const file = event.target.files[0]; setError(''); if(!file) return;
    if(file.size > 5 * 1024 * 1024 || !['application/pdf','image/png','image/jpeg','image/webp'].includes(file.type)) {event.target.value='';setError('Usa un PDF, PNG, JPEG o WebP de hasta 5 MB.');return;}
    setReading(true);
    try {const base64 = await new Promise((resolve,reject) => {const reader = new FileReader();reader.onload = () => resolve(reader.result.split(',')[1]);reader.onerror = reject;reader.readAsDataURL(file);}); setReceipt({name:file.name,type:file.type,base64});} catch {setError('No se pudo leer el archivo. Inténtalo de nuevo.');} finally {setReading(false);}
  }
  async function submit(event) {
    event.preventDefault();if(lock.current || reading) return;
    const message = validateExpense({...form,amount:parseAmount(form.amount)});if(message) return setError(message);
    lock.current=true;setBusy(true);setError('');
    try {const {receipt: ignoredReceipt, ...fields} = form; await save({...fields, ...(receipt !== undefined ? {receipt} : {})});} catch(err) {setError(err.message);} finally {lock.current=false;setBusy(false);}
  }
  return <Modal title={expense ? "Editar movimiento" : "Registrar gasto"} close={() => !busy && close()}><form onSubmit={submit}>
    <p className="muted">Un registro claro, un saldo al día.</p><fieldset disabled={busy}>
    <div className="form-grid"><label>Monto (L)<input autoFocus name="amount" inputMode="decimal" placeholder="0.00" required value={form.amount} onChange={change}/></label><label>Fecha<input name="date" type="date" required max={localDate()} value={form.date} onChange={change}/></label></div>
    <label>Descripción<input name="description" maxLength="160" placeholder="¿En qué gastaste?" required value={form.description} onChange={change}/></label>
    <label>Método de pago<select name="method" value={form.method} onChange={change}>{data.methods.map(method => <option key={method}>{method}</option>)}</select></label>
    <p className="method-note">{form.method === data.methods[0] ? 'Este gasto se descontará del capital disponible.' : 'Este gasto se sumará al crédito del mes, sin tocar tu capital.'}</p>
    <label>Categoría<select name="category" value={form.category} required onChange={change}><option value="" disabled>Seleccionar categoría</option>{data.categories.map(category => <option key={category}>{category}</option>)}</select></label>
    <label className="file-input"><Icon name="receipt"/>Adjuntar factura / comprobante<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={attach} disabled={reading}/></label><small>{reading ? 'Leyendo archivo…' : receipt ? receipt.name : receipt === undefined && expense?.receipt ? expense.receipt.name : 'Opcional · PDF o imagen · hasta 5 MB'}</small>
    {(receipt || (receipt === undefined && expense?.receipt)) && <button type="button" className="text-button" disabled={reading} onClick={() => setReceipt(null)}>Quitar comprobante</button>}
    </fieldset>{error && <p className="error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="secondary" disabled={busy} onClick={close}>Cancelar</button><button className="primary" disabled={busy || reading}>{busy ? 'Guardando…' : expense ? 'Guardar cambios' : 'Guardar gasto'}</button></div>
  </form></Modal>;
}
export function CapitalForm({data, save, close}) {
  const [amount,setAmount] = useState(String(data.initialCapital / 100)); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  return <Modal title="Configurar capital inicial" close={() => !busy && close()}><form onSubmit={async event => {event.preventDefault();if(busy)return;setBusy(true);try{await save(amount);}catch(err){setError(err.message);}finally{setBusy(false);}}}><p className="muted">Es el saldo con el que empiezas. Los gastos en efectivo/débito registrados se restan de este valor.</p><label>Capital inicial (L)<input autoFocus required inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)}/></label>{error && <p role="alert" className="error">{error}</p>}<div className="form-actions"><button className="primary" disabled={busy}>{busy?'Guardando…':'Guardar capital'}</button></div></form></Modal>;
}


import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../src/server.js';
import {CATEGORIES, METHODS, localDate, monthSummary, nextSubscriptionDate} from '../../shared/finance.js';

test('edición y eliminación recalculan saldos y conservan o retiran comprobantes', async () => {
  const dir = await mkdtemp(path.join(tmpdir(),'fjnance-management-'));
  const server = await createApp({dataDir:dir});await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  async function request(route,method='GET',body) {const res = await fetch(`http://127.0.0.1:${server.address().port}/api/${route}`,{method,headers:{'Content-Type':'application/json'},body:body && JSON.stringify(body)});return {status:res.status,data:await res.json()};}
  const receipt = {name:'factura.pdf',type:'application/pdf',base64:Buffer.from('%PDF-1.4\ntest').toString('base64')};
  const expense = {amount:'100.25',description:'Cena',date:localDate(),method:METHODS[0],category:CATEGORIES[0],receipt};
  try {
    await request('capital','PUT',{amount:'1000'});
    const created = (await request('expenses','POST',expense)).data;const id = created.expenses[0].id;
    assert.equal(created.capital,89975);
    const {receipt: ignored, ...withoutReceipt} = expense;
    let result = await request(`expenses/${id}`,'PUT',{...withoutReceipt,amount:'200',method:METHODS[1],category:CATEGORIES[1],date:'2020-02-01'});
    assert.equal(result.status,200);assert.equal(result.data.capital,100000);assert.equal(result.data.expenses.length,1);
    assert.equal(result.data.expenses[0].receipt.name,'factura.pdf');
    assert.equal(monthSummary(result.data,'2020-02').debt,20000);assert.equal(monthSummary(result.data,'2020-02').totals[1].amount,20000);
    result = await request(`expenses/${id}`,'PUT',{...withoutReceipt,amount:'50',receipt:null});
    assert.equal(result.data.capital,95000);assert.equal(result.data.expenses[0].receipt,null);
    assert.equal((await request(`receipts/${id}`)).status,404);
    assert.equal((await request(`expenses/${id}`,'PUT',{...expense,amount:'-1'})).status,400);
    assert.equal((await request('state')).data.capital,95000);
    result = await request(`expenses/${id}`,'DELETE',{});
    assert.equal(result.data.capital,100000);assert.equal(result.data.expenses.length,0);
    assert.equal((await request(`expenses/${id}`,'PUT',withoutReceipt)).status,404);
    assert.equal((await request(`expenses/${id}`,'DELETE',{})).status,404);
  } finally {await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});}
});

test('suscripciones: migración sin perder gastos, CRUD, pausa y persistencia', async () => {
  const dir = await mkdtemp(path.join(tmpdir(),'fjnance-subscriptions-'));
  await writeFile(path.join(dir,'finance.json'),JSON.stringify({initialCapital:12500,expenses:[]}));
  let server = await createApp({dataDir:dir});
  const listen = () => new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const close = () => new Promise(resolve=>server.close(resolve));await listen();
  async function request(route,method='GET',body) {const res = await fetch(`http://127.0.0.1:${server.address().port}/api/${route}`,{method,headers:{'Content-Type':'application/json'},body:body && JSON.stringify(body)});return {status:res.status,data:await res.json()};}
  try {
    let result = await request('state');assert.equal(result.data.capital,12500);assert.equal(result.data.subscriptions.length,3);
    const subscription = {name:'Mi servicio',amount:'25.50',day:31,active:true};
    result = await request('subscriptions','POST',subscription);assert.equal(result.status,201);
    const id = result.data.subscriptions.find(item=>item.name===subscription.name).id;
    result = await request(`subscriptions/${id}`,'PUT',{...subscription,name:'Nuevo nombre',amount:'30',active:false});
    const paused = result.data.subscriptions.find(item=>item.id===id);
    assert.equal(paused.amount,3000);assert.equal(paused.active,false);assert.equal(paused.next,null);assert.equal(result.data.capital,12500);
    for (const invalid of [{amount:'0'},{day:32},{day:1.5},{name:'  '},{active:'yes'}]) assert.equal((await request(`subscriptions/${id}`,'PUT',{...subscription,...invalid})).status,400);
    await close();server = await createApp({dataDir:dir});await listen();
    result = await request('state');assert.equal(result.data.subscriptions.find(item=>item.id===id).name,'Nuevo nombre');
    result = await request(`subscriptions/${id}`,'DELETE',{});assert.equal(result.data.subscriptions.length,3);
    assert.equal((await request(`subscriptions/${id}`,'PUT',subscription)).status,404);
    for (const item of result.data.subscriptions) await request(`subscriptions/${item.id}`,'DELETE',{});
    await close();server = await createApp({dataDir:dir});await listen();
    assert.equal((await request('state')).data.subscriptions.length,0);
  } finally {await close();await rm(dir,{recursive:true,force:true});}
});

test('corte mensual ajusta días inexistentes y cambio de año', () => {
  assert.equal(nextSubscriptionDate(31,new Date(2026,1,1)),'2026-02-28');
  assert.equal(nextSubscriptionDate(31,new Date(2024,1,1)),'2024-02-29');
  assert.equal(nextSubscriptionDate(5,new Date(2026,11,6)),'2027-01-05');
  assert.equal(nextSubscriptionDate(5,new Date(2026,11,5)),'2026-12-05');
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createApp} from '../src/server.js';
import {CATEGORIES, METHODS, localDate} from '../../shared/finance.js';

test('API: capital, crédito, validaciones, comprobante y persistencia', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(),'fjnance-test-'));
  let server = await createApp({dataDir});
  const listen = () => new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const close = () => new Promise(resolve => server.close(resolve));
  await listen();
  const request = async (route, method='GET', body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${route}`,{method,headers:{'Content-Type':'application/json'},body:body && JSON.stringify(body)});
    return {status:response.status, data:await response.json()};
  };
  try {
    const endpoint = `http://127.0.0.1:${server.address().port}/api/expenses`;
    assert.equal((await fetch(endpoint,{method:'POST',headers:{Origin:'https://external.example','Content-Type':'application/json'},body:'{}'})).status,403);
    assert.equal((await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'})).status,415);
    assert.equal((await request('state')).data.capital,0);
    assert.equal((await request('capital','PUT',{amount:'1000.00'})).data.capital,100000);
    const expense = {amount:'10.10',description:'Cena',date:localDate(),method:METHODS[0],category:CATEGORIES[0]};
    let response = await request('expenses','POST',expense);
    assert.equal(response.status,201);assert.equal(response.data.capital,98990);
    const receipt = {name:'factura.pdf',type:'application/pdf',base64:Buffer.from('%PDF-1.4\nexample').toString('base64')};
    response = await request('expenses','POST',{...expense,method:METHODS[1],receipt});
    assert.equal(response.data.capital,98990);assert.equal(response.data.expenses[0].amount,1010);
    const file = await fetch(`http://127.0.0.1:${server.address().port}${response.data.expenses[0].receipt.url}`);
    assert.equal(await file.text(),'%PDF-1.4\nexample');assert.match(file.headers.get('content-disposition'),/attachment/);
    for(const invalid of [{category:'Otros'},{amount:'-1'},{date:'2099-01-01'},{receipt:{...receipt,base64:'bad'}}]) {
      assert.equal((await request('expenses','POST',{...expense,...invalid})).status,400);
    }
    await Promise.all([request('expenses','POST',expense),request('expenses','POST',expense)]);
    assert.equal((await request('state')).data.expenses.length,4);
    await close();server = await createApp({dataDir});await listen();
    response = await request('state');assert.equal(response.data.capital,96970);assert.equal(response.data.expenses.length,4);
    assert.equal(response.data.categories.length,5);
  } finally {await close();await rm(dataDir,{recursive:true,force:true});}
});


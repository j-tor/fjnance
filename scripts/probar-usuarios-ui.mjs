import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir, mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {setTimeout as pausa} from 'node:timers/promises';

export async function probarUsuariosUI({url, proyecto}) {
  if (!/^fjnance-prueba-[a-f0-9]+$/.test(proyecto) || !/^http:\/\/127\.0\.0\.1:\d+$/.test(url)) throw new Error('La prueba de navegador solo admite el proyecto aislado.');
  const navegador = [process.env.NAVEGADOR_PRUEBAS, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(p => p && existsSync(p));
  if (!navegador) throw new Error('No hay Edge/Chromium instalado para verificar la UI. No se omiten pruebas.');
  const raiz = path.resolve('.arnes'); await mkdir(raiz, {recursive: true});
  const perfil = await mkdtemp(path.join(raiz, 'navegador-'));
  const proceso = spawn(navegador, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', '--user-data-dir=' + perfil, 'about:blank'], {stdio: 'ignore', windowsHide: true});
  let ws; let secuencia = 0; const pendientes = new Map();
  async function enviar(method, params = {}, sessionId) {
    const id = ++secuencia;
    return new Promise((resolve, reject) => {const temporizador = setTimeout(() => {pendientes.delete(id); reject(new Error('Tiempo agotado en navegador: ' + method));}, 15000); pendientes.set(id, {resolve, reject, temporizador}); ws.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));});
  }
  try {
    let puerto;
    for (let i = 0; i < 100; i++) {try {puerto = (await readFile(path.join(perfil, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break;} catch {await pausa(100);}}
    if (!puerto) throw new Error('No se pudo iniciar el navegador de pruebas.');
    const version = await (await fetch('http://127.0.0.1:' + puerto + '/json/version')).json();
    ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((r, j) => {ws.addEventListener('open', r, {once: true}); ws.addEventListener('error', j, {once: true});});
    ws.addEventListener('message', e => {const mensaje = JSON.parse(e.data); const p = pendientes.get(mensaje.id); if (p) {clearTimeout(p.temporizador); pendientes.delete(mensaje.id); mensaje.error ? p.reject(new Error(mensaje.error.message)) : p.resolve(mensaje.result);}});
    async function pagina() {
      const {browserContextId} = await enviar('Target.createBrowserContext');
      const {targetId} = await enviar('Target.createTarget', {url: 'about:blank', browserContextId});
      const {sessionId} = await enviar('Target.attachToTarget', {targetId, flatten: true});
      await enviar('Page.enable', {}, sessionId); await enviar('Runtime.enable', {}, sessionId);
      const evaluar = async expression => {const r = await enviar('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}, sessionId); if (r.exceptionDetails) throw new Error('Error ejecutando interacción UI.'); return r.result.value;};
      const esperar = async expresion => {for (let i = 0; i < 100; i++) {if (await evaluar(expresion)) return; await pausa(100);} throw new Error('La interfaz no alcanzó el estado esperado: ' + expresion);};
      const click = async texto => evaluar(`(() => {const e=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(texto)});if(!e)throw Error('Control ausente');e.click();})()`);
      const llenar = async (selector, valor) => evaluar(`(() => {const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Campo ausente');const tipo=e.tagName==='SELECT'?HTMLSelectElement:HTMLInputElement;Object.getOwnPropertyDescriptor(tipo.prototype,'value').set.call(e,${JSON.stringify(valor)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      const captura = async (nombre, movil = false) => {
        await enviar('Emulation.setDeviceMetricsOverride', {width: movil ? 390 : 1365, height: movil ? 844 : 900, deviceScaleFactor: 1, mobile: movil}, sessionId);
        await pausa(150); assert.ok(await evaluar('document.documentElement.scrollWidth <= innerWidth + 1'), 'Sin desbordamiento horizontal');
        const {data} = await enviar('Page.captureScreenshot', {format: 'png', captureBeyondViewport: true}, sessionId);
        await writeFile(path.join(raiz, 'F4-' + nombre + '.png'), Buffer.from(data, 'base64'));
      };
      await enviar('Page.navigate', {url}, sessionId); await esperar(`!!document.querySelector('form[aria-label="Acceder"]')`);
      return {sessionId, evaluar, esperar, click, llenar, captura};
    }
    const p = await pagina(); await p.captura('acceso-escritorio'); await p.captura('acceso-movil', true);
    const sufijo = randomUUID().slice(0, 8); const correoA = 'ui-a-' + sufijo + '@example.test'; const correoB = 'ui-b-' + sufijo + '@example.test'; const clave = 'Cuenta UI sintética 123!';
    async function registro(correo, nombre) {
      await p.click('Crea una cuenta'); await p.llenar('[name=nombre]', nombre); await p.llenar('[name=correo]', correo); await p.llenar('[name=clave]', clave); await p.click('Crear cuenta');
      await p.esperar(`!!document.querySelector('.sidebar') && !document.body.innerText.includes('Cargando tus finanzas')`);
    }
    await registro(correoA, 'Ana de prueba');
    assert.equal(await p.evaluar(`!!document.querySelector('a[href="#/usuarios"]')`), false);
    await p.click('Movimientos'); await p.click('Registrar gasto');
    await p.llenar('dialog [name=description]', 'Compra UI privada'); await p.llenar('dialog [name=amount]', '12.50'); await p.llenar('dialog [name=category]', 'Amigos');
    await p.evaluar(`document.querySelector('dialog .primary').click()`);
    await p.esperar(`!document.querySelector('dialog') && document.body.innerText.includes('Compra UI privada')`);
    await p.captura('movimientos-movil', true); await p.captura('movimientos-escritorio');
    await p.click('Salir'); await p.esperar(`!!document.querySelector('form[aria-label="Acceder"]')`);
    await p.llenar('[name=correo]', correoA); await p.llenar('[name=clave]', 'Incorrecta larga 123'); await p.click('Acceder'); await p.esperar(`!!document.querySelector('[role=alert]')`);
    await p.llenar('[name=clave]', clave); await p.click('Acceder'); await p.esperar(`!!document.querySelector('.sidebar') && document.body.innerText.includes('Compra UI privada')`);
    await p.click('Mi cuenta'); await p.esperar(`!!document.querySelector('form[aria-label="Cambiar contraseña"]')`);
    await p.llenar('[name=actual]', clave); await p.llenar('[name=nueva]', 'Nueva clave UI 123!'); await p.click('Actualizar contraseña');
    await p.esperar(`!!document.querySelector('form[aria-label="Acceder"]')`);
    await registro(correoB, 'Bruno de prueba'); await p.click('Movimientos'); await p.esperar(`!!document.querySelector('.management-panel')`);
    assert.equal(await p.evaluar(`document.body.innerText.includes('Compra UI privada')`), false);
    const administrador = await pagina();
    await administrador.llenar('[name=correo]', 'admin-ui@example.test'); await administrador.llenar('[name=clave]', 'Admin de prueba 123!'); await administrador.click('Acceder');
    await administrador.esperar(`!!document.querySelector('a[href="#/usuarios"]')`); await administrador.click('Usuarios');
    await administrador.esperar(`!!document.querySelector('.buscar-usuarios')`);
    await administrador.llenar('input[type=search]', correoB); await administrador.click('Buscar'); await administrador.esperar(`!!document.querySelector('tbody tr') && document.querySelector('tbody').innerText.includes(${JSON.stringify(correoB)}) && document.querySelectorAll('tbody tr').length===1`);
    await administrador.click('Bloquear'); await administrador.esperar(`document.querySelector('tbody').innerText.includes('Bloqueado')`);
    assert.equal(await p.evaluar(`fetch('/api/state').then(r=>r.status)`), 401);
    await enviar('Page.reload', {}, p.sessionId); await p.esperar(`!!document.querySelector('form[aria-label="Acceder"]')`);
    await administrador.click('Reactivar'); await administrador.esperar(`document.querySelector('tbody').innerText.includes('Activo')`);
    await administrador.captura('admin-escritorio'); await administrador.captura('admin-movil', true);
    console.log('APROBADO UI: registro, acceso/error, movimientos privados, cambio de contraseña, salida, permisos y bloqueo/reactivación admin; escritorio/móvil sin desbordamiento.');
  } finally {
    if (ws?.readyState === WebSocket.OPEN) {try {await enviar('Browser.close');} catch {} ws.close();}
    for (const p of pendientes.values()) {clearTimeout(p.temporizador); p.reject(new Error('Navegador cerrado.'));} pendientes.clear();
    await pausa(500);
    if (proceso.exitCode === null && proceso.pid) {
      if (process.platform === 'win32') {const {spawnSync} = await import('node:child_process'); spawnSync('taskkill', ['/PID', String(proceso.pid), '/T', '/F'], {windowsHide: true, stdio: 'ignore'});} else proceso.kill();
    }
    const destino = path.resolve(perfil);
    if (destino.startsWith(raiz + path.sep) && path.basename(destino).startsWith('navegador-')) {try {await rm(destino, {recursive: true, force: true, maxRetries: 3, retryDelay: 300});} catch {console.log('Perfil temporal de navegador conservado en .arnes por bloqueo del sistema.');}}
  }
}

// Optional Windows/Chrome browser check. Receives a temporary test token on stdin.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const { token } = JSON.parse(input);
const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile = resolve(tmpdir(), `fora-ui-${Date.now()}`);
const browser = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9338', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(r => setTimeout(r, ms));
let socket;
try {
  let targets;
  for (let i = 0; i < 40; i++) {
    try { targets = await (await fetch('http://127.0.0.1:9338/json')).json(); if (targets.some(t => t.type === 'page')) break; } catch {}
    await delay(250);
  }
  const target = targets?.find(t => t.type === 'page');
  if (!target) throw new Error('Chrome debugging endpoint unavailable');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok, fail) => { socket.addEventListener('open', ok, { once: true }); socket.addEventListener('error', fail, { once: true }); });
  let next = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) { const entry = pending.get(data.id); pending.delete(data.id); clearTimeout(entry.timer); data.error ? entry.fail(new Error(data.error.message)) : entry.ok(data.result); }
  });
  const call = (method, params = {}) => new Promise((ok, fail) => {
    const id = ++next;
    const timer = setTimeout(() => { pending.delete(id); fail(new Error(`Timeout: ${method}`)); }, 10000);
    pending.set(id, { ok, fail, timer }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  await call('Page.enable');
  await call('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('token', ${JSON.stringify(token)})` });
  await call('Emulation.setDeviceMetricsOverride', { width: 1366, height: 1000, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: 'http://127.0.0.1:5173/feed' });
  let ready = false;
  for (let i = 0; i < 50; i++) {
    ready = await evaluate(`!!document.querySelector('.post-card') && !document.querySelector('.social-main [aria-busy="true"]')`);
    if (ready) break;
    await delay(200);
  }
  if (!ready) throw new Error('Feed did not load a test post');
  const errors = await evaluate(`Array.from(document.querySelectorAll('.social-error')).map(e=>e.textContent)`);
  if (errors.length) throw new Error(errors.join('; '));
  const output = resolve(' .qa'.trim());
  await mkdir(output, { recursive: true });
  for (const [name, width, height, mobile] of [['desktop',1366,1000,false], ['mobile',390,844,true]]) {
    await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    await delay(600);
    const overflow = await evaluate('document.documentElement.scrollWidth > innerWidth');
    if (overflow) throw new Error(`Horizontal overflow at ${width}px`);
    const image = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(resolve(output, `${name}.png`), Buffer.from(image.data, 'base64'));
    console.log(`PASS: ${name} feed rendered without horizontal overflow`);
  }
} finally {
  socket?.close();
  browser.kill();
}

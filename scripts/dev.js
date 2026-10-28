import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const children = ['backend', 'frontend'].map(name => spawn(process.execPath, [name === 'backend' ? 'src/server.js' : 'node_modules/vite/bin/vite.js', ...(name === 'frontend' ? ['--host', '127.0.0.1'] : [])], {cwd: fileURLToPath(new URL(`../${name}/`, import.meta.url)), stdio: 'inherit'}));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => children.forEach(child => child.kill()));
children.forEach(child => child.on('exit', code => {children.forEach(other => other.kill()); process.exitCode = code || 0;}));

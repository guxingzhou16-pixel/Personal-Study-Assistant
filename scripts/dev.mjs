import { spawn } from 'node:child_process';
import electronPath from 'electron';

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], {
  stdio: 'inherit',
  windowsHide: true,
});
let desktop;
function close() {
  desktop?.kill();
  server.kill();
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
server.on('error', (error) => {
  console.error(error.message);
  close();
  process.exitCode = 1;
});

try {
  const deadline = Date.now() + 20_000;
  while (true) {
    if (server.exitCode !== null) throw new Error('界面开发服务启动失败。');
    try {
      const response = await fetch('http://127.0.0.1:1420', { signal: AbortSignal.timeout(1_000) });
      if (response.ok) break;
    } catch {
      /* The server is still starting; bounded by the deadline below. */
    }
    if (Date.now() > deadline) throw new Error('界面服务启动超时。请检查端口 1420。');
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const { ELECTRON_RUN_AS_NODE: _ignored, ...taskEnv } = process.env;
  desktop = spawn(electronPath, ['.'], {
    stdio: 'inherit',
    windowsHide: true,
    env: { ...taskEnv, STUDY_COMPANION_DEV_URL: 'http://127.0.0.1:1420' },
  });
  desktop.on('error', (error) => {
    console.error(error.message);
    close();
    process.exitCode = 1;
  });
  desktop.on('exit', (code) => {
    server.kill();
    process.exitCode = code ?? 0;
  });
} catch (error) {
  console.error(error.message);
  close();
  process.exitCode = 1;
}

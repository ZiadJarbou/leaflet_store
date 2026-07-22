// server/kill-ports.cjs
// Kills any process occupying ports 3000 or 4000 before `npm run dev`.
// Works on Windows (taskkill) and Unix (kill).
const { execSync } = require('child_process');
const net = require('net');

const PORTS = [3000, 4000];

function getPidOnPort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(
        `netstat -ano | findstr ":${port} " | findstr "LISTENING"`,
        { encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }
      );
      const match = out.trim().split('\n')[0]?.match(/(\d+)\s*$/);
      return match ? parseInt(match[1], 10) : null;
    } else {
      const out = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8', stdio: ['pipe','pipe','pipe'] });
      return parseInt(out.trim(), 10) || null;
    }
  } catch {
    return null;
  }
}

function killPid(pid) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'pipe' });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
    }
    return true;
  } catch {
    return false;
  }
}

for (const port of PORTS) {
  const pid = getPidOnPort(port);
  if (pid && pid !== process.pid) {
    const ok = killPid(pid);
    if (ok) console.log(`[kill-ports] Freed port ${port} (killed PID ${pid})`);
  }
}

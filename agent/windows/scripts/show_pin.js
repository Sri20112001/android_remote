const { toQR } = require('../../../app/node_modules/toqr');
const fs = require('fs');
const path = require('path');
const http = require('http');

function makeSvg(data) {
  const qr = toQR(data);
  const size = Math.round(Math.sqrt(qr.length));
  const border = 4;
  const total = size + border * 2;
  const scale = 8;
  const dim = total * scale;

  let rects = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (qr[y * size + x]) {
        rects.push(`<rect x="${(x + border) * scale}" y="${(y + border) * scale}" width="${scale}" height="${scale}" fill="#000000"/>`);
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  ${rects.join('\n  ')}
</svg>`;
}

async function startPairing() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 8765,
      path: '/api/v1/pairing/start',
      method: 'POST'
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  try {
    const session = await startPairing();
    const pin = session.pin;
    const sessionId = session.session_id;

    const payload = JSON.stringify({
      agent_name: 'TUF Remote',
      version: '0.1.0',
      hostname: 'LAPTOP-DPEFC07F',
      ip_addresses: ['192.168.0.104'],
      port: 8765,
      tls_enabled: false,
      session_id: sessionId,
      pin: pin
    });

    const outDir = path.resolve(__dirname, '..');
    fs.writeFileSync(path.join(outDir, 'qr_code.svg'), makeSvg(payload));

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>TUF Remote - Pair Device</title>
  <style>
    body {
      background-color: #0b0f19;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      box-sizing: border-box;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      padding: 36px 32px;
      border-radius: 20px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
      text-align: center;
      max-width: 440px;
      width: 100%;
    }
    .badge {
      display: inline-block;
      background: #10b981;
      color: #064e3b;
      font-weight: 700;
      font-size: 11px;
      letter-spacing: 0.5px;
      padding: 4px 10px;
      border-radius: 9999px;
      text-transform: uppercase;
    }
    h2 {
      margin: 14px 0 6px 0;
      font-size: 24px;
      font-weight: 700;
    }
    .subtitle {
      color: #9ca3af;
      font-size: 14px;
      margin: 0 0 16px 0;
    }
    .pin-container {
      background: #1e293b;
      border: 2px dashed #f59e0b;
      border-radius: 12px;
      padding: 16px;
      margin: 16px 0;
    }
    .pin-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #f59e0b;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .pin-code {
      font-family: ui-monospace, monospace;
      font-size: 40px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #ffffff;
    }
    .qr-box {
      background: #ffffff;
      padding: 16px;
      border-radius: 16px;
      display: inline-block;
      margin: 12px 0 16px 0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .qr-box img {
      display: block;
      width: 250px;
      height: 250px;
    }
    .expires {
      font-size: 12px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Pairing Active</span>
    <h2>TUF Remote Agent</h2>
    <p class="subtitle">Enter the PIN on your phone, or scan the QR code:</p>
    
    <div class="pin-container">
      <div class="pin-label">6-Digit Pairing PIN</div>
      <div class="pin-code">${pin}</div>
    </div>

    <div class="qr-box">
      <img src="qr_code.svg" alt="TUF Remote Pairing QR Code" />
    </div>

    <div class="expires">PIN valid for 5 minutes &bull; Address: http://192.168.0.104:8765</div>
  </div>
</body>
</html>`;

    fs.writeFileSync(path.join(outDir, 'qr.html'), html);
    console.log(JSON.stringify({ pin, sessionId, expiresAt: session.expires_at }));
  } catch (e) {
    console.error('Failed to create pairing session:', e.message);
  }
}

run();

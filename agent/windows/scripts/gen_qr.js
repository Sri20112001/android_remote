const { toQR } = require('../../../app/node_modules/toqr');
const fs = require('fs');
const path = require('path');

function makeSvg(data) {
  const qr = toQR(data);
  const size = Math.round(Math.sqrt(qr.length));
  const border = 4;
  const total = size + border * 2;
  const scale = 10;
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

function makeAscii(data) {
  const qr = toQR(data);
  const size = Math.round(Math.sqrt(qr.length));
  const border = 2;
  const total = size + border * 2;

  const grid = Array.from({ length: total }, () => Array(total).fill(0));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      grid[y + border][x + border] = qr[y * size + x];
    }
  }

  // Double-width blocks or inverted blocks for scanning
  // Standard terminal QR scanner uses white background:
  // Black module = space, White margin = █ if terminal has black bg, or vice-versa
  // Let's print inverted blocks for dark-mode terminals:
  let out = [];
  for (let y = 0; y < total; y += 2) {
    let line = '';
    for (let x = 0; x < total; x++) {
      const top = grid[y][x];
      const bot = y + 1 < total ? grid[y + 1][x] : 0;
      // In terminal with dark background:
      // 0 (white background in QR) should be white block
      // 1 (black pixel in QR) should be black (space)
      if (!top && !bot) line += '█';
      else if (!top && bot) line += '▀';
      else if (top && !bot) line += '▄';
      else line += ' ';
    }
    out.push(line);
  }
  return out.join('\n');
}

const url = 'http://192.168.0.104:8765';
const payload = JSON.stringify({
  agent_name: 'TUF Remote',
  version: '0.1.0',
  hostname: 'LAPTOP-DPEFC07F',
  ip_addresses: ['192.168.0.104'],
  port: 8765,
  tls_enabled: false
});

const outDir = path.resolve(__dirname, '..');
fs.writeFileSync(path.join(outDir, 'qr_code.svg'), makeSvg(url));
fs.writeFileSync(path.join(outDir, 'qr_payload.svg'), makeSvg(payload));

console.log('--- QR CODE FOR URL: ' + url + ' ---');
console.log(makeAscii(url));

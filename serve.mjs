import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

// Load .env file if present
function loadEnv() {
  try {
    const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    env.split('\n').forEach(line => {
      const [key, ...rest] = line.split('=');
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    });
  } catch (_) {}
}
loadEnv();

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// ── Mock API (remove when Group 3 backend is ready) ──────
let mockRecords = [];
let mockNextId = 1;

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
  });
}

function handleApi(req, res, urlPath) {
  const recordsBase = urlPath === '/api/records';
  const recordById  = urlPath.match(/^\/api\/records\/(.+)$/);

  if (recordsBase && req.method === 'GET') {
    return json(res, 200, mockRecords);
  }

  if (recordsBase && req.method === 'POST') {
    return readBody(req).then(body => {
      const record = { ...body, id: String(mockNextId++) };
      mockRecords.push(record);
      console.log('[mock API] POST /api/records →', record.name);
      json(res, 201, record);
    });
  }

  if (recordById && req.method === 'DELETE') {
    const id = recordById[1];
    const before = mockRecords.length;
    mockRecords = mockRecords.filter(r => r.id !== id);
    console.log('[mock API] DELETE /api/records/' + id, before !== mockRecords.length ? '✓' : '(not found)');
    return json(res, 204, {});
  }

  json(res, 404, { error: 'Not found' });
}
// ── End mock API ─────────────────────────────────────────

// Proxy non-mocked /api/* requests to FastAPI backend on :8000
function proxyToBackend(req, res) {
  const proxyOptions = {
    hostname: 'localhost',
    port: 8000,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: 'localhost:8000' },
  };

  const proxyReq = http.request(proxyOptions, proxyRes => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', err => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Backend proxy error: ' + err.message + ' (is FastAPI running on :8000?)' }));
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0];

  // Mock /api/records (kept for dev until backend records integration)
  if (urlPath.startsWith('/api/records')) {
    return handleApi(req, res, urlPath);
  }

  // All other /api/* → FastAPI backend
  if (urlPath.startsWith('/api/')) {
    return proxyToBackend(req, res);
  }

  if (urlPath === '/') urlPath = '/index.html';

  // Serve index.html for directory paths
  if (!path.extname(urlPath)) {
    urlPath = urlPath.replace(/\/?$/, '/index.html');
  }

  const filePath = path.join(__dirname, urlPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

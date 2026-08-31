import { createServer } from "http";
import { Server } from "socket.io";
import { io as Client } from "socket.io-client";
import { fileTypeFromBuffer } from 'file-type';
import isSvg from 'is-svg';
import { mkdir, writeFile, readdir, stat, rm } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { join, normalize, resolve } from 'node:path';
import mime from 'mime-types';

const PORT = parseInt(process.env.PORT || '8080', 10);
const SHELL_URL = process.env.SHELL_URL || 'http://127.0.0.1:8010';
const GENERATED_DIR = process.env.GENERATED_DIR || '/tmp/python-generated';
const GENERATED_URL = process.env.GENERATED_URL || '/python3-generated';

/**
 * Cleanup old generated files to prevent disk space exhaustion.
 */
async function cleanupOldFiles() {
  const maxAgeHours = parseInt(process.env.CLEANUP_MAX_AGE_HOURS || '24', 10);
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  const now = Date.now();

  console.log(`[Cleanup] Starting cleanup of files older than ${maxAgeHours} hours in ${GENERATED_DIR}`);

  let deletedCount = 0;
  let errorCount = 0;

  try {
    const entries = await readdir(GENERATED_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dirPath = join(GENERATED_DIR, entry.name);
        try {
          const dirStat = await stat(dirPath);
          const age = now - dirStat.mtimeMs;

          if (age > maxAgeMs) {
            await rm(dirPath, { recursive: true, force: true });
            deletedCount++;
          }
        } catch (err) {
          console.error(`[Cleanup] Error processing ${dirPath}:`, err.message);
          errorCount++;
        }
      }
    }

    console.log(`[Cleanup] Complete. Deleted ${deletedCount} directories, ${errorCount} errors.`);
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`[Cleanup] Directory ${GENERATED_DIR} does not exist yet, skipping.`);
    } else {
      console.error('[Cleanup] Error during cleanup:', err.message);
    }
  }
}

function startCleanupScheduler() {
  cleanupOldFiles();
  const intervalMs = 60 * 60 * 1000; // hourly
  setInterval(cleanupOldFiles, intervalMs);
}

startCleanupScheduler();

let connections = 0;

/**
 * HTTP request handler: handles /health, /stats.json, and static file serving for generated charts
 */
function handleHttpRequest(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (pathname === '/health' || pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (pathname === '/stats.json' || pathname === '/python3/stats.json') {
    const response = {
      active: connections,
      available: 1,
      mode: 'local'
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    return;
  }

  // Handle static generated files: /python3-generated/* or /python-generated/*
  const matchGenerated = pathname.match(/^\/(?:python3-generated|python-generated)\/(.+)$/);
  if (matchGenerated && (req.method === 'GET' || req.method === 'HEAD')) {
    const relativePath = matchGenerated[1];
    const safePath = normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
    const filePath = resolve(GENERATED_DIR, safePath);

    // Prevent path traversal outside GENERATED_DIR
    if (!filePath.startsWith(resolve(GENERATED_DIR))) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const contentType = mime.lookup(filePath) || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600, immutable'
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    createReadStream(filePath).pipe(res);
    return;
  }


  // Fallback for root or unknown
  if (pathname === '/' || pathname === '/python3' || pathname === '/python3/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Trinket Python 3 Runner Online');
    return;
  }

  // If this is a socket.io request, let the Socket.IO engine handle it
  if (pathname.startsWith('/socket.io') || pathname.startsWith('/python3/socket.io') || req.url.startsWith('/socket.io') || req.url.startsWith('/python3/socket.io')) {
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
}


const httpServer = createServer((req, res) => {
  // If request is for Socket.IO path, ignore here as Socket.IO handles it
  if (req.url && (req.url.startsWith('/python3/socket.io') || req.url.startsWith('/socket.io'))) {
    return;
  }
  handleHttpRequest(req, res);
});

// Configure Socket.IO server on /python3/socket.io
const io = new Server(httpServer, {
  path: "/python3/socket.io",
  cors: {
    origin: "*"
  }
});






const setupSocketHandlers = (socket) => {
  let shellSocket;
  connections = connections + 1;

  const getShellSocket = async () => {
    if (shellSocket) {
      return shellSocket;
    }

    try {
      const shellClient = Client(SHELL_URL, {
        forceNew: true,
        reconnectionAttempts: 0,
        timeout: 2000
      });

      return new Promise((resolve, reject) => {
        shellClient.on("connect", () => {
          resolve(shellClient);
        });
        shellClient.on("connect_error", (error) => {
          reject(error);
        });
      });
    } catch (error) {
      console.log('Shell connect error:', error);
      throw error;
    }
  };

  const getSocket = async () => {
    if (shellSocket) {
      return shellSocket;
    }

    shellSocket = await getShellSocket();

    shellSocket.on('child ready', () => {
      socket.emit('child ready');
    });

    shellSocket.on('stdout', (data) => {
      socket.emit('stdout', data);
    });

    shellSocket.on('clear', () => {
      socket.emit('clear');
    });

    shellSocket.on('script error', (data) => {
      socket.emit('script error', { error: data.error });
    });

    shellSocket.on('compile error', (data) => {
      socket.emit('compile error', { error: data.error });
    });

    // When Python code generates a file (e.g. Pygal SVG, PNG, HTML)
    shellSocket.on('file added', async (data) => {
      try {
        data.type = await fileTypeFromBuffer(data.buffer);

        if ((data.type && /^image/.test(data.type.mime)) || isSvg(data.buffer)) {
          const imagedir = Math.random().toString(36).slice(-8);
          const imagepath = `${GENERATED_DIR}/${imagedir}`;
          const filepath = `${imagepath}/${data.name}`;

          try {
            await mkdir(imagepath, { recursive: true });
            await writeFile(filepath, data.buffer);
          } catch(addErr) {
            console.error('Error saving generated image:', addErr);
          }

          data.url = `${GENERATED_URL}/${imagedir}/${data.name}`;
          data.image = true;
        }
        else if (data.type || (data.type && data.type.mime && /sqlite/.test(data.type.mime))) {
          data.binary = true;
        }
        else if (/\.html$/.test(data.name)) {
          const htmldir = Math.random().toString(36).slice(-8);
          const htmlpath = `${GENERATED_DIR}/${htmldir}`;
          const filepath = `${htmlpath}/${data.name}`;

          try {
            await mkdir(htmlpath, { recursive: true });
            await writeFile(filepath, data.buffer);
          } catch(addErr) {
            console.error('Error saving generated html:', addErr);
          }

          data.url = `${GENERATED_URL}/${htmldir}/${data.name}`;
          data.html = true;
        }
        else {
          data.content = data.buffer.toString('utf8');
        }
      } catch(e) {
        data.typeError = e;
      }

      delete data.buffer;
      socket.emit('file added', data);
    });

    shellSocket.on('done', (result) => {
      socket.emit('done', result);
    });

    shellSocket.on('exit', () => {
      socket.emit('exit');
    });

    shellSocket.on('disconnect', () => {
      socket.emit('exit');
      socket.disconnect();
    });

    return shellSocket;
  };

  socket.on('run', async (data) => {
    try {
      const client = await getSocket();
      client.emit('eval', {
        init: true,
        code: data.code
      });
    } catch (error) {
      socket.emit('shell connect error');
      socket.emit('exit');
      socket.disconnect();
    }
  });

  socket.on('console', async (data) => {
    try {
      const client = await getSocket();
      if (data.init) {
        client.emit('eval', {
          interactive: true,
          init: true,
          files: data.files
        });
      }
      client.emit('write', {
        input: data.input,
        from: 'console'
      });
    } catch (error) {
      socket.emit('shell connect error');
      socket.emit('exit');
      socket.disconnect();
    }
  });

  socket.on('write', async (data) => {
    try {
      const client = await getSocket();
      client.emit('write', {
        input: data.input
      });
    } catch (error) {
      socket.emit('shell connect error');
      socket.emit('exit');
      socket.disconnect();
    }
  });

  socket.on('connections', () => {
    socket.emit('current connections', connections - 1);
  });

  socket.on('disconnect', () => {
    if (shellSocket) {
      shellSocket.disconnect();
    }
    connections = connections - 1;
  });
};

io.on('connection', setupSocketHandlers);

httpServer.listen(PORT, '0.0.0.0', () => {

  console.log(`Trinket Python Runner listening on port ${PORT}`);
});

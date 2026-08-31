import * as child_process from 'child_process';
const {
  createHash
} = await import('node:crypto');
import {
  mkdir,
  unlink,
  writeFile
} from 'node:fs/promises';
import {
  chownSync,
  constants,
  readFileSync,
  rmSync
} from 'node:fs';
import * as chokidar from 'chokidar';
import * as path from 'node:path';

import { createServer } from 'http';
import { Server } from 'socket.io';
import fs from 'fs';

import _ from 'underscore';

import https from 'https';

const httpServer = createServer();
const io = new Server(httpServer, {
  // options
});

const python = '/usr/local/bin/python3';
const uid = 1000;
const gid = 1000;

let connections = 0;
const childTimers = {};

io.on('connection', (socket) => {
  let watcher;
  const watchesInProgress = {}
  const watchInProgressLimit = 2000
  const watchInProgressInterval = 250
  const watcherStabilityThreshold = 500
  let watchInProgressCurrent = 0;

  let child;
  let childReady = false;
  let childEnded = false;
  let childEndedLog = undefined;
  let childStartedAt = undefined;

  const childReadyLimit = 5000;
  const childReadyInterval = 250;
  let childReadyCurrent = 0;

  let dir;

  connections = connections + 1;

  let stdoutEmits = 0;
  const stdoutEmitsThreshold = 100;
  const checkEmitsInterval = setInterval(() => {
    if (stdoutEmits > stdoutEmitsThreshold) {
      console.log("too many emits", stdoutEmits, "- disconnect");
      socket.disconnect();
    } else {
      stdoutEmits = 0;
    }
  }, 250);

  // setup child process and event listeners
  socket.on('eval', async (data) => {
    const args = [];
    let error = [];
    const options = {};
    const ignoreFiles = [];
    const assetPromises = [];

    let firstPrompt = true;

    if (data.init) {
      const sha = createHash('sha256');
      sha.update(Math.random().toString());
      const sessionId = sha.digest('hex').substr(0, 16);

      dir = `/tmp/sessions/${sessionId}`;
      await mkdir(dir, { recursive: true });
      chownSync(dir, uid, gid);

      let files;

      if (data.code) {
        try {
          files = JSON.parse(data.code);
          if (!Array.isArray(files)) {
            throw new Error();
          }
        } catch(e) {
          files = [{
            name: 'main.py',
            content: data.code
          }];
        }

        for (const file of files) {
          if (file.name === 'assets') {
            if (Array.isArray(file.content)) {
              for (let i = 0; i < file.content.length; i++) {
                // download asset and write to local file
                await downloadAsset(dir, file.content[i]);
                chownSync(`${dir}/${file.content[i].name}`, uid, gid);
                ignoreFiles.push(`${dir}/${file.content[i].name}`);
              }
            }
          }
          else if (file.name.length) {
            await writeFile(`${dir}/${file.name}`, file.content);
            chownSync(`${dir}/${file.name}`, uid, gid);
          }
        }

        ignoreFiles.push(`${dir}/${files[0].name}`);
      }
      else if (data.files) {
        try {
          files = JSON.parse(data.files);
          if (!_.isObject(files)) {
            files = {};
          }
        } catch(e) {
          files = {};
        }

        const filenames = _.keys(files);
        for (const name of filenames) {
          await writeFile(`${dir}/${name}`, files[name]);
          chownSync(`${dir}/${name}`, uid, gid);
        }

        if (filenames.length) {
          ignoreFiles.push(`${dir}/${filenames[0].name}`);
        }
      }
    }

    // add files from above to ignored
    const ignored = ignoreFiles.concat(/[\/\\]\./);

    watcher = chokidar.watch(dir, {
      ignored: ignored,
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish : {
        stabilityThreshold: watcherStabilityThreshold
      }
    });

    watcher.on('add', (added) => {
      var fileinfo = {
        name: path.basename(added),
        buffer: readFileSync(added)
      };
      socket.emit('file added', fileinfo);
      if (watchesInProgress[ fileinfo.name ]) {
        delete watchesInProgress[ fileinfo.name ];
      }
    });
    watcher.on('change', (changed) => {
      var fileinfo = {
        name: path.basename(changed),
        buffer: readFileSync(changed)
      };
      socket.emit('file added', fileinfo);
      if (watchesInProgress[ fileinfo.name ]) {
        delete watchesInProgress[ fileinfo.name ];
      }
    });
    watcher.on('raw', (event, filepath, details) => {
      var watching = filepath || path.basename(details.watchedPath);
      if (watching) {
        watchesInProgress[watching] = true;
        watchInProgressCurrent = 0;
      }
    });

    watcher.on('error', (error) => {
      console.log('watcher error:', error);
    });

    // arguments to python
    if (data.interactive) {
      args.push('-i');
      args.push('-q');
    }

    args.push('-u');
    args.push('-B');

    if (!data.interactive) {
      args.push(`${dir}/main.py`);
    }

    options.cwd = dir;
    options.uid = uid;
    options.gid = gid;

    watcher.on('ready', () => {
      child = child_process.spawn(python, args, options);

      childStartedAt = +new Date();
      childTimers[child.pid] = setTimeout(() => {
        const thisNow = +new Date();
        console.log(`disconnecting socket, pid ${child.pid} still running after ${(thisNow - childStartedAt) / 1000}`);
        socket.disconnect();
      }, 60000);

      // strings rather than buffers
      child.stdout.setEncoding('utf-8');
      child.stdin.setEncoding('utf-8');
      child.stderr.setEncoding('utf-8');

      // any time the child process writes to stdout
      child.stdout.on('data', (data) => {
        // clear console escape sequence
        if (/\x1b\[H\x1b\[2J/.test(data)) {
          socket.emit('clear');
        }
        else {
          socket.emit('stdout', data);
          stdoutEmits++;
        }
      });

      // any time the child process writes to stderr
      child.stderr.on('data', (err) => {
        error.push(err);

        if (data.interactive) {
          if (/^(\.\.\. )*>>> /m.test(err)) {
            if (!firstPrompt) {
              const _error = _parseError(error);
              const _done = {
                type: _error.type,
                error: _error.message
              };
              socket.emit('done', _done);
              error = [];
            }
            firstPrompt = false;
          }
        }
      });

      // catch stdout, stdin, stderr errors
      const pipeErrorHandler = (err) => {
        console.log("pipe error:", err);
        socket.emit('script error', {
          error : "Error: The python3 process ended unexpectedly. Please try running your program again."
        }, () => {
          socket.disconnect();
        });
      }

      child.stdout.on('error', pipeErrorHandler);
      child.stdin.on('error', pipeErrorHandler);
      child.stderr.on('error', pipeErrorHandler);

      // process ended
      child.on('exit', (code, signal) => {
        try { 
          if (childTimers[child.pid]) {
            clearTimeout(childTimers[child.pid]);
            delete childTimers[child.pid];
          } 
        } catch(e) {
          console.log("error clearing timeout:", e);
        }

        childEnded = true;

        if (error.length) {
          const _error = _parseError(error);
          const _script = {
            type: _error.type,
            error: _error.message
          };
          socket.emit('script error', _script);
          childEndedLog = error.join('');
        }
        else {
          childEndedLog = `Code: ${code}, Signal: ${signal}`;
        }

        (function exitFunc() {
          if (!_.isEmpty(watchesInProgress) && watchInProgressCurrent <= watchInProgressLimit) {
            setTimeout( exitFunc, watchInProgressInterval );
            watchInProgressCurrent += watchInProgressInterval;
          }
          else {
            socket.emit('exit');
            if (watcher) {
              watcher.close();
            }
            if (dir) {
              try {
                rmSync(dir, { recursive: true, force: true });
              } catch(e) {
                console.log('child exit, rmSync error:', e);
              }
            }
          }
        })();
      });

      child.on('error', (err) => {
        console.log('child error:', err);
      });

      childReady = true;
      socket.emit('child ready');
    });
  });

  // received input from browser
  socket.on('write', (data) => {
    let inputLines = data.input.split('\n');
    let lastLine = inputLines.pop();

    lastLine = lastLine.replace(/^\s+/g, '');

    if (lastLine.length && !/\n$/.test(lastLine)) {
      lastLine += '\n';
    }

    inputLines.push(lastLine);
    let input = inputLines.join('\n');

    if (inputLines.length > 1 && /^[\s\#]+/.test(inputLines[inputLines.length - 2]) && data.from === 'console') {
      input += '\n';
    }

    (function stdinWrite(input) {
      if (childReady && !childEnded) {
        child.stdin.write(input);
      }
      else if (childReadyCurrent <= childReadyLimit) {
        setTimeout(() => {
          stdinWrite(input);
        }, childReadyInterval);
        childReadyCurrent += childReadyInterval;
      }
      else {
        if (childEnded) {
          console.log('child process ended:', childEndedLog);
        }
        else {
          console.log('child process never ready!');
        }

        socket.emit('script error', {
          error : "Error: The python3 process ended unexpectedly. Please try running your program again."
        }, () => {
          socket.disconnect();
        });
      }
    })(input);
  });

  socket.on('disconnect', () => {
    connections = connections - 1;
    clearInterval(checkEmitsInterval);

    if (watcher) {
      watcher.close();
    }

    if (dir) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch(e) {
        console.log('disconnect, rmSync error:', e);
      }
    }

    if (child) {
      child.kill('SIGKILL');
    }
  });
});

const _parseError = (errors) => {
  let errorStr = errors.join('');

  if (/KeyboardInterrupt/.test(errorStr)) {
    return {
      type: 'KeyboardInterrupt',
      message: 'KeyboardInterrupt'
    };
  }

  const matches = errorStr.match(/^([A-Za-z0-9_]+): (.*)$/m);
  let lang = 'python3';

  if (matches && matches[1]) {
    lang = matches[1];
  }

  errorStr = errorStr.replace(/File ".*?main.py", /g, 'File "main.py", ');

  return {
    type: lang,
    message: errorStr
  };
}

const downloadAsset = (dir, asset) => {
  let file = fs.createWriteStream(`${dir}/${asset.name}`);

  return new Promise((resolve, reject) => {
    const request = https.get(asset.url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
      }
      else {
        reject();
      }
    });

    file.on('finish', () => {
      resolve();
    });

    file.on('error', (err) => {
      reject(err);
    });

    request.on('error', (err) => {
      reject(err);
    });
  });
}

const port = process.env.SHELL_PORT || 8010;
httpServer.listen(port, '127.0.0.1', () => {
  console.log(`Python 3 shell listening on 127.0.0.1:${port}`);
});

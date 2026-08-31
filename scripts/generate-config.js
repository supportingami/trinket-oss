const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const examplePath = path.join(process.cwd(), 'config', 'local.example.yaml');
const outputPath = path.join(process.cwd(), 'config', 'local.yaml');

if (!fs.existsSync(examplePath)) {
  console.error('Error: config/local.example.yaml does not exist');
  process.exit(1);
}

// Read lines from template
const lines = fs.readFileSync(examplePath, 'utf8').split('\n');

// Detect sections
let inAppUrl = false;
let inCookieOptions = false;
let inMongo = false;
let inRedis = false;
let inMail = false;
let inEmbedSkulpt = false;
let inCdn = false;

// Determine configuration values from env or default
// Generating a secure random 32-character password if not provided to allow zero-config run
let sessionPassword = process.env.SESSION_COOKIE_PASSWORD;
if (!sessionPassword) {
  sessionPassword = crypto.randomBytes(16).toString('hex');
  console.log('SESSION_COOKIE_PASSWORD not provided; generated a random 32-character secret.');
} else if (sessionPassword.length < 32) {
  console.warn('Warning: SESSION_COOKIE_PASSWORD is shorter than 32 characters!');
}

const appUrlProtocol = process.env.APP_URL_PROTOCOL || 'http';
const appUrlHostname = process.env.APP_URL_HOSTNAME || 'localhost';
let appUrlPort = process.env.APP_URL_PORT !== undefined ? process.env.APP_URL_PORT : '3000';
if (appUrlPort === 'none' || appUrlPort === 'null' || appUrlPort === 'undefined') {
  appUrlPort = '';
}
const appSessionIsSecure = process.env.APP_SESSION_IS_SECURE || 'false';

const mongoHost = process.env.MONGO_HOST || 'mongodb';
const mongoPort = process.env.MONGO_PORT || '27017';
const mongoDatabase = process.env.MONGO_DATABASE || 'trinket';
const mongoUser = process.env.MONGO_USER;
const mongoPass = process.env.MONGO_PASS;

// Default redis to enabled (true) if not explicitly disabled, matching docker-compose.prod.yml
const redisEnabled = process.env.REDIS_ENABLED !== 'false';
const redisHost = process.env.REDIS_HOST || 'redis';
const redisPort = process.env.REDIS_PORT || '6379';
const redisPass = process.env.REDIS_PASS;
const redisDatabase = process.env.REDIS_DB || '0';

const hasMailConfig = !!(process.env.RESEND_API_KEY || process.env.MAIL_HOST || process.env.MAIL_PASS);
const isResend = !!process.env.RESEND_API_KEY;

const mailFrom = process.env.MAIL_FROM || '';
const mailHost = process.env.MAIL_HOST || (isResend ? 'smtp.resend.com' : '');
const mailPort = process.env.MAIL_PORT || '587';
const mailUser = process.env.MAIL_USER || (isResend ? 'resend' : '');
const mailPass = process.env.RESEND_API_KEY || process.env.MAIL_PASS || '';

const awsCdnHost = process.env.AWS_CDN_HOST !== undefined ? process.env.AWS_CDN_HOST : '';
const appEmbedSkulptLocal = process.env.APP_EMBED_SKULPT_LOCAL !== undefined
  ? (process.env.APP_EMBED_SKULPT_LOCAL === 'true')
  : (awsCdnHost === '');
const appEmbedSkulptMin = process.env.APP_EMBED_SKULPT_MIN !== 'false';

const enablePython = process.env.ENABLE_PYTHON !== 'false';
const enableHtml = process.env.ENABLE_HTML !== 'false';
const enableBlocks = process.env.ENABLE_BLOCKS !== 'false';
const enableGlowscript = process.env.ENABLE_GLOWSCRIPT !== 'false';
const enableGlowscriptBlocks = process.env.ENABLE_GLOWSCRIPT_BLOCKS !== 'false';
const enableConsole = process.env.ENABLE_CONSOLE !== 'false';
const enableMusic = process.env.ENABLE_MUSIC !== 'false';

const enablePython3 = process.env.ENABLE_PYTHON3 === 'true' || process.env.FEATURE_PYTHON3 === 'true';
const enableJava = process.env.ENABLE_JAVA === 'true' || process.env.FEATURE_JAVA === 'true';
const enableR = process.env.ENABLE_R === 'true' || process.env.FEATURE_R === 'true';
const enablePygame = process.env.ENABLE_PYGAME === 'true' || process.env.FEATURE_PYGAME === 'true';

const python3ApiUrl = process.env.PYTHON3_API_URL || process.env.SERVERSIDE_PYTHON3_API;
const javaApiUrl = process.env.JAVA_API_URL || process.env.SERVERSIDE_JAVA_API;
const rApiUrl = process.env.R_API_URL || process.env.SERVERSIDE_R_API;
const pygameApiUrl = process.env.PYGAME_API_URL || process.env.SERVERSIDE_PYGAME_API;
const serversideStatsBase = process.env.SERVERSIDE_STATS_BASE;


const hasServersideConfig = python3ApiUrl || javaApiUrl || rApiUrl || pygameApiUrl || serversideStatsBase;

const newLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();

  // Section reset on empty lines
  if (trimmed === '') {
    inAppUrl = false;
    inCookieOptions = false;
    inMongo = false;
    inRedis = false;
    inEmbedSkulpt = false;
    inCdn = false;
    inMail = false;
  }

  // Section boundary detection
  if (trimmed === 'url:') {
    inAppUrl = true;
  } else if (trimmed === 'cookieOptions:') {
    inCookieOptions = true;
  } else if (trimmed === 'mongo:') {
    inMongo = true;
  } else if (trimmed === 'redis:') {
    inRedis = true;
  } else if (trimmed === 'mail:') {
    inMail = true;
    if (!hasMailConfig) {
      continue;
    }
  } else if (trimmed === 'skulpt:') {
    inEmbedSkulpt = true;
  } else if (trimmed === 'cdn:') {
    inCdn = true;
  }

  // Replacements & Output Generation
  if (inAppUrl) {
    if (trimmed.startsWith('protocol:')) {
      newLines.push(line.replace(/protocol:.*/, `protocol: ${appUrlProtocol}`));
      continue;
    }
    if (trimmed.startsWith('hostname:')) {
      newLines.push(line.replace(/hostname:.*/, `hostname: ${appUrlHostname}`));
      continue;
    }
    if (trimmed.startsWith('port:')) {
      newLines.push(line.replace(/port:.*/, `port: ${appUrlPort}`));
      continue;
    }
  }

  if (inCookieOptions) {
    if (trimmed.startsWith('password:')) {
      newLines.push(line.replace(/password:.*/, `password: '${sessionPassword}'`));
      continue;
    }
    if (trimmed.startsWith('isSecure:')) {
      newLines.push(line.replace(/isSecure:.*/, `isSecure: ${appSessionIsSecure}`));
      continue;
    }
  }

  if (inMongo) {
    if (trimmed.startsWith('host:')) {
      newLines.push(line.replace(/host:.*/, `host: ${mongoHost}`));
      continue;
    }
    if (trimmed.startsWith('port:')) {
      newLines.push(line.replace(/port:.*/, `port: ${mongoPort}`));
      continue;
    }
    if (trimmed.startsWith('database:')) {
      newLines.push(line.replace(/database:.*/, `database: ${mongoDatabase}`));
      
      // If mongo credentials are provided, append them here
      if (mongoUser && mongoPass) {
        const indent = line.match(/^\s*/)[0];
        newLines.push(`${indent}user: ${mongoUser}`);
        newLines.push(`${indent}pass: '${mongoPass}'`);
      }
      continue;
    }
  }

  if (inRedis) {
    if (trimmed.startsWith('enabled:')) {
      newLines.push(line.replace(/enabled:.*/, `enabled: ${redisEnabled}`));
      
      if (redisEnabled) {
        // Append host configuration for the different queues/services to match the container
        const indent = line.match(/^\s*/)[0];
        newLines.push(`${indent}app:`);
        newLines.push(`${indent}  host: ${redisHost}`);
        newLines.push(`${indent}  port: ${redisPort}`);
        if (redisPass) {
          newLines.push(`${indent}  pass: '${redisPass}'`);
          newLines.push(`${indent}  password: '${redisPass}'`);
        }
        newLines.push(`${indent}  database: ${redisDatabase}`);
        newLines.push(`${indent}exports:`);
        newLines.push(`${indent}  host: ${redisHost}`);
        newLines.push(`${indent}  port: ${redisPort}`);
        if (redisPass) {
          newLines.push(`${indent}  pass: '${redisPass}'`);
          newLines.push(`${indent}  password: '${redisPass}'`);
        }
        newLines.push(`${indent}  database: ${redisDatabase}`);
        newLines.push(`${indent}sandbox:`);
        newLines.push(`${indent}  host: ${redisHost}`);
        newLines.push(`${indent}  port: ${redisPort}`);
        if (redisPass) {
          newLines.push(`${indent}  pass: '${redisPass}'`);
          newLines.push(`${indent}  password: '${redisPass}'`);
        }
        newLines.push(`${indent}  database: ${redisDatabase}`);
      }
      continue;
    }
  }

  if (inEmbedSkulpt) {
    if (trimmed.startsWith('local:')) {
      newLines.push(line.replace(/local:.*/, `local: ${appEmbedSkulptLocal}`));
      continue;
    }
    if (trimmed.startsWith('min:')) {
      newLines.push(line.replace(/min:.*/, `min: ${appEmbedSkulptMin}`));
      if (hasServersideConfig) {
        newLines.push('');
        newLines.push('  serverside:');
        if (serversideStatsBase) newLines.push(`    statsBase: '${serversideStatsBase}'`);
        if (python3ApiUrl) {
          newLines.push('    python3:');
          newLines.push('      api:');
          newLines.push(`        default: '${python3ApiUrl}'`);
        }
        if (javaApiUrl) {
          newLines.push('    java8:');
          newLines.push('      api:');
          newLines.push(`        default: '${javaApiUrl}'`);
        }
        if (rApiUrl) {
          newLines.push('    r3:');
          newLines.push('      api:');
          newLines.push(`        default: '${rApiUrl}'`);
        }
        if (pygameApiUrl) {
          newLines.push('    pygame:');
          newLines.push('      api:');
          newLines.push(`        default: '${pygameApiUrl}'`);
        }
      }
      continue;
    }
  }

  if (inCdn) {
    if (trimmed.startsWith('host:')) {
      newLines.push(line.replace(/host:.*/, `host: '${awsCdnHost}'`));
      continue;
    }
  }

  if (inMail) {
    if (!hasMailConfig) {
      continue;
    }
    if (trimmed.startsWith('from:')) {
      newLines.push(line.replace(/from:.*/, `from: '${mailFrom}'`));
      continue;
    }
    if (trimmed.startsWith('host:')) {
      newLines.push(line.replace(/host:.*/, `host: '${mailHost}'`));
      continue;
    }
    if (trimmed.startsWith('port:')) {
      newLines.push(line.replace(/port:.*/, `port: ${mailPort}`));
      continue;
    }
    if (trimmed.startsWith('user:')) {
      newLines.push(line.replace(/user:.*/, `user: '${mailUser}'`));
      continue;
    }
    if (trimmed.startsWith('pass:')) {
      newLines.push(line.replace(/pass:.*/, `pass: '${mailPass}'`));
      continue;
    }
  }

  newLines.push(line);
}

newLines.push('');
newLines.push('features:');

newLines.push('  trinkets:');
if (enablePython) newLines.push('    python: true');
if (enableHtml) newLines.push('    html: true');
if (enableBlocks) newLines.push('    blocks: true');
if (enableGlowscript) newLines.push('    glowscript: true');
if (enableGlowscriptBlocks) newLines.push('    glowscript-blocks: true');
if (enableConsole) newLines.push('    console: true');
if (enableMusic) newLines.push('    music: true');
if (enablePython3) newLines.push('    python3: true');
if (enableJava) newLines.push('    java: true');
if (enableR) newLines.push('    R: true');
if (enablePygame) newLines.push('    pygame: true');


fs.writeFileSync(outputPath, newLines.join('\n'), 'utf8');
console.log('Successfully generated config/local.yaml');



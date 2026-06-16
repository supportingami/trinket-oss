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
const appUrlPort = process.env.APP_URL_PORT || '3000';
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

const newLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();

  // Section boundary detection
  if (trimmed === 'url:') {
    inAppUrl = true;
  } else if (trimmed === 'cookieOptions:') {
    inCookieOptions = true;
  } else if (trimmed === 'mongo:') {
    inMongo = true;
  } else if (trimmed === 'redis:') {
    inRedis = true;
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
        newLines.push(`${indent}pass: ${mongoPass}`);
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
        newLines.push(`${indent}exports:`);
        newLines.push(`${indent}  host: ${redisHost}`);
        newLines.push(`${indent}  port: ${redisPort}`);
        newLines.push(`${indent}sandbox:`);
        newLines.push(`${indent}  host: ${redisHost}`);
        newLines.push(`${indent}  port: ${redisPort}`);
      }
      continue;
    }
  }

  // Section reset on empty lines
  if (trimmed === '') {
    inAppUrl = false;
    inCookieOptions = false;
    inMongo = false;
    inRedis = false;
  }

  newLines.push(line);
}

fs.writeFileSync(outputPath, newLines.join('\n'), 'utf8');
console.log('Successfully generated config/local.yaml');

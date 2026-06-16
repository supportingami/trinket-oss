# Trinket

An open source, browser-based coding environment designed for education.

Trinket lets students and educators write and run code directly in the browser, supporting multiple programming languages including Python, HTML, Java, R, and more.

## Features

- **Browser-based code editor** - Write and run code without installing anything
- **Multiple language support** - Python, HTML/CSS/JS, Java, R, GlowScript, and more
- **Embeddable trinkets** - Embed interactive code examples in any webpage
- **Course creation** - Build interactive coding courses and tutorials
- **Code sharing** - Share and remix code with others

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development without Docker)
- MongoDB 5.0+
- Redis (optional - falls back to in-memory)

## Quick Start (Docker)

1. Clone the repository:
   ```bash
   git clone https://github.com/trinketapp/trinket-oss.git
   cd trinket-oss
   ```

2. Copy the example config and add your settings:
   ```bash
   cp config/local.example.yaml config/local.yaml
   ```

3. Start the services:
   ```bash
   docker-compose up
   ```

4. Visit http://localhost:3000 in your browser.

## Configuration

Configuration is managed through YAML files in the `config/` directory:

- `default.yaml` - Base configuration (committed to repo)
- `local.yaml` - Local overrides and secrets (not committed)
- `production.yaml` - Production overrides (not committed)

Copy `config/local.example.yaml` to `config/local.yaml` and fill in the required values.

### Required Configuration

| Setting | Description |
|---------|-------------|
| `app.plugins.session.cookieOptions.password` | Session cookie secret (min 32 chars) |

### Optional Integrations

| Setting | Description |
|---------|-------------|
| `app.mail.*` | SMTP settings for email (password reset, notifications) |
| `aws.*` | S3 storage for user-uploaded assets |
| `app.auth.google.*` | Google OAuth login |
| `app.recaptcha.*` | reCAPTCHA spam protection |

See [GETTING_STARTED.md](GETTING_STARTED.md) for detailed setup of optional features.

## Production Deployment (Docker)

In production, the application is designed to be configured dynamically at container startup using environment variables. This keeps sensitive credentials out of the built Docker image.

To deploy in production:
1. Use the production Compose file: [docker-compose.prod.yml](docker-compose.prod.yml)
2. Define the following environment variables in a `.env` file in the same directory:

### Environment Variables

> [!NOTE]
> **Email Server Opt-In:** Email features (such as password resets and notifications) are disabled by default. To opt-in and configure the mail server, you must set either `RESEND_API_KEY` (to use Resend's SMTP settings automatically) or `MAIL_HOST` / `MAIL_PASS` (to use a generic SMTP server). If none of these variables are defined, the email configuration is completely omitted and email functionality is gracefully disabled.

| Variable | Required/Optional | Default | Description |
|---|---|---|---|
| `SESSION_COOKIE_PASSWORD` | **Required** | *Generated* | Session cookie encryption secret (min 32 characters). If not provided, a secure key is generated automatically on startup, but sessions will reset when the container restarts. |
| `APP_URL_PROTOCOL` | Optional | `http` | Client-facing URL protocol (`http` or `https`) |
| `APP_URL_HOSTNAME` | Optional | `localhost` | Client-facing URL hostname |
| `APP_URL_PORT` | Optional | `3000` | Client-facing URL port |
| `APP_SESSION_IS_SECURE` | Optional | `false` | Set to `true` to enable secure cookies (requires HTTPS setup) |
| `MONGO_HOST` | Optional | `mongodb` | MongoDB host address |
| `MONGO_PORT` | Optional | `27017` | MongoDB port |
| `MONGO_DATABASE` | Optional | `trinket` | MongoDB database name |
| `MONGO_USER` | Optional | *None* | MongoDB username |
| `MONGO_PASS` | Optional | *None* | MongoDB password |
| `REDIS_ENABLED` | Optional | `true` | Enable Redis for session caching and job queues |
| `REDIS_HOST` | Optional | `redis` | Redis server hostname |
| `REDIS_PORT` | Optional | `6379` | Redis server port |
| `REDIS_PASS` | Optional | *None* | Password for Redis authentication (configured for all client connections and Bull queues) |
| `AWS_CDN_HOST` | Optional | *None* | Custom CDN host URL (e.g. `https://your-cdn.example.com`). If not set, CDN requests fall back to loading Skulpt assets locally. |
| `APP_EMBED_SKULPT_LOCAL` | Optional | `true` | Set to `true` to load Skulpt assets locally from the application container. Defaults to `true` unless `AWS_CDN_HOST` is specified. |
| `APP_EMBED_SKULPT_MIN` | Optional | `true` | Set to `true` to load the minified version of local Skulpt core assets. |
| `RESEND_API_KEY` | Optional | *None* | Resend API Key for mail. When set, SMTP defaults to `smtp.resend.com`, port `587`, and user `resend` unless overridden. |
| `MAIL_FROM` | Optional | *None* | Sender email address for mail (must be verified domain or email with your provider). |
| `MAIL_HOST` | Optional | *None* | SMTP server host (defaults to `smtp.resend.com` if `RESEND_API_KEY` is provided). |
| `MAIL_PORT` | Optional | `587` | SMTP server port. |
| `MAIL_USER` | Optional | *None* | SMTP server username (defaults to `resend` if `RESEND_API_KEY` is provided). |
| `MAIL_PASS` | Optional | *None* | SMTP server password (ignored if `RESEND_API_KEY` is provided). |


To run the production environment:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Promoting Admin Users

To promote a registered user to an administrator, run the `make-admin` script with the user's email. Note that the user must register an account first.

### Using Docker (Local Development)

```bash
docker-compose exec app npm run make-admin user@example.com
```

### Using Docker (Production)

```bash
docker-compose -f docker-compose.prod.yml exec app npm run make-admin user@example.com
```

### Without Docker (Local Development)

```bash
npm run make-admin user@example.com
```

## Development

### Running without Docker

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start MongoDB locally (Redis is optional)

3. Run the application:
   ```bash
   node app.js
   ```

### Running Tests

```bash
npm test
```

## Architecture

- **Backend**: Node.js with Hapi framework
- **Database**: MongoDB with Mongoose ODM
- **Cache/Sessions**: Redis (optional)
- **Frontend**: AngularJS 1.x
- **Code Execution**: Skulpt (Python in browser), server-side containers for other languages

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is released under CC0 1.0 Universal (Public Domain Dedication). See the [LICENSE](LICENSE) file for details.

## History

Trinket was originally created by Elliott Hauser and Brian Marks to make coding education accessible to everyone. It is now open source and maintained by the community.

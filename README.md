# Skatehive Hive Account Manager

A secure Node.js microservice for creating and managing Hive blockchain accounts. Built with TypeScript, Express, and the official Hive `@hiveio/dhive` library. Features two-step account creation, emergency key recovery, and Docker + Tailscale deployment.

## 🌐 Live Service
**Production URL**: `https://minivlad.tail83ea3e.ts.net`
**Health Check**: `https://minivlad.tail83ea3e.ts.net/healthz`

## ✨ Features

- 🔒 **Secure by Default**: Authentication via token, rate limiting, helmet security headers
- 🚀 **TypeScript**: Strict type checking and enhanced developer experience
- 📊 **Structured Logging**: JSON logging with Pino and request tracing
- 🔑 **Account Creation**: Create Hive accounts using claimed account credits
- 🧭 **Two-step Account Creation**: Prepare account + finalize flow with session management
- 💾 **Emergency Key Storage**: Local temporary key backup for recovery scenarios
- 💰 **Resource Credits**: Claim account credits using RC instead of HIVE tokens
- 🐳 **Docker Ready**: Multi-stage Dockerfile with non-root user
- 🌐 **Tailscale Integration**: Permanent hosting via Tailscale Funnel
- ⚡ **Production Ready**: Auto-restart, health checks, CORS support

## Prerequisites

- Node.js 20.x or higher
- A Hive account with sufficient Resource Credits (RC)
- Active private key for the creator account (WIF)

## Installation

### Local Development

1. Clone the repository:

```bash
git clone https://github.com/SkateHive/account-manager.git
cd account-manager
```

2. Install dependencies:

```bash
npm install
```

3. Create environment configuration:

```bash
cp .env.example .env
```

4. Edit `.env` and configure your environment variables (see Configuration section)

5. Start development server:

```bash
npm run dev
```

Note: recent changes introduced a two-step account creation flow and emergency key storage; see the "Two-step API" and "Emergency Key Storage" sections below.

### Docker Deployment

1. Build the Docker image:

```bash
docker build -t skatehive-hive-signer .
```

2. Run the container:

```bash
docker run -d \
  --name hive-signer \
  -p 3000:3000 \
  -e HIVE_NODE_URL=https://api.hive.blog \
  -e HIVE_CREATOR=your-account \
  -e HIVE_CREATOR_ACTIVE_WIF=5YourPrivateKey \
  -e SIGNER_TOKEN=your-secure-token \
  -e PORT=3000 \
  -e NODE_ENV=production \
  skatehive-hive-signer
```

## Configuration

All configuration is done via environment variables:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `HIVE_NODE_URL` | Hive API node URL | Yes | `https://api.hive.blog` |
| `HIVE_CREATOR` | Hive account name that creates accounts | Yes | - |
| `HIVE_CREATOR_ACTIVE_WIF` | Active private key (WIF format) of creator | Yes | - |
| `SIGNER_TOKEN` | Secret token for API authentication | Yes | - |
| `PORT` | Server port | No | `3000` |
| `NODE_ENV` | Environment (development/production/test) | No | `development` |
| `EMERGENCY_STORAGE_PATH` | Local path for temporary emergency key storage | No | `./emergency-recovery` |

## 🚀 Quick Deploy (Docker + Tailscale)

### Prerequisites
- Docker installed and running
- Tailscale connected with Funnel enabled

### Deploy in 3 Steps

1. **Configure environment:**
```bash
# Copy and edit production config
cp .env.production.example .env.production
# Edit .env.production with your values
```

2. **Deploy:**
```bash
# Make scripts executable and deploy
chmod +x deploy.sh configure-production.sh
./configure-production.sh  # Copies from .env to .env.production
./deploy.sh                # Builds and deploys Docker container
```

3. **Your service is now live at:**
   - **Public URL**: `https://minivlad.tail83ea3e.ts.net`
   - **Local URL**: `http://localhost:3001`

### Environment Variables Details

- **HIVE_NODE_URL**: The Hive RPC node to connect to. Use a reliable public node or your own.
- **HIVE_CREATOR**: Your Hive account that will create new accounts. Must have sufficient RC.
- **HIVE_CREATOR_ACTIVE_WIF**: The active private key of your creator account. Keep this secure!
- **SIGNER_TOKEN**: A random secure token (minimum 32 characters) for API authentication.

### Generating a Secure Token

```bash
# Linux/Mac
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 📡 API Endpoints

### Health Check (Enhanced)
Check service availability and optionally validate authentication:

```bash
GET /healthz
# Optional: x-signer-token header for auth validation
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-31T12:34:56.789Z",
  "auth": "valid" | "invalid" | "not-provided"
}
```

### Claim Account Credit
Claim a Hive account creation credit using Resource Credits:

```bash
POST /claim-account
Headers: { x-signer-token: your-secure-token }
```

### Two-Step Account Creation Flow

#### 1. Prepare Account
Reserve a session and verify account name availability:

```bash
POST /prepare-account
Headers: { 
  x-signer-token: your-secure-token,
  Content-Type: application/json
}
Body: { "new_account_name": "desiredname" }
```

**Response:**
```json
{
  "session_id": "uuid-session-id",
  "expires_at": "2025-10-31T12:15:00.000Z"
}
```

#### 2. Create Claimed Account
Finalize account creation with session and authorities:

```bash
POST /create-claimed-account
Headers: { 
  x-signer-token: your-secure-token,
  Content-Type: application/json
}
Body: {
  "session_id": "uuid-from-prepare",
  "new_account_name": "desiredname",
  "owner": {
    "weight_threshold": 1,
    "account_auths": [],
    "key_auths": [["STM8ownerkey...", 1]]
  },
  "active": {
    "weight_threshold": 1,
    "account_auths": [],
    "key_auths": [["STM8activekey...", 1]]
  },
  "posting": {
    "weight_threshold": 1,
    "account_auths": [],
    "key_auths": [["STM8postingkey...", 1]]
  },
  "memo_key": "STM8memokey...",
  "signature_proof": "signature-or-proof"
}
```

**Success Response:**
```json
{
  "success": true,
  "transaction_id": "hive-transaction-id",
  "account_name": "desiredname",
  "message": "Account created successfully"
}
```

## 🔧 Frontend Integration

### JavaScript SDK Example

```javascript
class HiveAccountService {
  constructor(baseUrl = 'https://minivlad.tail83ea3e.ts.net', signerToken) {
    this.baseUrl = baseUrl;
    this.headers = {
      'Content-Type': 'application/json',
      'x-signer-token': signerToken
    };
  }

  async checkHealth() {
    const response = await fetch(`${this.baseUrl}/healthz`, {
      headers: { 'x-signer-token': this.headers['x-signer-token'] }
    });
    return response.json();
  }

  async prepareAccount(accountName) {
    const response = await fetch(`${this.baseUrl}/prepare-account`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ new_account_name: accountName })
    });
    return response.json();
  }

  async createAccount(sessionId, accountName, authorities, signatureProof) {
    const response = await fetch(`${this.baseUrl}/create-claimed-account`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        session_id: sessionId,
        new_account_name: accountName,
        ...authorities,
        signature_proof: signatureProof
      })
    });
    return response.json();
  }
}

// Usage
const service = new HiveAccountService('https://minivlad.tail83ea3e.ts.net', 'your-token');

// Test health and auth
const health = await service.checkHealth();
console.log('Service health:', health); // { status: 'ok', auth: 'valid' }

// Two-step account creation
const { session_id } = await service.prepareAccount('newuser123');
const result = await service.createAccount(session_id, 'newuser123', authorities, proof);
```

### Quick Test Commands

```bash
# Test health endpoint
curl https://minivlad.tail83ea3e.ts.net/healthz

# Test with authentication
curl -H "x-signer-token: YOUR_TOKEN" https://minivlad.tail83ea3e.ts.net/healthz

# Test prepare account
curl -X POST https://minivlad.tail83ea3e.ts.net/prepare-account \
  -H "x-signer-token: YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"new_account_name": "testuser123"}'
```

## Usage Examples

### Claim an Account Credit

```bash
curl -X POST http://localhost:3000/claim-account \
  -H "x-signer-token: your-secure-token"
```

### Two-step flow example (prepare + finalize)

1. Prepare the account:

```bash
curl -X POST http://localhost:3000/prepare-account \
  -H "x-signer-token: your-secure-token" \
  -H "Content-Type: application/json" \
  -d '{"new_account_name": "testuser123"}'
```

2. Frontend generates keys locally and builds authority objects using public WIF keys.

3. Finalize creation with `session_id`:

```bash
curl -X POST http://localhost:3000/create-claimed-account \
  -H "x-signer-token: your-secure-token" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "the-session-id-from-prepare",
    "new_account_name": "testuser123",
    "owner": { "weight_threshold": 1, "account_auths": [], "key_auths": [["STM8...",1]] },
    "active": { "weight_threshold": 1, "account_auths": [], "key_auths": [["STM8...",1]] },
    "posting": { "weight_threshold": 1, "account_auths": [], "key_auths": [["STM8...",1]] },
    "memo_key": "STM8...",
    "signature_proof": "..."
  }'
```

## Security Considerations

- **NEVER** commit private keys to version control.
- **NEVER** log private keys or the `HIVE_CREATOR_ACTIVE_WIF` environment variable.
- Store the active WIF only in environment variables or a secrets manager.
- Use secret management systems (AWS Secrets Manager, HashiCorp Vault) in production.
- Rotate the `SIGNER_TOKEN` regularly.
- Use different tokens for different environments.

### Rate Limiting

The service implements two layers of rate limiting:
- **Global**: 120 requests per 15 minutes per IP
- **Account Operations**: 30 requests per 15 minutes per IP

### Authentication

All protected endpoints require the `x-signer-token` header. Keep this token secure and rotate it regularly.

### CORS

CORS is **disabled by default**. Enable only if needed and configure allowed origins in `src/server.ts`.

### Network Security

- Use HTTPS in production (configure via reverse proxy like nginx).
- Restrict access to the service using firewall rules.
- Consider running behind a VPN or using IP whitelisting.

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically

### Deployment Scripts

- `deploy.sh` - Complete Docker deployment with Tailscale Funnel setup
- `configure-production.sh` - Helper to setup production environment from development config
- `test-2step-creation.sh` - Integration testing script for two-step account creation flow

```bash
# Make scripts executable
chmod +x deploy.sh configure-production.sh test-2step-creation.sh

# Setup and deploy
./configure-production.sh  # Setup production config
./deploy.sh                # Deploy Docker container with Tailscale

# Test the deployment
./test-2step-creation.sh   # Integration test (optional)
```

## 🐳 Docker + Tailscale Deployment

### Current Infrastructure Integration
This service integrates seamlessly with existing Docker infrastructure:
- ✅ Docker multi-service setup (VSC node, Bitcoin, MongoDB, etc.)
- ✅ Tailscale with Funnel: `minivlad.tail83ea3e.ts.net`
- ✅ Port management: Service runs on port 3001, proxied via Tailscale

### Deployment Architecture
```
Internet → Tailscale Funnel → Docker Container (port 3001) → Account Manager
```

### Manual Docker Commands
```bash
# Build image
docker build -t skatehive-account-manager .

# Run container
docker run -d \
  --name skatehive-account-manager \
  --restart unless-stopped \
  -p 3001:3000 \
  --env-file .env.production \
  skatehive-account-manager

# Enable Tailscale Funnel (new syntax)
/Applications/Tailscale.app/Contents/MacOS/Tailscale funnel --bg 3001

# Check status
docker ps --filter name=skatehive-account-manager
```

### Docker Compose Configuration
```yaml
version: '3.8'
services:
  account-manager:
    build: .
    container_name: skatehive-account-manager
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      - NODE_ENV=production
      - HIVE_NODE_URL=${HIVE_NODE_URL}
      - HIVE_CREATOR=${HIVE_CREATOR}
      - HIVE_CREATOR_ACTIVE_WIF=${HIVE_CREATOR_ACTIVE_WIF}
      - SIGNER_TOKEN=${SIGNER_TOKEN}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - skatehive-network
```

### Production Environment Template
```bash
# .env.production
HIVE_NODE_URL=https://api.hive.blog
HIVE_CREATOR=your-creator-account
HIVE_CREATOR_ACTIVE_WIF=5YourActivePrivateKeyHere
SIGNER_TOKEN=your-secure-32-character-token
NODE_ENV=production
PORT=3000
```

### Project Structure

```
.
├── src/
│   ├── config/
│   │   └── env.ts           # Environment variable validation
│   ├── lib/
│   │   ├── hive.ts          # Hive blockchain client and operations
│   │   └── validators.ts    # Zod validation schemas
│   ├── middleware/
│   │   ├── auth.ts          # Authentication middleware
│   │   └── rate.ts          # Rate limiting middleware
│   ├── routes/
│   │   ├── accounts.ts      # Account creation endpoints
│   │   └── health.ts        # Health check endpoint
│   └── server.ts            # Express app and server setup
├── .env.example             # Example environment configuration
├── .eslintrc.json           # ESLint configuration
├── Dockerfile               # Multi-stage Docker build
├── nodemon.json             # Nodemon configuration
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
└── README.md                # This file
```

Additional important files/directories (recent additions):

- `src/lib/session-storage.ts` - In-memory session storage for the two-step prepare/confirm flow. Sessions are short-lived and meant to prevent replay attacks.
- `src/lib/emergency-storage.ts` - Local, temporary emergency key storage (filesystem). Files are created with restricted permissions and the directory is gitignored. Use only as last-resort recovery.

## Monitoring and Logging

The service uses Pino for structured JSON logging with the following features:

- Request IDs for distributed tracing
- Automatic redaction of sensitive fields (tokens, private keys)
- Different log levels based on HTTP status codes
- Pretty printing in development mode
- JSON output in production for log aggregation

## Troubleshooting

- Validation Errors (400): Check the JSON body against the Zod schemas in `src/lib/validators.ts`.
- Authentication Errors (401): Verify the `x-signer-token` header.
- Rate Limit Errors (429): Respect the rate limits or increase limits in middleware configuration.
- Blockchain Errors (502): Check the configured Hive node and RC availability.
- "Non-base58 character" errors when creating PrivateKey objects: Ensure keys are in correct WIF format when passed to `@hiveio/dhive`. When generating deterministic keys locally, convert to WIF before sending or use the server helper that returns WIF if appropriate.

## 🆘 Emergency Key Storage

Local temporary key backup system for recovery scenarios:

- **Path**: `./emergency-recovery` (configurable via `EMERGENCY_STORAGE_PATH`)
- **Permissions**: Files written with 0600 (owner read/write only)
- **Git-ignored**: Directory excluded from version control
- **Development only**: Use secrets manager in production

### Recovery Endpoints
```bash
# List stored accounts (development only)
GET /emergency/accounts
Headers: { x-signer-token: your-token }

# Retrieve keys for specific account
GET /emergency/retrieve/:accountName
Headers: { x-signer-token: your-token }
```

⚠️ **Important**: Emergency storage is for development/testing only. In production, integrate with proper secrets management (AWS Secrets Manager, HashiCorp Vault, etc.).

## Try it (two-step flow)

1. Start the server in dev mode:

```bash
npm run dev
```

2. Prepare account (replace host/port as needed):

```bash
curl -X POST http://localhost:3000/prepare-account \
  -H "x-signer-token: your-secure-token" \
  -H "Content-Type: application/json" \
  -d '{"new_account_name": "testuser123"}'
```

3. Generate keys locally in your frontend or test harness (owner/active/posting/memo). Build the authorities objects using public WIF keys.

4. Finalize creation with proof and the `session_id`:

```bash
curl -X POST http://localhost:3000/create-claimed-account \
  -H "x-signer-token: your-secure-token" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "the-session-id-from-prepare",
    "new_account_name": "testuser123",
    "owner": { "weight_threshold": 1, "account_auths": [], "key_auths": [["STM8...",1]] },
    "active": { "weight_threshold": 1, "account_auths": [], "key_auths": [["STM8...",1]] },
    "posting": { "weight_threshold": 1, "account_auths": [], "key_auths": [["STM8...",1]] },
    "memo_key": "STM8...",
    "signature_proof": "..."
  }'
```

If the frontend could not persist the private keys, check the emergency storage (local only) for a recovery copy — but only if you intentionally enabled or allowed emergency recovery in development.

## 📋 Error Handling & Status Codes

### Common HTTP Status Codes
- `200` - Success
- `400` - Validation Error (check request body format)
- `401` - Authentication Error (invalid x-signer-token)  
- `409` - Account name already exists
- `429` - Rate limit exceeded
- `502` - Blockchain error (insufficient RC, network issues)

### Error Response Format
```json
{
  "error": "Error Type",
  "message": "Human readable message", 
  "details": "Additional context or validation errors"
}
```

## 🔒 Security Features

### Rate Limiting
- **Global**: 120 requests per 15 minutes per IP
- **Account Operations**: 30 requests per 15 minutes per IP

### CORS Configuration
- **Development**: `localhost:3000`, `localhost:3001`, `localhost:5173`, `localhost:8080`
- **Production**: `https://skatehive.app`, `https://www.skatehive.app`

### Session Management
- **Expiration**: 15 minutes for account preparation sessions
- **Single-use**: Sessions invalidated after account creation
- **Cleanup**: Automatic cleanup of expired sessions

## 🔧 Troubleshooting

### Common Issues
- **CORS Error**: Verify origin matches allowed domains
- **"Non-base58 character"**: Keys must be in WIF format for `@hiveio/dhive`
- **Session expired**: Sessions expire in 15 minutes, prepare new session
- **Rate limited**: Respect rate limits or increase in middleware config
- **Auth invalid**: Double-check `x-signer-token` matches server config

### Health Check Debugging
```bash
# Basic connectivity
curl https://minivlad.tail83ea3e.ts.net/healthz

# With authentication test
curl -H "x-signer-token: YOUR_TOKEN" https://minivlad.tail83ea3e.ts.net/healthz

# Expected responses:
# {"status":"ok","timestamp":"...","auth":"valid"}     - ✅ Ready
# {"status":"ok","timestamp":"...","auth":"invalid"}   - ❌ Wrong token  
# {"status":"ok","timestamp":"...","auth":"not-provided"} - ⚠️ No token
```

## 📝 Changelog

### 2025-10-31 - Major Update
- ✅ **Two-step account creation** with session management
- ✅ **Emergency key storage** for development recovery  
- ✅ **Docker + Tailscale deployment** integration
- ✅ **Enhanced health endpoint** with auth validation
- ✅ **CORS support** for frontend integration
- ✅ **Production deployment scripts** and automation
- ✅ **Comprehensive documentation** consolidation

## 🚀 Production Checklist

- [ ] Configure `.env.production` with real values
- [ ] Test health endpoint: `curl https://minivlad.tail83ea3e.ts.net/healthz`
- [ ] Verify Docker container is healthy: `docker ps --filter name=skatehive-account-manager`
- [ ] Confirm Tailscale Funnel is active: `/Applications/Tailscale.app/Contents/MacOS/Tailscale funnel status`
- [ ] Test frontend integration with two-step flow
- [ ] Monitor container logs: `docker logs skatehive-account-manager`
- [ ] Set up log aggregation for production monitoring
- [ ] Configure secrets management for production keys
- [ ] Test emergency recovery procedures (development only)

---

**🎯 Quick Start**: Run `./deploy.sh` after configuring `.env.production` to get your permanent Hive account creation service running at `https://minivlad.tail83ea3e.ts.net`
# Skatehive Hive Signer Microservice

A secure Node.js microservice for creating and managing Hive blockchain accounts. Built with TypeScript, Express, and the official Hive dhive library.

## Features

- 🔒 **Secure by Default**: Authentication via token, rate limiting, helmet security headers
- 🚀 **TypeScript**: Strict type checking and enhanced developer experience
- 📊 **Structured Logging**: JSON logging with Pino and request tracing
- 🔑 **Account Creation**: Create Hive accounts using claimed account credits
- 💰 **Resource Credits**: Claim account credits using RC instead of HIVE tokens
- 🐳 **Docker Ready**: Multi-stage Dockerfile with non-root user
- ⚡ **Production Ready**: Graceful shutdown, error handling, health checks

## Prerequisites

- Node.js 20.x or higher
- A Hive account with sufficient Resource Credits (RC)
- Active private key for the creator account

## Installation

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/SkateHive/account-manager.git
cd account-manager
```

2. Install dependencies:
```bash
npm install
```

3. Create environment configuration:
```bash
cp .env.example .env
```

4. Edit `.env` and configure your environment variables (see Configuration section)

5. Start development server:
```bash
npm run dev
```

### Docker Deployment

1. Build the Docker image:
```bash
docker build -t skatehive-hive-signer .
```

2. Run the container:
```bash
docker run -d \
  --name hive-signer \
  -p 3000:3000 \
  -e HIVE_NODE_URL=https://api.hive.blog \
  -e HIVE_CREATOR=your-account \
  -e HIVE_CREATOR_ACTIVE_WIF=5YourPrivateKey \
  -e SIGNER_TOKEN=your-secure-token \
  -e PORT=3000 \
  -e NODE_ENV=production \
  skatehive-hive-signer
```

## Configuration

All configuration is done via environment variables:

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `HIVE_NODE_URL` | Hive API node URL | Yes | `https://api.hive.blog` |
| `HIVE_CREATOR` | Hive account name that creates accounts | Yes | - |
| `HIVE_CREATOR_ACTIVE_WIF` | Active private key (WIF format) of creator | Yes | - |
| `SIGNER_TOKEN` | Secret token for API authentication | Yes | - |
| `PORT` | Server port | No | `3000` |
| `NODE_ENV` | Environment (development/production/test) | No | `development` |

### Environment Variables Details

- **HIVE_NODE_URL**: The Hive RPC node to connect to. Use a reliable public node or your own.
- **HIVE_CREATOR**: Your Hive account that will create new accounts. Must have sufficient RC.
- **HIVE_CREATOR_ACTIVE_WIF**: The active private key of your creator account. Keep this secure!
- **SIGNER_TOKEN**: A random secure token (minimum 32 characters) for API authentication.

### Generating a Secure Token

```bash
# Linux/Mac
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## API Endpoints

### Health Check

Check if the service is running:

```bash
GET /healthz
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Claim Account

Claim an account creation credit using Resource Credits (RC):

```bash
POST /claim-account
Headers:
  x-signer-token: your-secure-token
```

**Response (Success):**
```json
{
  "success": true,
  "transaction_id": "abc123...",
  "message": "Account claim successful. You can now create a claimed account."
}
```

### Create Claimed Account

Create a new Hive account using a previously claimed credit:

```bash
POST /create-claimed-account
Headers:
  x-signer-token: your-secure-token
  Content-Type: application/json

Body:
{
  "new_account_name": "newusername",
  "owner": {
    "weight_threshold": 1,
    "account_auths": [],
    "key_auths": [["STM7abc123...", 1]]
  },
  "active": {
    "weight_threshold": 1,
    "account_auths": [],
    "key_auths": [["STM7def456...", 1]]
  },
  "posting": {
    "weight_threshold": 1,
    "account_auths": [],
    "key_auths": [["STM7ghi789...", 1]]
  },
  "memo_key": "STM7jkl012...",
  "json_metadata": "{}"
}
```

**Response (Success):**
```json
{
  "success": true,
  "transaction_id": "xyz789...",
  "account_name": "newusername",
  "message": "Account created successfully"
}
```

## Usage Examples

### Claim an Account Credit

```bash
curl -X POST http://localhost:3000/claim-account \
  -H "x-signer-token: your-secure-token"
```

### Create a New Account

```bash
curl -X POST http://localhost:3000/create-claimed-account \
  -H "x-signer-token: your-secure-token" \
  -H "Content-Type: application/json" \
  -d '{
    "new_account_name": "skatehiveuser",
    "owner": {
      "weight_threshold": 1,
      "account_auths": [],
      "key_auths": [["STM8owner1234567890abcdefghijklmnopqrstuvwxyz12345", 1]]
    },
    "active": {
      "weight_threshold": 1,
      "account_auths": [],
      "key_auths": [["STM8active123456789abcdefghijklmnopqrstuvwxyz12345", 1]]
    },
    "posting": {
      "weight_threshold": 1,
      "account_auths": [],
      "key_auths": [["STM8posting12345678abcdefghijklmnopqrstuvwxyz12345", 1]]
    },
    "memo_key": "STM8memo1234567890abcdefghijklmnopqrstuvwxyz123456",
    "json_metadata": "{}"
  }'
```

## Security Considerations

### Private Key Management
- **NEVER** commit private keys to version control
- **NEVER** log private keys or the `HIVE_CREATOR_ACTIVE_WIF` environment variable
- Store the active WIF only in environment variables
- Use secret management systems (AWS Secrets Manager, HashiCorp Vault) in production
- Rotate the `SIGNER_TOKEN` regularly
- Use different tokens for different environments

### Rate Limiting
The service implements two layers of rate limiting:
- **Global**: 120 requests per 15 minutes per IP
- **Account Operations**: 30 requests per 15 minutes per IP

### Authentication
All protected endpoints require the `x-signer-token` header. Keep this token secure and rotate it regularly.

### CORS
CORS is **disabled by default**. Enable only if needed and configure allowed origins:

```typescript
// In src/server.ts, uncomment and configure:
app.use(cors({ origin: 'https://your-frontend-domain.com' }));
```

### Network Security
- Use HTTPS in production (configure via reverse proxy like nginx)
- Restrict access to the service using firewall rules
- Consider running behind a VPN or using IP whitelisting
- Use environment-based configuration, never hardcode secrets

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically

### Project Structure

```
.
├── src/
│   ├── config/
│   │   └── env.ts           # Environment variable validation
│   ├── lib/
│   │   ├── hive.ts          # Hive blockchain client and operations
│   │   └── validators.ts    # Zod validation schemas
│   ├── middleware/
│   │   ├── auth.ts          # Authentication middleware
│   │   └── rate.ts          # Rate limiting middleware
│   ├── routes/
│   │   ├── accounts.ts      # Account creation endpoints
│   │   └── health.ts        # Health check endpoint
│   └── server.ts            # Express app and server setup
├── .env.example             # Example environment configuration
├── .eslintrc.json           # ESLint configuration
├── Dockerfile               # Multi-stage Docker build
├── nodemon.json             # Nodemon configuration
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
└── README.md                # This file
```

## Error Handling

The API returns consistent JSON error responses:

### Validation Errors (400)
```json
{
  "error": "Validation Error",
  "message": "Invalid request parameters",
  "details": [
    {
      "field": "new_account_name",
      "message": "Account name must be at least 3 characters"
    }
  ]
}
```

### Authentication Errors (401)
```json
{
  "error": "Unauthorized",
  "message": "Invalid x-signer-token"
}
```

### Rate Limit Errors (429)
```json
{
  "error": "Too Many Requests",
  "message": "Account operations rate limit exceeded. Please try again later."
}
```

### Blockchain Errors (502)
```json
{
  "error": "Blockchain Error",
  "message": "Failed to create account on Hive blockchain",
  "details": "RC bandwidth limit exceeded"
}
```

## Monitoring and Logging

The service uses Pino for structured JSON logging with the following features:

- Request IDs for distributed tracing
- Automatic redaction of sensitive fields (tokens, private keys)
- Different log levels based on HTTP status codes
- Pretty printing in development mode
- JSON output in production for log aggregation

### Log Levels
- `error` - 5xx responses and exceptions
- `warn` - 4xx responses
- `info` - Successful requests and server events
- `debug` - Detailed debugging information (dev only)

## Deployment Tips

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Use a strong `SIGNER_TOKEN` (minimum 32 characters)
- [ ] Configure HTTPS via reverse proxy
- [ ] Set up log aggregation (CloudWatch, ELK, etc.)
- [ ] Configure monitoring and alerts
- [ ] Use a secret management system for sensitive variables
- [ ] Enable firewall rules to restrict access
- [ ] Set up automated backups of creator account
- [ ] Configure proper resource limits (memory, CPU)
- [ ] Use a reliable Hive RPC node or run your own

### Kubernetes Deployment

Example deployment configuration:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hive-signer
spec:
  replicas: 2
  selector:
    matchLabels:
      app: hive-signer
  template:
    metadata:
      labels:
        app: hive-signer
    spec:
      containers:
      - name: hive-signer
        image: skatehive-hive-signer:latest
        ports:
        - containerPort: 3000
        env:
        - name: HIVE_NODE_URL
          value: "https://api.hive.blog"
        - name: HIVE_CREATOR
          valueFrom:
            secretKeyRef:
              name: hive-secrets
              key: creator
        - name: HIVE_CREATOR_ACTIVE_WIF
          valueFrom:
            secretKeyRef:
              name: hive-secrets
              key: active-wif
        - name: SIGNER_TOKEN
          valueFrom:
            secretKeyRef:
              name: hive-secrets
              key: signer-token
        - name: PORT
          value: "3000"
        - name: NODE_ENV
          value: "production"
        resources:
          limits:
            memory: "256Mi"
            cpu: "500m"
          requests:
            memory: "128Mi"
            cpu: "250m"
        livenessProbe:
          httpGet:
            path: /healthz
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /healthz
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
```

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.

## Contributing

Contributions are welcome! Please follow these guidelines:
1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure all tests pass and code is linted
5. Submit a pull request

---

**⚠️ Security Notice**: This service handles private keys. Always follow security best practices and never expose sensitive credentials.
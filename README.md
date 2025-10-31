# Skatehive Hive Signer Microservice

A secure Node.js microservice for creating and managing Hive blockchain accounts. Built with TypeScript, Express, and the official Hive `@hiveio/dhive` library.

## Features

- 🔒 **Secure by Default**: Authentication via token, rate limiting, helmet security headers
- 🚀 **TypeScript**: Strict type checking and enhanced developer experience
- 📊 **Structured Logging**: JSON logging with Pino and request tracing
- 🔑 **Account Creation**: Create Hive accounts using claimed account credits
- 🧭 **Two-step Account Creation**: Prepare account + finalize (claimed) flow to allow frontends to generate keys and confirm creation without exposing creator credentials
- 💰 **Resource Credits**: Claim account credits using RC instead of HIVE tokens
- 🐳 **Docker Ready**: Multi-stage Dockerfile with non-root user
- ⚡ **Production Ready**: Graceful shutdown, error handling, health checks

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

## API Endpoints (high level)

### Health Check

Check if the service is running:

```bash
GET /healthz
```

### Claim Account (claim an account credit)

```bash
POST /claim-account
Headers:
  x-signer-token: your-secure-token
```

### Prepare Account (two-step flow)

Frontend calls this to verify availability and reserve a short-lived session.

```bash
POST /prepare-account
Headers:
  x-signer-token: your-secure-token
Content-Type: application/json

Body:
{
  "new_account_name": "desiredname"
}
```

Response example:

```json
{
  "session_id": "uuid",
  "expires_at": "2025-10-31T12:00:00.000Z"
}
```

### Create Claimed Account (finalize, two-step or one-step)

This endpoint accepts final authorities and a session token (if using two-step). It will submit the account creation transaction to the Hive network.

```bash
POST /create-claimed-account
Headers:
  x-signer-token: your-secure-token
  Content-Type: application/json

Body (two-step):
{
  "session_id": "uuid-from-prepare",
  "new_account_name": "desiredname",
  "owner": { ... },
  "active": { ... },
  "posting": { ... },
  "memo_key": "STM8...",
  "signature_proof": "..."
}
```

Response (Success):

```json
{
  "success": true,
  "transaction_id": "xyz789...",
  "account_name": "desiredname",
  "message": "Account created successfully"
}
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

### New/Updated Scripts & Files

- `test-2step-creation.sh` - A helper script that runs the full two-step flow against a running instance for integration testing. Make it executable and run:

```bash
chmod +x test-2step-creation.sh
./test-2step-creation.sh
```

This script is intended for local/integration testing only. It will generate temporary keys and attempt the prepare -> finalize flow. Do not run this against production without reviewing the script.

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

## Emergency Key Storage (local, temporary)

This project includes an emergency local key storage feature for recovery scenarios during development or integration testing. Important constraints:

- Emergency storage path: default `./emergency-recovery` (configurable via `EMERGENCY_STORAGE_PATH`).
- Files are written with restrictive permissions (0600) and the directory is included in `.gitignore` to prevent accidental commits.
- Emergency storage is intended as a last-resort developer convenience only. In production, integrate with a secure secrets manager and do not enable emergency storage.
- The code explicitly logs warnings when emergency storage is used.

If you discover a missing key after account creation (e.g., frontend failed to persist keys), check the emergency storage using the management endpoints (if enabled) or by listing files in the directory (local only).

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

## Changelog (selected)

- 2025-10-31: Added two-step prepare/confirm account creation flow, session management, and emergency local key storage for recovery/testing. Fixed key generation to return WIFs compatible with `@hiveio/dhive`.

## Final notes

This README was updated to reflect recent security and workflow improvements. If you maintain a frontend that creates accounts, update it to use the two-step flow to avoid exposing sensitive creator credentials. If you want, I can also create a minimal frontend example showing the prepare -> generate-keys -> finalize sequence.
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
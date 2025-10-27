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
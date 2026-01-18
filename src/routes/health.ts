import { Router, Request, Response } from 'express';
import { config } from '../config/env';

const router = Router();

/**
 * Health check endpoint
 * Returns service status and current timestamp
 * Optionally validates authentication if x-signer-token is provided
 * No authentication required - used for monitoring and load balancers
 */
router.get('/healthz', (req: Request, res: Response) => {
  const token = req.headers['x-signer-token'];
  let authStatus = 'not-provided';
  
  // If token is provided, validate it
  if (token) {
    if (token === config.SIGNER_TOKEN) {
      authStatus = 'valid';
    } else {
      authStatus = 'invalid';
    }
  }
  
  const payload = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    auth: authStatus,
  };

  const accept = String(req.headers.accept || '');
  if (accept.includes('text/html')) {
    const html = [
      '<!doctype html>',
      '<html>',
      '  <head><meta charset="utf-8"><title>Signup Signer Health</title></head>',
      '  <body>',
      '    <h1>Signup Signer Health</h1>',
      '    <p>Status: ' + payload.status + '</p>',
      '    <p>Auth: ' + payload.auth + '</p>',
      '    <p>Timestamp: ' + payload.timestamp + '</p>',
      '  </body>',
      '</html>'
    ].join('
');
    res.status(200).type('html').send(html);
    return;
  }

  res.status(200).json(payload);
});

export default router;

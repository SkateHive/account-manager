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
  
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    auth: authStatus,
  });
});

export default router;

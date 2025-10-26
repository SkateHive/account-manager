import { Router, Request, Response } from 'express';

const router = Router();

/**
 * Health check endpoint
 * Returns service status and current timestamp
 * No authentication required - used for monitoring and load balancers
 */
router.get('/healthz', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

export default router;

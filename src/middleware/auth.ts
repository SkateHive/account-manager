import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';

/**
 * Authentication middleware
 * Validates x-signer-token header against configured SIGNER_TOKEN
 * Returns 401 Unauthorized if token is missing or invalid
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers['x-signer-token'];

  // Check if token is provided
  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing x-signer-token header',
    });
    return;
  }

  // Verify token matches configured value
  if (token !== config.SIGNER_TOKEN) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid x-signer-token',
    });
    return;
  }

  // Token is valid, proceed to next middleware
  next();
}

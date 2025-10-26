import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { accountOperationsLimiter } from '../middleware/rate';
import { createClaimedAccountSchema } from '../lib/validators';
import { claimAccount, createClaimedAccount, isAccountAvailable } from '../lib/hive';

const router = Router();

// Apply authentication and rate limiting to all account routes
router.use(authMiddleware);
router.use(accountOperationsLimiter);

/**
 * POST /claim-account
 * Claims an account creation credit using Resource Credits (RC)
 * This must be done before creating a claimed account
 */
router.post('/claim-account', (req: Request, res: Response) => {
  void (async (): Promise<void> => {
    try {
      // Broadcast claim_account operation to Hive blockchain
      const txId = await claimAccount();
      
      // Log success (but never log private keys or secrets)
      req.log.info({ txId }, 'Account claim successful');
      
      res.status(200).json({
        success: true,
        transaction_id: txId,
        message: 'Account claim successful. You can now create a claimed account.',
      });
    } catch (error) {
      // Handle Hive RPC errors
      req.log.error({ error }, 'Failed to claim account');
      
      // Check if it's a Hive API error
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = String(error.message);
        
        // Map specific Hive errors to appropriate status codes
        if (errorMessage.includes('bandwidth') || errorMessage.includes('RC')) {
          res.status(502).json({
            error: 'Insufficient Resources',
            message: 'Creator account has insufficient Resource Credits (RC) to claim an account.',
            hive_error: errorMessage,
          });
          return;
        }
      }
      
      // Generic Hive RPC error
      res.status(502).json({
        error: 'Blockchain Error',
        message: 'Failed to claim account on Hive blockchain',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })();
});

/**
 * POST /create-claimed-account
 * Creates a new Hive account using a previously claimed account credit
 * Requires valid account creation parameters
 */
router.post('/create-claimed-account', (req: Request, res: Response) => {
  void (async (): Promise<void> => {
    try {
      // Validate request body against schema
      const validatedData = createClaimedAccountSchema.parse(req.body);
      
      // Check if account name is available
      const available = await isAccountAvailable(validatedData.new_account_name);
      if (!available) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Account name is already taken',
          field: 'new_account_name',
        });
        return;
      }
      
      // Broadcast create_claimed_account operation
      const txId = await createClaimedAccount(validatedData);
      
      // Log success (never log private keys or request body that may contain sensitive data)
      req.log.info(
        { 
          txId, 
          accountName: validatedData.new_account_name 
        }, 
        'Account creation successful'
      );
      
      res.status(201).json({
        success: true,
        transaction_id: txId,
        account_name: validatedData.new_account_name,
        message: 'Account created successfully',
      });
    } catch (error) {
      // Handle validation errors
      if (error instanceof z.ZodError) {
        req.log.warn({ errors: error.errors }, 'Validation failed');
        
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request parameters',
          details: error.errors.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
        return;
      }
      
      // Handle Hive RPC errors
      req.log.error({ error }, 'Failed to create claimed account');
      
      // Check if it's a Hive API error
      if (error && typeof error === 'object' && 'message' in error) {
        const errorMessage = String(error.message);
        
        // Map specific Hive errors to appropriate status codes
        if (errorMessage.includes('no claimed accounts') || errorMessage.includes('pending claimed accounts')) {
          res.status(502).json({
            error: 'No Claimed Accounts',
            message: 'Creator has no claimed account credits available. Please claim an account first.',
            hive_error: errorMessage,
          });
          return;
        }
        
        if (errorMessage.includes('already exists') || errorMessage.includes('taken')) {
          res.status(400).json({
            error: 'Validation Error',
            message: 'Account name is already taken',
            hive_error: errorMessage,
          });
          return;
        }
      }
      
      // Generic Hive RPC error
      res.status(502).json({
        error: 'Blockchain Error',
        message: 'Failed to create account on Hive blockchain',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })();
});

export default router;

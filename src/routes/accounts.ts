import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { accountOperationsLimiter } from '../middleware/rate';
import { 
  createClaimedAccountSchema, 
  prepareAccountSchema
} from '../lib/validators';
import { claimAccount, createClaimedAccount, isAccountAvailable } from '../lib/hive';
import { 
  storeEmergencyKeys, 
  retrieveEmergencyKeys, 
  listStoredAccounts, 
  markKeysAsDelivered,
  printEmergencyInstructions 
} from '../lib/emergency-storage';
import {
  createAccountSession,
  getAccountSession,
  markSessionAsUsed,
  validateSessionKeys,
  getSessionStats,
  cleanupExpiredSessions
} from '../lib/session-storage';
import { generateAccountKeys } from '../lib/key-generation';
import { config } from '../config/env';

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
      
      // Check if this is a session-based creation (new 2-step process)
      if (validatedData.session_id && validatedData.confirmed) {
        // SESSION-BASED CREATION (NEW)
        const session = getAccountSession(validatedData.session_id);
        
        if (!session) {
          res.status(400).json({
            error: 'Invalid Session',
            message: 'Session not found or expired. Please generate keys again.',
          });
          return;
        }
        
        if (session.used) {
          res.status(400).json({
            error: 'Session Already Used',
            message: 'This session has already been used to create an account.',
          });
          return;
        }
        
        // Validate session matches the request
        if (session.username !== validatedData.new_account_name) {
          res.status(400).json({
            error: 'Session Mismatch',
            message: 'Account name does not match the prepared session.',
          });
          return;
        }
        
        // Extract public keys from authorities for validation
        const providedPubkeys = {
          owner: validatedData.owner.key_auths[0]?.[0] || '',
          active: validatedData.active.key_auths[0]?.[0] || '',
          posting: validatedData.posting.key_auths[0]?.[0] || '',
          memo: validatedData.memo_key,
        };
        
        // Validate that provided keys match session
        if (!validateSessionKeys(validatedData.session_id, providedPubkeys)) {
          res.status(400).json({
            error: 'Key Mismatch',
            message: 'Provided public keys do not match the prepared session.',
          });
          return;
        }
        
        // Mark session as used to prevent reuse
        if (!markSessionAsUsed(validatedData.session_id)) {
          res.status(400).json({
            error: 'Session Error',
            message: 'Failed to mark session as used. Session may be expired or already used.',
          });
          return;
        }
        
        req.log.info(
          { 
            sessionId: validatedData.session_id,
            accountName: validatedData.new_account_name 
          }, 
          'Session-based account creation validated - proceeding with blockchain creation'
        );
      } else {
        // DIRECT CREATION (EXISTING - for backward compatibility)
        
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
        
        req.log.info(
          { accountName: validatedData.new_account_name }, 
          'Direct account creation validated - proceeding with blockchain creation'
        );
      }
      
      // Broadcast create_claimed_account operation
      const txId = await createClaimedAccount(validatedData);
      
      // EMERGENCY SAFETY: Store keys temporarily for recovery
      // Extract private keys from the validated request for emergency storage
      const privateKeys = validatedData.private_keys;
      if (privateKeys?.owner && privateKeys.active && privateKeys.posting && privateKeys.memo) {
        try {
          storeEmergencyKeys(
            validatedData.new_account_name,
            txId,
            {
              owner: privateKeys.owner,
              active: privateKeys.active,
              posting: privateKeys.posting,
              memo: privateKeys.memo,
            },
            {
              owner: validatedData.owner.key_auths[0]?.[0] || '',
              active: validatedData.active.key_auths[0]?.[0] || '',
              posting: validatedData.posting.key_auths[0]?.[0] || '',
              memo: validatedData.memo_key,
            },
            {
              ip: req.ip,
              userAgent: req.headers['user-agent'],
              requestId: String(req.id),
            }
          );
        } catch (emergencyError) {
          // Log but don't fail the request
          req.log.warn({ emergencyError }, 'Failed to store emergency keys');
        }
      } else {
        req.log.warn(
          { accountName: validatedData.new_account_name }, 
          '⚠️  No private keys found in request - emergency storage skipped'
        );
      }
      
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

/**
 * POST /prepare-account
 * Generate keys for account creation (Step 1 of 2-step process)
 * Returns private keys and session ID for user approval
 */
router.post('/prepare-account', (req: Request, res: Response) => {
  void (async (): Promise<void> => {
    try {
      // Validate request body against schema
      const validatedData = prepareAccountSchema.parse(req.body);
      
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
      
      // Generate keys for the account
      const { keys, pubkeys } = generateAccountKeys(validatedData.new_account_name);
      
      // Create session for this preparation
      const session = createAccountSession(
        validatedData.new_account_name,
        pubkeys,
        validatedData.creator_account
      );
      
      // Store emergency keys immediately (before sending to frontend)
      try {
        storeEmergencyKeys(
          validatedData.new_account_name,
          `session-${session.sessionId}`, // Use session ID as temp transaction ID
          keys,
          pubkeys,
          {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            requestId: String(req.id),
          }
        );
      } catch (emergencyError) {
        // Log but don't fail the request
        req.log.warn({ emergencyError }, 'Failed to store emergency keys during preparation');
      }
      
      // Log successful preparation (never log private keys)
      req.log.info(
        { 
          sessionId: session.sessionId,
          accountName: validatedData.new_account_name,
          expiresAt: new Date(session.expiresAt).toISOString()
        }, 
        'Account preparation successful - keys generated and session created'
      );
      
      res.status(200).json({
        success: true,
        keys: {
          owner: keys.owner,
          active: keys.active,
          posting: keys.posting,
          memo: keys.memo,
          master_password: keys.master_password,
        },
        pubkeys: {
          owner: pubkeys.owner,
          active: pubkeys.active,
          posting: pubkeys.posting,
          memo: pubkeys.memo,
        },
        session_id: session.sessionId,
        expires_at: new Date(session.expiresAt).toISOString(),
        message: 'Keys generated successfully. Please save them securely before confirming account creation.',
      });
    } catch (error) {
      // Handle validation errors
      if (error instanceof z.ZodError) {
        req.log.warn({ errors: error.errors }, 'Account preparation validation failed');
        
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
      
      // Handle other errors
      req.log.error({ error }, 'Failed to prepare account');
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to prepare account for creation',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })();
});

/**
 * GET /session-stats
 * Get session statistics (admin only - development mode)
 * SECURITY: Only works in development mode
 */
router.get('/session-stats', (req: Request, res: Response) => {
  // Only allow in development mode
  if (config.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  try {
    const stats = getSessionStats();
    const cleanedUp = cleanupExpiredSessions();
    
    req.log.info({ stats, cleanedUp }, 'Session statistics requested');
    
    res.status(200).json({
      success: true,
      stats,
      cleaned_expired_sessions: cleanedUp,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    req.log.error({ error }, 'Failed to get session statistics');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve session statistics',
    });
  }
});

/**
 * GET /emergency-recovery/list
 * List all stored emergency keys (admin only - development mode)
 * SECURITY: Only works in development mode
 */
router.get('/emergency-recovery/list', (req: Request, res: Response) => {
  // Only allow in development mode
  if (config.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  try {
    const accounts = listStoredAccounts();
    
    req.log.info({ count: accounts.length }, 'Listed stored emergency accounts');
    
    res.status(200).json({
      success: true,
      count: accounts.length,
      accounts: accounts.map(acc => ({
        accountName: acc.accountName,
        transactionId: acc.transactionId,
        timestamp: acc.timestamp,
        ageHours: acc.ageHours,
        status: acc.status,
        expired: acc.ageHours > 72,
      })),
      warning: 'These are emergency backup keys. Clean up delivered keys regularly.',
    });
  } catch (error) {
    req.log.error({ error }, 'Failed to list emergency accounts');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve emergency accounts',
    });
  }
});

/**
 * GET /emergency-recovery/:accountName
 * Retrieve emergency keys for a specific account (admin only - development mode)
 * SECURITY: Only works in development mode
 */
router.get('/emergency-recovery/:accountName', (req: Request, res: Response) => {
  // Only allow in development mode
  if (config.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  try {
    const { accountName } = req.params;
    
    if (!accountName) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Account name is required',
      });
      return;
    }
    
    const keyData = retrieveEmergencyKeys(accountName);
    
    if (!keyData) {
      res.status(404).json({
        error: 'Not Found',
        message: `No emergency keys found for account: ${accountName}`,
      });
      return;
    }

    req.log.warn(
      { accountName, transactionId: keyData.transactionId }, 
      'Emergency keys retrieved - SENSITIVE OPERATION'
    );
    
    const ageHours = (Date.now() - keyData.createdAt) / (1000 * 60 * 60);
    
    res.status(200).json({
      success: true,
      accountName: keyData.accountName,
      transactionId: keyData.transactionId,
      timestamp: keyData.timestamp,
      ageHours: Math.round(ageHours * 10) / 10,
      status: keyData.status,
      expired: ageHours > 72,
      keys: keyData.keys,
      publicKeys: keyData.publicKeys,
      requestInfo: keyData.requestInfo,
      warning: 'SENSITIVE: These are private keys. Handle with extreme care.',
    });
  } catch (error) {
    req.log.error({ error }, 'Failed to retrieve emergency keys');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve emergency keys',
    });
  }
});

/**
 * POST /emergency-recovery/:accountName/mark-delivered
 * Mark keys as delivered (admin only - development mode)
 * SECURITY: Only works in development mode
 */
router.post('/emergency-recovery/:accountName/mark-delivered', (req: Request, res: Response) => {
  // Only allow in development mode
  if (config.NODE_ENV === 'production') {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  try {
    const { accountName } = req.params;
    const { transactionId } = req.body;
    
    if (!accountName) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Account name is required',
      });
      return;
    }
    
    if (!transactionId) {
      res.status(400).json({
        error: 'Validation Error',
        message: 'Transaction ID is required',
      });
      return;
    }

    markKeysAsDelivered(accountName, transactionId);
    
    req.log.info(
      { accountName, transactionId }, 
      'Emergency keys marked as delivered'
    );
    
    res.status(200).json({
      success: true,
      message: `Keys for ${accountName} marked as delivered`,
      reminder: 'Remember to manually clean up the key file when no longer needed',
    });
  } catch (error) {
    req.log.error({ error }, 'Failed to mark keys as delivered');
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to mark keys as delivered',
    });
  }
});

// Print emergency instructions on startup (development only)
if (config.NODE_ENV === 'development') {
  printEmergencyInstructions();
}

export default router;

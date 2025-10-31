import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { config } from '../config/env';

/**
 * Emergency key storage for account creation safety
 * CRITICAL: These files must NEVER be committed to git
 * Used only for temporary storage in case frontend fails to receive keys
 */

const EMERGENCY_DIR = join(process.cwd(), 'emergency-recovery');
const MAX_AGE_HOURS = 72; // Keep keys for 72 hours then manual cleanup required

interface StoredAccountKeys {
  accountName: string;
  transactionId: string;
  timestamp: string;
  createdAt: number;
  keys: {
    owner: string;
    active: string;
    posting: string;
    memo: string;
  };
  publicKeys: {
    owner: string;
    active: string;
    posting: string;
    memo: string;
  };
  requestInfo: {
    ip?: string;
    userAgent?: string;
    requestId?: string;
  };
  status: 'created' | 'delivered' | 'expired';
}

/**
 * Ensure emergency recovery directory exists
 */
function ensureEmergencyDir(): void {
  if (!existsSync(EMERGENCY_DIR)) {
    mkdirSync(EMERGENCY_DIR, { recursive: true, mode: 0o700 }); // Only owner can read/write
  }
}

/**
 * Store account keys temporarily for emergency recovery
 * SECURITY: Only call this AFTER successful blockchain creation
 */
export function storeEmergencyKeys(
  accountName: string,
  transactionId: string,
  keys: {
    owner: string;
    active: string;
    posting: string;
    memo: string;
  },
  publicKeys: {
    owner: string;
    active: string;
    posting: string;
    memo: string;
  },
  requestInfo?: {
    ip?: string;
    userAgent?: string;
    requestId?: string;
  }
): void {
  try {
    ensureEmergencyDir();

    const accountData: StoredAccountKeys = {
      accountName,
      transactionId,
      timestamp: new Date().toISOString(),
      createdAt: Date.now(),
      keys,
      publicKeys,
      requestInfo: requestInfo || {},
      status: 'created',
    };

    // Use timestamp + account name for unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${timestamp}-${accountName}-keys.json`;
    const filepath = join(EMERGENCY_DIR, filename);

    // Write with restricted permissions
    writeFileSync(filepath, JSON.stringify(accountData, null, 2), { 
      mode: 0o600 // Only owner can read/write
    });

    console.warn(`🚨 EMERGENCY KEYS STORED: ${filepath}`);
    console.warn('⚠️  REMEMBER: Clean up this file after keys are safely delivered!');
    console.warn(`📋 Account: ${accountName}, Transaction: ${transactionId}`);
    
  } catch (error) {
    console.error('❌ FAILED to store emergency keys:', error);
    // Don't throw - we don't want to fail account creation if emergency storage fails
  }
}

/**
 * Retrieve stored keys for an account (for emergency recovery)
 */
export function retrieveEmergencyKeys(accountName: string): StoredAccountKeys | null {
  try {
    if (!existsSync(EMERGENCY_DIR)) {
      return null;
    }

    const files = require('fs').readdirSync(EMERGENCY_DIR);
    
    // Find the most recent file for this account
    const accountFiles = files
      .filter((file: string) => file.includes(`-${accountName}-keys.json`))
      .sort()
      .reverse(); // Most recent first

    if (accountFiles.length === 0) {
      return null;
    }

    const filepath = join(EMERGENCY_DIR, accountFiles[0]);
    const data = JSON.parse(readFileSync(filepath, 'utf8')) as StoredAccountKeys;

    // Check if expired
    const ageHours = (Date.now() - data.createdAt) / (1000 * 60 * 60);
    if (ageHours > MAX_AGE_HOURS) {
      console.warn(`⚠️  Keys for ${accountName} are ${ageHours.toFixed(1)} hours old (expired)`);
    }

    return data;
  } catch (error) {
    console.error('❌ Failed to retrieve emergency keys:', error);
    return null;
  }
}

/**
 * Mark keys as delivered (but don't delete yet - manual cleanup required)
 */
export function markKeysAsDelivered(accountName: string, transactionId: string): void {
  try {
    const keyData = retrieveEmergencyKeys(accountName);
    if (keyData && keyData.transactionId === transactionId) {
      keyData.status = 'delivered';
      
      const timestamp = new Date(keyData.timestamp).toISOString().replace(/[:.]/g, '-');
      const filename = `${timestamp}-${accountName}-keys.json`;
      const filepath = join(EMERGENCY_DIR, filename);
      
      writeFileSync(filepath, JSON.stringify(keyData, null, 2), { mode: 0o600 });
      console.log(`✅ Keys marked as delivered for ${accountName}`);
    }
  } catch (error) {
    console.error('❌ Failed to mark keys as delivered:', error);
  }
}

/**
 * List all stored accounts (for admin purposes)
 */
export function listStoredAccounts(): Array<{
  accountName: string;
  transactionId: string;
  timestamp: string;
  ageHours: number;
  status: string;
  filename: string;
}> {
  try {
    if (!existsSync(EMERGENCY_DIR)) {
      return [];
    }

    const files = require('fs').readdirSync(EMERGENCY_DIR);
    
    return files
      .filter((file: string) => file.endsWith('-keys.json'))
      .map((file: string) => {
        try {
          const filepath = join(EMERGENCY_DIR, file);
          const data = JSON.parse(readFileSync(filepath, 'utf8')) as StoredAccountKeys;
          const ageHours = (Date.now() - data.createdAt) / (1000 * 60 * 60);
          
          return {
            accountName: data.accountName,
            transactionId: data.transactionId,
            timestamp: data.timestamp,
            ageHours: Math.round(ageHours * 10) / 10,
            status: data.status,
            filename: file,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b!.timestamp.localeCompare(a!.timestamp)) as Array<{
        accountName: string;
        transactionId: string;
        timestamp: string;
        ageHours: number;
        status: string;
        filename: string;
      }>;
  } catch (error) {
    console.error('❌ Failed to list stored accounts:', error);
    return [];
  }
}

/**
 * WARNING: Only for development - prints emergency recovery instructions
 */
export function printEmergencyInstructions(): void {
  if (config.NODE_ENV === 'production') {
    return; // Never print in production
  }

  console.log('\n🚨 EMERGENCY KEY RECOVERY SYSTEM ACTIVE');
  console.log('📁 Emergency keys stored in: ./emergency-recovery/');
  console.log('⏰ Keys are kept for 72 hours');
  console.log('🔒 Files have restricted permissions (600)');
  console.log('⚠️  NEVER commit these files to git!');
  console.log('🧹 Manually clean up delivered keys regularly');
  console.log('📋 Use listStoredAccounts() to see all stored keys\n');
}
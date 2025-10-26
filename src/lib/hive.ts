import { Client, PrivateKey, Operation } from '@hiveio/dhive';
import { config } from '../config/env';
import type { CreateClaimedAccountRequest } from './validators';

/**
 * Hive client instance
 * Configured to connect to the specified Hive node
 */
let client: Client | null = null;

/**
 * Get or create Hive client instance (singleton pattern)
 * @returns Configured Hive client
 */
export function getHiveClient(): Client {
  if (!client) {
    client = new Client(config.HIVE_NODE_URL, {
      timeout: 10000,
      failoverThreshold: 5,
      consoleOnFailover: false,
    });
  }
  return client;
}

/**
 * Private key instance for signing operations
 * Kept in memory only, never logged or persisted
 */
let creatorActiveKey: PrivateKey | null = null;

/**
 * Get or create the creator's active private key
 * SECURITY: This key is kept in memory only and never logged
 * @returns PrivateKey instance for signing operations
 */
export function getCreatorActiveKey(): PrivateKey {
  if (!creatorActiveKey) {
    creatorActiveKey = PrivateKey.fromString(config.HIVE_CREATOR_ACTIVE_WIF);
  }
  return creatorActiveKey;
}

/**
 * Broadcast a claim_account operation
 * This operation claims an account creation credit using RC (Resource Credits)
 * @returns Transaction ID
 */
export async function claimAccount(): Promise<string> {
  const client = getHiveClient();
  const key = getCreatorActiveKey();
  
  const operation: Operation = [
    'claim_account',
    {
      creator: config.HIVE_CREATOR,
      fee: '0.000 HIVE', // Using RC instead of HIVE
      extensions: [],
    },
  ];

  const result = await client.broadcast.sendOperations([operation], key);
  return result.id;
}

/**
 * Broadcast a create_claimed_account operation
 * Creates a new account using a previously claimed account credit
 * @param params Account creation parameters
 * @returns Transaction ID
 */
export async function createClaimedAccount(
  params: CreateClaimedAccountRequest
): Promise<string> {
  const client = getHiveClient();
  const key = getCreatorActiveKey();
  
  const operation: Operation = [
    'create_claimed_account',
    {
      creator: config.HIVE_CREATOR,
      new_account_name: params.new_account_name,
      owner: params.owner,
      active: params.active,
      posting: params.posting,
      memo_key: params.memo_key,
      json_metadata: params.json_metadata,
      extensions: [],
    },
  ];

  const result = await client.broadcast.sendOperations([operation], key);
  return result.id;
}

/**
 * Check if an account name is available
 * @param accountName Account name to check
 * @returns true if available, false if taken
 */
export async function isAccountAvailable(accountName: string): Promise<boolean> {
  const client = getHiveClient();
  
  try {
    const accounts = await client.database.getAccounts([accountName]);
    return accounts.length === 0;
  } catch {
    // If there's an error checking, assume unavailable for safety
    return false;
  }
}

import { PrivateKey } from '@hiveio/dhive';
import { randomBytes, createHash } from 'crypto';

/**
 * Key generation utilities for account preparation
 * Generates secure keys from master password
 */

export interface GeneratedKeys {
    owner: string;
    active: string;
    posting: string;
    memo: string;
    master_password: string;
}

export interface GeneratedPubKeys {
    owner: string;
    active: string;
    posting: string;
    memo: string;
}

/**
 * Generate a secure master password
 */
function generateMasterPassword(): string {
    // Generate a secure random string for master password
    const randomData = randomBytes(32);
    return `P${randomData.toString('hex').substring(0, 50)}`; // P + 50 hex chars
}

/**
 * Derive a private key from master password and role
 */
function derivePrivateKey(masterPassword: string, username: string, role: string): PrivateKey {
    // Create a deterministic seed from master password, username, and role
    const seed = `${masterPassword}${username}${role}`;

    // Generate private key from seed
    // Note: In production, you might want to use a more sophisticated key derivation
    const hash = createHash('sha256').update(seed).digest('hex');
    return PrivateKey.fromSeed(hash);
}

/**
 * Generate all account keys from a master password
 */
export function generateAccountKeys(username: string, masterPassword?: string): {
    keys: GeneratedKeys;
    pubkeys: GeneratedPubKeys;
} {
    // Use provided master password or generate a new one
    const master = masterPassword || generateMasterPassword();

    // Generate private keys for each role
    const ownerKey = derivePrivateKey(master, username, 'owner');
    const activeKey = derivePrivateKey(master, username, 'active');
    const postingKey = derivePrivateKey(master, username, 'posting');
    const memoKey = derivePrivateKey(master, username, 'memo');

    // Extract private key strings (WIF format)
    const keys: GeneratedKeys = {
        owner: ownerKey.toString(),
        active: activeKey.toString(),
        posting: postingKey.toString(),
        memo: memoKey.toString(),
        master_password: master,
    };

    // Extract public key strings
    const pubkeys: GeneratedPubKeys = {
        owner: ownerKey.createPublic().toString(),
        active: activeKey.createPublic().toString(),
        posting: postingKey.createPublic().toString(),
        memo: memoKey.createPublic().toString(),
    };

    return { keys, pubkeys };
}

/**
 * Validate that a master password can generate the expected keys
 */
export function validateMasterPassword(
    username: string,
    masterPassword: string,
    expectedPubkeys: GeneratedPubKeys
): boolean {
    try {
        const { pubkeys } = generateAccountKeys(username, masterPassword);

        return (
            pubkeys.owner === expectedPubkeys.owner &&
            pubkeys.active === expectedPubkeys.active &&
            pubkeys.posting === expectedPubkeys.posting &&
            pubkeys.memo === expectedPubkeys.memo
        );
    } catch {
        return false;
    }
}

/**
 * Convert public keys to Hive authority format
 */
export function createAuthority(publicKey: string, weight: number = 1): {
    weight_threshold: number;
    account_auths: Array<[string, number]>;
    key_auths: Array<[string, number]>;
} {
    return {
        weight_threshold: 1,
        account_auths: [],
        key_auths: [[publicKey, weight]],
    };
}
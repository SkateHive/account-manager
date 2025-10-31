import { randomUUID } from 'crypto';

/**
 * Session storage for account preparation
 * Stores temporary session data for 2-step account creation
 */

export interface AccountSession {
    sessionId: string;
    username: string;
    pubkeys: {
        owner: string;
        active: string;
        posting: string;
        memo: string;
    };
    createdAt: number;
    expiresAt: number;
    used: boolean;
    creatorAccount: string;
}

/**
 * In-memory session storage
 * TODO: Replace with Redis in production for multi-instance support
 */
const sessions = new Map<string, AccountSession>();

/**
 * Session expiration time (15 minutes)
 */
const SESSION_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Create a new account preparation session
 */
export function createAccountSession(
    username: string,
    pubkeys: {
        owner: string;
        active: string;
        posting: string;
        memo: string;
    },
    creatorAccount: string = 'skatehive'
): AccountSession {
    const sessionId = randomUUID();
    const now = Date.now();

    const session: AccountSession = {
        sessionId,
        username,
        pubkeys,
        createdAt: now,
        expiresAt: now + SESSION_EXPIRY_MS,
        used: false,
        creatorAccount,
    };

    sessions.set(sessionId, session);

    // Schedule cleanup
    setTimeout(() => {
        sessions.delete(sessionId);
    }, SESSION_EXPIRY_MS + 60000); // Extra minute buffer for cleanup

    return session;
}

/**
 * Retrieve and validate a session
 */
export function getAccountSession(sessionId: string): AccountSession | null {
    const session = sessions.get(sessionId);

    if (!session) {
        return null;
    }

    // Check if expired
    if (Date.now() > session.expiresAt) {
        sessions.delete(sessionId);
        return null;
    }

    return session;
}

/**
 * Mark a session as used (prevents reuse)
 */
export function markSessionAsUsed(sessionId: string): boolean {
    const session = sessions.get(sessionId);

    if (!session || session.used || Date.now() > session.expiresAt) {
        return false;
    }

    session.used = true;
    sessions.set(sessionId, session);

    // Clean up used session after 1 hour (for audit purposes)
    setTimeout(() => {
        sessions.delete(sessionId);
    }, 60 * 60 * 1000); // 1 hour

    return true;
}

/**
 * Validate that provided public keys match the session
 */
export function validateSessionKeys(
    sessionId: string,
    providedPubkeys: {
        owner: string;
        active: string;
        posting: string;
        memo: string;
    }
): boolean {
    const session = getAccountSession(sessionId);

    if (!session) {
        return false;
    }

    return (
        session.pubkeys.owner === providedPubkeys.owner &&
        session.pubkeys.active === providedPubkeys.active &&
        session.pubkeys.posting === providedPubkeys.posting &&
        session.pubkeys.memo === providedPubkeys.memo
    );
}

/**
 * Get session statistics (for monitoring)
 */
export function getSessionStats(): {
    totalSessions: number;
    activeSessions: number;
    usedSessions: number;
    expiredSessions: number;
} {
    const now = Date.now();
    let activeSessions = 0;
    let usedSessions = 0;
    let expiredSessions = 0;

    for (const session of sessions.values()) {
        if (now > session.expiresAt) {
            expiredSessions++;
        } else if (session.used) {
            usedSessions++;
        } else {
            activeSessions++;
        }
    }

    return {
        totalSessions: sessions.size,
        activeSessions,
        usedSessions,
        expiredSessions,
    };
}

/**
 * Clean up expired sessions (call periodically)
 */
export function cleanupExpiredSessions(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of sessions.entries()) {
        if (now > session.expiresAt) {
            sessions.delete(sessionId);
            cleanedCount++;
        }
    }

    return cleanedCount;
}

/**
 * List all sessions (for debugging - development only)
 */
export function listAllSessions(): AccountSession[] {
    return Array.from(sessions.values());
}
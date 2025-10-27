import { z } from 'zod';

/**
 * Validate Hive account name format
 * Must be 3-16 characters, lowercase letters, numbers, and hyphens
 * Cannot start or end with a hyphen
 */
export const accountNameSchema = z
  .string()
  .min(3, 'Account name must be at least 3 characters')
  .max(16, 'Account name must be at most 16 characters')
  .regex(/^[a-z]/, 'Account name must start with a lowercase letter')
  .regex(/^[a-z][a-z0-9-]*[a-z0-9]$/, 'Account name can only contain lowercase letters, numbers, and hyphens')
  .refine((name) => !name.includes('--'), 'Account name cannot contain consecutive hyphens');

/**
 * Validate Hive public key format (STM prefix)
 */
export const publicKeySchema = z
  .string()
  .regex(/^STM[1-9A-HJ-NP-Za-km-z]{50}$/, 'Invalid Hive public key format');

/**
 * Authority object schema for Hive accounts
 * Defines weight thresholds and key/account authorities
 */
export const authoritySchema = z.object({
  weight_threshold: z.number().int().positive().default(1),
  account_auths: z.array(z.tuple([z.string(), z.number()])).default([]),
  key_auths: z.array(z.tuple([z.string(), z.number()])),
});

/**
 * Request body schema for creating a claimed account
 * Validates all required fields for account creation
 */
export const createClaimedAccountSchema = z.object({
  new_account_name: accountNameSchema,
  owner: authoritySchema,
  active: authoritySchema,
  posting: authoritySchema,
  memo_key: publicKeySchema,
  json_metadata: z.string().optional().default('{}'),
});

/**
 * Type definitions for validated data
 */
export type AccountName = z.infer<typeof accountNameSchema>;
export type PublicKey = z.infer<typeof publicKeySchema>;
export type Authority = z.infer<typeof authoritySchema>;
export type CreateClaimedAccountRequest = z.infer<typeof createClaimedAccountSchema>;

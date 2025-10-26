import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Environment variable schema with strict validation
 * Ensures all required configuration is present and valid
 */
const envSchema = z.object({
  // Hive blockchain configuration
  HIVE_NODE_URL: z.string().url().default('https://api.hive.blog'),
  HIVE_CREATOR: z.string().min(3).max(16),
  HIVE_CREATOR_ACTIVE_WIF: z.string().min(51).max(51), // Hive WIF format
  
  // Service security
  SIGNER_TOKEN: z.string().min(32),
  
  // Server configuration
  PORT: z.string().transform(Number).pipe(z.number().int().positive()).default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

/**
 * Parse and validate environment variables
 * Throws an error if validation fails
 */
function validateEnv(): z.infer<typeof envSchema> {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Environment validation failed:\n${missingVars.join('\n')}`);
    }
    throw error;
  }
}

/**
 * Validated configuration object
 * All values are guaranteed to be present and valid
 */
export const config = validateEnv();

/**
 * Type-safe configuration interface
 */
export type Config = z.infer<typeof envSchema>;

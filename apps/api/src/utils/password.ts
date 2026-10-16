import { hash, verify, Algorithm } from '@node-rs/argon2';

/**
 * Calibrated Argon2id parameters adhering to OWASP guidelines:
 * - Algorithm: Argon2id (variant 2)
 * - Memory cost: 19456 KiB (~19 MB) for balance between high security and fast local execution
 * - Time cost: 2 iterations
 * - Parallelism: 1 thread
 */
export async function hashPassword(plainText: string): Promise<string> {
  return hash(plainText, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(passwordHash: string, plainText: string): Promise<boolean> {
  try {
    return await verify(passwordHash, plainText);
  } catch (error) {
    return false;
  }
}

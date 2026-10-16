import { hash, verify, Algorithm } from '@node-rs/argon2';

export async function hashPassword(plainText: string): Promise<string> {
  return hash(plainText, {
    algorithm: 2, // Algorithm.Argon2id
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

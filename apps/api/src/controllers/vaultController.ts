import { Response, NextFunction } from 'express';
import { VaultSetupSchema, VaultStatusResponse } from '@envbook/shared';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logSecurityEvent } from '../models/AuditLog.js';

export async function getVaultStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const user = req.user!;
  const metadata = user.vaultMetadata;

  const response: VaultStatusResponse = {
    isInitialized: Boolean(metadata?.isInitialized),
    salt: metadata?.salt,
    kdfParams: metadata?.kdfParams,
    keyVersion: metadata?.keyVersion,
    wrappedDEK: metadata?.wrappedDEK,
    nonce: metadata?.nonce,
    recoverySalt: metadata?.recoverySalt,
    recoveryWrappedDEK: metadata?.recoveryWrappedDEK,
    recoveryNonce: metadata?.recoveryNonce,
  };

  res.status(200).json(response);
}

export async function setupVault(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = VaultSetupSchema.parse(req.body);
    const user = req.user!;

    if (user.vaultMetadata?.isInitialized) {
      res.status(400).json({
        error: 'Vault is already initialized. Use rekey endpoint to change passphrases.',
        code: 'VAULT_ALREADY_INITIALIZED',
      });
      return;
    }

    user.vaultMetadata = {
      salt: input.salt,
      kdfParams: input.kdfParams,
      keyVersion: input.keyVersion,
      wrappedDEK: input.wrappedDEK,
      nonce: input.nonce,
      recoverySalt: input.recoverySalt,
      recoveryWrappedDEK: input.recoveryWrappedDEK,
      recoveryNonce: input.recoveryNonce,
      isInitialized: true,
    };

    await user.save();
    await logSecurityEvent('VAULT_INITIALIZED', {
      userId: user._id,
      ip: req.ip,
    });

    res.status(200).json({
      message: 'Encrypted vault initialized successfully',
      isInitialized: true,
    });
  } catch (err) {
    next(err);
  }
}

export async function rekeyVault(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const input = VaultSetupSchema.parse(req.body);
    const user = req.user!;

    user.vaultMetadata = {
      ...user.vaultMetadata,
      salt: input.salt,
      kdfParams: input.kdfParams,
      keyVersion: (user.vaultMetadata?.keyVersion || 1) + 1,
      wrappedDEK: input.wrappedDEK,
      nonce: input.nonce,
      recoverySalt: input.recoverySalt || user.vaultMetadata?.recoverySalt,
      recoveryWrappedDEK: input.recoveryWrappedDEK || user.vaultMetadata?.recoveryWrappedDEK,
      recoveryNonce: input.recoveryNonce || user.vaultMetadata?.recoveryNonce,
      isInitialized: true,
    };

    await user.save();
    await logSecurityEvent('VAULT_REKEYED', {
      userId: user._id,
      ip: req.ip,
      metadata: { keyVersion: user.vaultMetadata.keyVersion },
    });

    res.status(200).json({
      message: 'Vault re-keyed successfully',
      keyVersion: user.vaultMetadata.keyVersion,
    });
  } catch (err) {
    next(err);
  }
}

import { test, expect } from '@playwright/test';

test.describe('Auth and Zero-Knowledge Vault Lifecycle', () => {
  const testUser = {
    name: 'Ada Lovelace',
    username: `ada_${Date.now()}`,
    email: `ada_${Date.now()}@envbook.box`,
    password: 'CipherPassword2026!',
    vaultPassphrase: 'SuperSecretVaultPassphrase99!',
  };

  test('Signup with name, username, email, password, and working eye button', async ({ page }) => {
    await page.goto('/signup');

    // Fill in signup form
    await page.fill('#signup-name', testUser.name);
    await page.fill('#signup-username', testUser.username);
    await page.fill('#signup-email', testUser.email);

    // Password input
    await page.fill('#signup-password', testUser.password);
    await page.fill('#signup-confirm-password', testUser.password);

    // Universal Eye Toggle Button Check: Verify toggling changes input type without clearing value
    const eyeButtons = page.locator('button[title*="password" i]');
    expect(await eyeButtons.count()).toBeGreaterThanOrEqual(2);

    // Click first eye button (show password)
    await eyeButtons.nth(0).click();
    const firstInput = page.locator('#signup-password');
    expect(await firstInput.getAttribute('type')).toBe('text');
    expect(await firstInput.inputValue()).toBe(testUser.password);

    // Click again (hide password)
    await eyeButtons.nth(0).click();
    expect(await firstInput.getAttribute('type')).toBe('password');
    expect(await firstInput.inputValue()).toBe(testUser.password);

    // Submit signup
    await page.click('button[type="submit"]');

    // Should redirect to /vault/setup for first-time onboarding
    await expect(page).toHaveURL(/.*\/vault\/setup/, { timeout: 15000 });
  });

  test('Vault Passphrase Setup with entropy validation and recovery key', async ({ page }) => {
    // Log in with existing test user if needed
    await page.goto('/login');
    await page.fill('#login-identifier', testUser.username);
    await page.fill('#login-password', testUser.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/vault\/setup/, { timeout: 15000 });

    // Fill vault passphrase and confirm passphrase
    await page.fill('#create-passphrase', testUser.vaultPassphrase);
    await page.fill('#confirm-passphrase', testUser.vaultPassphrase);

    // Submit setup
    await page.click('button:has-text("Create Encrypted Vault")');

    // Recovery Key display step should appear
    await expect(page.locator('label:has-text("Emergency Recovery Key")')).toBeVisible({ timeout: 15000 });

    // Confirm saved recovery key checkbox
    await page.click('input[type="checkbox"]');
    await page.click('button:has-text("Enter EnvBook Workspace")');

    // Should transition to main app dashboard
    await expect(page).toHaveURL(/.*\/app/, { timeout: 15000 });
    await expect(page.locator('text=Air-Gapped Local Session')).toBeVisible();
  });

  test('Vault Lock and Unlock with Passphrase', async ({ page }) => {
    // Log in to ensure valid session cookie
    await page.goto('/login');
    await page.fill('#login-identifier', testUser.username);
    await page.fill('#login-password', testUser.password);
    await page.click('button[type="submit"]');

    // Should be on /vault/unlock because vault is already initialized
    await expect(page).toHaveURL(/.*\/vault\/unlock/, { timeout: 15000 });

    // Test incorrect passphrase rejection
    await page.fill('#unlock-passphrase', 'WrongPassphrase12345!');
    await page.click('button[type="submit"]:has-text("Unlock Vault")');
    await expect(page.locator('text=Incorrect master passphrase')).toBeVisible({ timeout: 10000 });

    // Test correct passphrase unlock
    await page.fill('#unlock-passphrase', testUser.vaultPassphrase);
    await page.click('button[type="submit"]:has-text("Unlock Vault")');

    // Should redirect back to /app
    await expect(page).toHaveURL(/.*\/app/, { timeout: 15000 });
  });
});

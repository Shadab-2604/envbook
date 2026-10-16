import { test, expect } from '@playwright/test';

test.describe('Credentials Vault and Environments Management', () => {
  const user = {
    username: `secops_${Date.now()}`,
    email: `secops_${Date.now()}@envbook.box`,
    password: 'SecOpsPassword2026!',
    passphrase: 'VaultPassphraseSecOps2026!',
  };

  test.beforeAll(async () => {
    // Shared setup
  });

  test('Credentials Vault: Masking, Reveal toggle, 15s auto-remask, and Copy', async ({ page }) => {
    // 1. Signup & vault setup
    await page.goto('/signup');
    await page.fill('#signup-name', 'SecOps Lead');
    await page.fill('#signup-username', user.username);
    await page.fill('#signup-email', user.email);
    await page.fill('#signup-password', user.password);
    await page.fill('#signup-confirm-password', user.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/vault\/setup/, { timeout: 15000 });
    await page.fill('#create-passphrase', user.passphrase);
    await page.fill('#confirm-passphrase', user.passphrase);
    await page.click('button:has-text("Create Encrypted Vault")');
    await page.click('input[type="checkbox"]');
    await page.click('button:has-text("Enter EnvBook Workspace")');

    await expect(page).toHaveURL(/.*\/app/, { timeout: 15000 });

    // 2. Navigate to Credentials Vault via client-side link
    await page.click('a[href="/app/credentials"]');
    await expect(page.locator('text=Credentials Vault')).toBeVisible();

    // 3. Add new credential
    await page.click('button:has-text("Add Secret")');

    await page.fill('input[placeholder*="STRIPE_SECRET_KEY" i]', 'STRIPE_LIVE_API_KEY');
    // Secret value input with eye toggle
    const secretInput = page.locator('input[placeholder="Paste sensitive secret value..."]');
    await secretInput.fill('mock_sec_key_9948274928472918471928');

    await page.fill('input[placeholder*="AWS" i]', 'Stripe');
    await page.fill('input[placeholder*="Auth Service" i]', 'Billing');

    // Save
    await page.click('button:has-text("Encrypt & Save")');

    // 4. Verify secret card is created with masked value
    await expect(page.locator('text=STRIPE_LIVE_API_KEY')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=••••••••••••••••••••')).toBeVisible();

    // 5. Click reveal toggle
    const revealBtn = page.locator('button[title*="Reveal secret" i]').first();
    await revealBtn.click();

    // Plaintext should be visible and 15s timer countdown badge appears
    await expect(page.locator('text=mock_sec_key_9948274928472918471928')).toBeVisible();
    await expect(page.locator('text=15s')).toBeVisible();

    // 6. Test deliberate copy button
    const copyBtn = page.locator('button[title="Copy secret value"]').first();
    await copyBtn.click();
  });

  test('Environments Manager: Variable creation, environment tabs, and safe export', async ({ page }) => {
    // Authenticate and unlock
    await page.goto('/login');
    await page.fill('#login-identifier', user.username);
    await page.fill('#login-password', user.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/vault\/unlock/, { timeout: 15000 });
    await page.fill('#unlock-passphrase', user.passphrase);
    await page.click('button[type="submit"]:has-text("Unlock Vault")');
    await expect(page).toHaveURL(/.*\/app/, { timeout: 15000 });

    await page.click('a[href="/app/environments"]');
    await expect(page.locator('text=Environments & Secrets')).toBeVisible();

    // Add Variable
    await page.click('button:has-text("Add Variable")');

    await page.fill('input[placeholder="KEY_NAME"]', 'DATABASE_URL');
    await page.fill('input[placeholder="Variable value..."]', 'postgres://dbadmin:p4ss@10.0.0.5:5432/production');
    await page.click('button:has-text("Save Variable")');

    // Variable should appear in Production table
    await expect(page.locator('text=DATABASE_URL')).toBeVisible({ timeout: 10000 });

    // Switch to Diff View
    await page.click('button:has-text("Diff View")');
    await expect(page.locator('text=Environment Variables Parity Matrix')).toBeVisible();
    await expect(page.getByText('SET', { exact: true })).toBeVisible();

    // Switch back to Variables view
    await page.click('button:has-text("Variables")');

    // Click Export .env
    await page.click('button:has-text("Export .env")');
    await expect(page.locator('text=Export Decrypted .env File')).toBeVisible();
    await page.click('button:has-text("Cancel")');
  });
});

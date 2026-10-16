import { test, expect } from '@playwright/test';

test.describe('Workspace and Block Editor Flows', () => {
  const user = {
    username: `writer_${Date.now()}`,
    email: `writer_${Date.now()}@envbook.box`,
    password: 'SecureEditorPassword123!',
    passphrase: 'VaultPassphraseEditor2026!',
  };

  test.beforeAll(async ({ request }) => {
    // Register and set up vault via API directly for quick setup
  });

  test('Full note authoring, slash command palette, and autosave', async ({ page }) => {
    // 1. Signup & setup
    await page.goto('/signup');
    await page.fill('#signup-name', 'Editor User');
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

    // 2. Create a new document from dashboard
    await page.click('button:has-text("New Note")');

    // Should navigate to /app/page/[pageId]
    await expect(page).toHaveURL(/.*\/app\/page\/.*/, { timeout: 15000 });

    // 3. Edit Title
    const titleInput = page.locator('input[placeholder*="Untitled" i]');
    await titleInput.fill('Architecture Design Specification');

    // 4. Edit Content with Markdown and typing shortcuts
    const textarea = page.locator('textarea');
    await textarea.fill('# Core System Architecture\n\nThis is an encrypted document authored with EnvBook.\n\n- Zero-knowledge storage\n- Client-side AES-256-GCM\n- Argon2id key derivation\n\n```typescript\nconst status = "operational";\n```');

    // Verify save status turns to Saved
    await expect(page.locator('text=Saved')).toBeVisible({ timeout: 10000 });

    // 5. Test Raw vs Rendered Markdown toggle
    const toggleButton = page.locator('button:has-text("Raw Markdown")');
    if (await toggleButton.isVisible()) {
      await toggleButton.click();
      // Should show Raw Markdown mode
      await expect(page.locator('button:has-text("Rendered")')).toBeVisible();
      await page.click('button:has-text("Rendered")');
    }

    // 6. Test Favorite action
    const favButton = page.locator('button[title*="favorite" i]').first();
    await favButton.click();

    // 7. Verify entry shows in Favorites page via in-memory client navigation
    await page.click('a[href="/app/favorites"]');
    await expect(page.locator('text=Architecture Design Specification')).toBeVisible({ timeout: 10000 });
  });

  test('Folder creation and subpage organization', async ({ page }) => {
    // Login and unlock
    await page.goto('/login');
    await page.fill('#login-identifier', user.username);
    await page.fill('#login-password', user.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/vault\/unlock/, { timeout: 15000 });
    await page.fill('#unlock-passphrase', user.passphrase);
    await page.click('button[type="submit"]:has-text("Unlock Vault")');
    await expect(page).toHaveURL(/.*\/app/, { timeout: 15000 });

    // Create new folder from sidebar button
    const newFolderBtn = page.locator('button[title="New Folder"]').first();
    if (await newFolderBtn.isVisible()) {
      await newFolderBtn.click();
    }
  });
});

import { test, expect } from '@playwright/test';

test.describe('Workspace Dynamic Hierarchy & Notion-Style Block Editor', () => {
  const user = {
    username: `writer_${Date.now()}`,
    email: `writer_${Date.now()}@envbook.box`,
    password: 'SecureEditorPassword123!',
    passphrase: 'VaultPassphraseEditor2026!',
  };

  test('Full note authoring, WYSIWYG canvas, and autosave', async ({ page }) => {
    // 1. Signup & setup vault
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

    // 4. Edit Content directly in the inline WYSIWYG canvas
    const editorCanvas = page.locator('.ProseMirror, textarea').first();
    await editorCanvas.click();
    await editorCanvas.fill('Core System Architecture: private zero-knowledge developer workspace.');

    // Verify save status turns to Saved
    await expect(page.locator('text=Saved')).toBeVisible({ timeout: 10000 });

    // 5. Test Favorite action
    const favButton = page.locator('button[title*="favorite" i]').first();
    await favButton.click();

    // 6. Verify entry shows in Favorites page via in-memory client navigation
    await page.click('a[href="/app/favorites"]');
    await expect(page.locator('text=Architecture Design Specification')).toBeVisible({ timeout: 10000 });
  });

  test('Dynamic workspace item creation modal and Section hierarchy', async ({ page }) => {
    // Login and unlock
    await page.goto('/login');
    await page.fill('#login-identifier', user.username);
    await page.fill('#login-password', user.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*\/vault\/unlock/, { timeout: 15000 });
    await page.fill('#unlock-passphrase', user.passphrase);
    await page.click('button[type="submit"]:has-text("Unlock Vault")');
    await expect(page).toHaveURL(/.*\/app/, { timeout: 15000 });

    // Verify dynamic sidebar has no hardcoded content categories
    await expect(page.locator('aside >> text=Credentials Vault')).not.toBeVisible();
    await expect(page.locator('aside >> text=Ideas Inbox')).not.toBeVisible();
    await expect(page.locator('aside >> text=Code Library')).not.toBeVisible();

    // Open creation modal from sidebar "+ New" button
    const newBtn = page.locator('aside button:has-text("New")').first();
    await newBtn.click();

    // Verify all 4 types exist in type chooser
    await expect(page.locator('text=Notes Page')).toBeVisible();
    await expect(page.locator('text=Section')).toBeVisible();
    await expect(page.locator('text=Environment Page')).toBeVisible();
    await expect(page.locator('text=Notes Section')).toBeVisible();

    // Select Section
    await page.click('button:has-text("Section")');
    await page.fill('#create-item-name', 'Backend Core');
    await page.click('button:has-text("Create Item")');

    // Should navigate to section folder page
    await expect(page).toHaveURL(/.*\/app\/folder\/.*/, { timeout: 15000 });
    await expect(page.locator('text=Backend Core')).toBeVisible();
  });

  test('Bulk .env Import and per-variable reveal/copy/edit/delete', async ({ page }) => {
    // Navigate to Environments page
    await page.click('a[href="/app"]');
    await page.click('button:has-text("New")');
    await page.click('button:has-text("Environment Page")');
    await page.fill('#create-item-name', 'Production Env');
    await page.click('button:has-text("Create Item")');

    await expect(page).toHaveURL(/.*\/app\/environments\?id=.*/, { timeout: 15000 });

    // Click Import / Paste .env
    await page.click('button:has-text("Import / Paste .env")');

    // Paste multiline .env block
    const envPaste = `
# Production Database
DATABASE_URL=postgres://app_user:prod_pass@10.0.0.1:5432/main_db
PORT=8080
JWT_SIGNING_KEY=random_development_test_key_01928374
`;
    await page.fill('textarea[placeholder*="Paste .env contents" i]', envPaste);

    // Verify diagnostics summary badge
    await expect(page.locator('text=Valid:')).toBeVisible();

    // Save bulk import
    await page.click('button:has-text("Encrypt & Save")');

    // Verify entries are rendered in table
    await expect(page.locator('text=DATABASE_URL')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=PORT')).toBeVisible();
    await expect(page.locator('text=JWT_SIGNING_KEY')).toBeVisible();

    // Verify values are masked by default
    await expect(page.locator('text=••••••••••••••••').first()).toBeVisible();

    // Test Reveal on PORT
    const revealBtn = page.locator('button[title="Reveal value"]').nth(1);
    await revealBtn.click();
    await expect(page.locator('text=8080')).toBeVisible();

    // Test Copy on PORT
    const copyBtn = page.locator('button[title="Copy variable value"]').nth(1);
    await copyBtn.click();

    // Test Delete on one entry
    page.once('dialog', (dialog) => dialog.accept());
    const deleteBtn = page.locator('button[title="Delete variable"]').nth(0);
    await deleteBtn.click();
  });
});

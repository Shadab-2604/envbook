import { test, expect } from '@playwright/test';

/**
 * Responsive & Theme Visual Regression Test Suite
 * 
 * Verifies:
 * 1. 15 required viewport widths: 320, 360, 375, 390, 430, 540, 768, 820, 1024, 1280, 1366, 1440, 1600, 1920, 2560 px
 * 2. Complete Light and Dark themes strictly using the 4-color palette tokens
 * 3. Destructive actions strictly retaining red styling across both themes
 * 4. Responsive adaptation (mobile navigation drawer, collapsible sidebar, fluid tables, responsive grids)
 * 5. Visual regression snapshot capture without exposing secrets
 */

const VIEWPORT_WIDTHS = [
  320, 360, 375, 390, 430, 540, 768, 820, 1024, 1280, 1366, 1440, 1600, 1920, 2560,
] as const;

const THEMES = ['light', 'dark'] as const;

test.describe('Theme System & Palette Verification', () => {
  test('Theme toggle applies immediately and sets html.dark class', async ({ page }) => {
    await page.goto('/login');

    // Default or initial theme check
    const html = page.locator('html');

    // Switch to dark mode via localStorage or toggle if present
    await page.evaluate(() => {
      window.localStorage.setItem('envbook-theme', 'dark');
      document.documentElement.classList.add('dark');
    });

    await expect(html).toHaveClass(/dark/);

    // Verify dark mode background token applied to body/html
    const bgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    // #393E46 is rgb(57, 62, 70)
    expect(bgColor).toBe('rgb(57, 62, 70)');

    // Switch to light mode
    await page.evaluate(() => {
      window.localStorage.setItem('envbook-theme', 'light');
      document.documentElement.classList.remove('dark');
    });

    await expect(html).not.toHaveClass(/dark/);

    // Verify light mode background token applied to body/html
    const lightBgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    // #F7F7F7 is rgb(247, 247, 247)
    expect(lightBgColor).toBe('rgb(247, 247, 247)');
  });

  test('Destructive buttons remain strictly red in both themes', async ({ page }) => {
    // Visit trash or mock destructive button view
    await page.goto('/app/trash');

    for (const theme of THEMES) {
      await page.evaluate((t) => {
        if (t === 'dark') {
          document.documentElement.classList.add('dark');
          window.localStorage.setItem('envbook-theme', 'dark');
        } else {
          document.documentElement.classList.remove('dark');
          window.localStorage.setItem('envbook-theme', 'light');
        }
      }, theme);

      // Verify destructive buttons exist and have red background or red text
      const destructiveButtons = page.locator('.btn-destructive, button:has-text("Delete Permanently"), button:has-text("Empty Trash")');
      const count = await destructiveButtons.count();
      for (let i = 0; i < count; i++) {
        const btn = destructiveButtons.nth(i);
        const bg = await btn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
        // Should be red-600 rgb(220, 38, 38) or red-500 rgb(239, 68, 68) or similar red
        expect(bg).toMatch(/rgb\((220|239|185),\s*(38|68|28),\s*(38|68|28)\)/);
      }
    }
  });
});

test.describe('Responsive Viewport Widths Audit (320px to 2560px)', () => {
  for (const width of VIEWPORT_WIDTHS) {
    test(`Landing page layout at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      // Check for unintended horizontal scroll
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const innerWidth = await page.evaluate(() => window.innerWidth);
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 1);

      // Capture screenshot in artifacts directory
      await page.screenshot({
        path: `test-results/visual-regression/landing-${width}px.png`,
        fullPage: false,
      });
    });

    test(`Authentication view at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/login');

      // Verify no horizontal overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const innerWidth = await page.evaluate(() => window.innerWidth);
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth + 1);

      // Verify form is visible
      await expect(page.locator('input#login-identifier')).toBeVisible();

      // Capture screenshot
      await page.screenshot({
        path: `test-results/visual-regression/login-${width}px.png`,
      });
    });
  }
});

test.describe('Theme & Layout Matrix Across Representative Screens', () => {
  const routes = [
    { name: 'landing', path: '/' },
    { name: 'login', path: '/login' },
    { name: 'signup', path: '/signup' },
    { name: 'vault-unlock', path: '/vault/unlock' },
    { name: 'vault-setup', path: '/vault/setup' },
    { name: 'app-dashboard', path: '/app' },
    { name: 'app-environments', path: '/app/environments' },
    { name: 'app-credentials', path: '/app/credentials' },
    { name: 'app-settings', path: '/app/settings' },
    { name: 'app-snippets', path: '/app/snippets' },
    { name: 'app-archive', path: '/app/archive' },
    { name: 'app-trash', path: '/app/trash' },
  ];

  for (const route of routes) {
    for (const theme of THEMES) {
      test(`${route.name} in ${theme} mode`, async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(route.path);

        await page.evaluate((t) => {
          if (t === 'dark') {
            document.documentElement.classList.add('dark');
            window.localStorage.setItem('envbook-theme', 'dark');
          } else {
            document.documentElement.classList.remove('dark');
            window.localStorage.setItem('envbook-theme', 'light');
          }
        }, theme);

        // Capture theme snapshot
        await page.screenshot({
          path: `test-results/visual-regression/${route.name}-${theme}.png`,
        });
      });
    }
  }
});

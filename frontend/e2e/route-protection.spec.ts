import { test, expect } from '@playwright/test';

test.describe('Route Protection', () => {
    test('unauthenticated user should be redirected to login from dashboard', async ({
        page,
    }) => {
        // Try to access dashboard without logging in
        await page.goto('/dashboard');

        // Should redirect to /login
        await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    });

    test('unauthenticated user should be redirected from wallets page', async ({
        page,
    }) => {
        await page.goto('/dashboard/wallets');
        await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    });

    test('unauthenticated user should be redirected from transfer page', async ({
        page,
    }) => {
        await page.goto('/dashboard/transfer');
        await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    });

    test('home page should be accessible without authentication', async ({
        page,
    }) => {
        await page.goto('/');

        // Should NOT redirect — home page is public
        await expect(page).toHaveURL('/');
        await expect(
            page.getByText('Select a tenant to view their isolated dashboard'),
        ).toBeVisible({ timeout: 10000 });
    });

    test('login page should be accessible without authentication', async ({
        page,
    }) => {
        await page.goto('/login?tenant=bank1');

        // Should NOT redirect — login page is public
        await expect(page).toHaveURL(/\/login/);
        await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    });
});

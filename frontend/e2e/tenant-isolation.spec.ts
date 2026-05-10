import { test, expect } from '@playwright/test';

test.describe('Tenant Data Isolation', () => {
    test('bank1 admin can login and see their dashboard', async ({ page }) => {
        await page.goto('/login?tenant=bank1');

        // Wait for the login page to fully load
        await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();

        // Fill credentials and login
        await page.getByLabel('Email Address').fill('admin@bank1.com');
        await page.getByLabel('Password').fill('password123');
        await page.getByRole('button', { name: 'Sign In' }).click();

        // Should land on dashboard
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
        await expect(page.getByText('Create New Payment')).toBeVisible({
            timeout: 10000,
        });
    });

    test('hdfc admin can login and see their own dashboard', async ({ page }) => {
        await page.goto('/login?tenant=hdfc');

        await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();

        await page.getByLabel('Email Address').fill('admin@hdfc.com');
        await page.getByLabel('Password').fill('password123');
        await page.getByRole('button', { name: 'Sign In' }).click();

        await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
        await expect(page.getByText('Create New Payment')).toBeVisible({
            timeout: 10000,
        });
    });

    test('invalid credentials should show error', async ({ page }) => {
        await page.goto('/login?tenant=bank1');

        await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();

        await page.getByLabel('Email Address').fill('fake@bank1.com');
        await page.getByLabel('Password').fill('wrongpass');
        await page.getByRole('button', { name: 'Sign In' }).click();

        const alert = page.locator('.MuiAlert-root');
        await expect(alert).toBeVisible({ timeout: 10000 });
    });
});

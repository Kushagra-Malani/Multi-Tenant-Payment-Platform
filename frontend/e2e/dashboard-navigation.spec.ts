import { test, expect } from '@playwright/test';

// Helper: logs in as bank1 admin before each test
test.describe('Dashboard Navigation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login?tenant=icici');
        await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
        await page.getByLabel('Email Address').fill('admin@icici.com');
        await page.getByLabel('Password').fill('password123');
        await page.getByRole('button', { name: 'Sign In' }).click();
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
    });

    test('should display the sidebar with navigation links', async ({ page }) => {
        await expect(page.getByText('FinanceOps')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
        await expect(page.getByText('Wallets')).toBeVisible();
        await expect(page.getByText('Transfer')).toBeVisible();
        await expect(page.getByText('Ledger')).toBeVisible();
        await expect(page.getByText('Settlement')).toBeVisible();
    });

    test('should show the tenant selector in sidebar', async ({ page }) => {
        await expect(page.getByText('ACTIVE TENANT')).toBeVisible();
    });

    test('should navigate to Wallets page', async ({ page }) => {
        await page.getByText('Wallets').click();
        await expect(page).toHaveURL(/\/dashboard\/wallets/, { timeout: 10000 });
    });

    test('should navigate to Transfer page', async ({ page }) => {
        await page.getByText('Transfer').click();
        await expect(page).toHaveURL(/\/dashboard\/transfer/, { timeout: 10000 });
    });

    test('should navigate to Ledger page', async ({ page }) => {
        await page.getByText('Ledger').click();
        await expect(page).toHaveURL(/\/dashboard\/ledger/, { timeout: 10000 });
    });

    test('should navigate to Settlement page', async ({ page }) => {
        await page.getByText('Settlement').click();
        await expect(page).toHaveURL(/\/dashboard\/settlement/, { timeout: 10000 });
    });

    test('should navigate back to Dashboard from another page', async ({ page }) => {
        await page.getByText('Wallets').click();
        await expect(page).toHaveURL(/\/dashboard\/wallets/);

        await page.getByRole('button', { name: 'Dashboard' }).click();
        await expect(page).toHaveURL(/\/dashboard\?tenant=/);
    });
});

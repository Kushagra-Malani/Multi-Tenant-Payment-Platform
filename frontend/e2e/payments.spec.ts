import { test, expect } from '@playwright/test';

test.describe('Payments', () => {
    test.beforeEach(async ({ page }) => {
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

    test('should display the payment form with all fields', async ({ page }) => {
        await expect(page.getByLabel(/Destination Wallet/)).toBeVisible();
        await expect(page.getByLabel('Amount')).toBeVisible();
        await expect(page.getByLabel('Currency')).toBeVisible();
        await expect(page.getByLabel('Status')).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Process Payment' }),
        ).toBeVisible();
    });

    test('should display the payments table with correct headers', async ({ page }) => {
        await expect(page.getByRole('columnheader', { name: 'ID' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'AMOUNT' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'CURRENCY' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'STATUS' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'TIMESTAMP' })).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'ACTIONS' })).toBeVisible();
    });

    test('should create a new pending payment', async ({ page }) => {
        // Select the first wallet from the dropdown
        await page.getByLabel('Destination Wallet (Customer)').click();
        const firstOption = page.getByRole('option').first();
        await expect(firstOption).toBeVisible();
        await firstOption.click();

        // Fill in amount
        await page.getByLabel('Amount').fill('500');

        // Click Process Payment
        await page.getByRole('button', { name: 'Process Payment' }).click();

        // Should show success snackbar
        await expect(page.getByText('Payment created successfully')).toBeVisible({
            timeout: 10000,
        });
    });

    test('should show the rate limit bar', async ({ page }) => {
        await expect(page.getByText('API Calls (This Minute)')).toBeVisible();
    });

    test('should display existing payments in the table', async ({ page }) => {
        // The table should have at least one row (from existing data)
        const rows = page.locator('table tbody tr');
        await expect(rows.first()).toBeVisible({ timeout: 10000 });

        // Each row should have a status chip
        const statusChip = rows.first().locator('.MuiChip-root, [class*="chip"]');
        await expect(statusChip).toBeVisible();
    });
});

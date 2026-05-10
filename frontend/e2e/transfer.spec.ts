import { test, expect } from '@playwright/test';

test.describe('Transfer Funds', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login?tenant=enterprise-bank');
        await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
        await page.getByLabel('Email Address').fill('admin@enterprise.com');
        await page.getByLabel('Password').fill('password123');
        await page.getByRole('button', { name: 'Sign In' }).click();
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

        // Navigate to Transfer page
        await page.getByText('Transfer').click();
        await expect(page).toHaveURL(/\/dashboard\/transfer/, { timeout: 10000 });
    });

    test('should display the transfer form', async ({ page }) => {
        await expect(page.getByText('Transfer Funds')).toBeVisible();
        await expect(page.getByLabel(/From/)).toBeVisible();
        await expect(page.getByLabel(/To/)).toBeVisible();
    });

    test('should load wallets in the From dropdown', async ({ page }) => {
        // Click the "From" dropdown
        await page.getByLabel('From').click();

        // At least one wallet option should appear
        const options = page.getByRole('option');
        await expect(options.first()).toBeVisible({ timeout: 10000 });
    });

    test('To dropdown should be disabled until From is selected', async ({
        page,
    }) => {
        // "To" field should be disabled initially
        const toField = page.getByLabel('To');
        await expect(toField).toBeDisabled();

        // Select a "From" wallet
        await page.getByLabel('From').click();
        await page.getByRole('option').first().click();

        // Now "To" should be enabled
        await expect(toField).not.toBeDisabled();
    });

    test('should perform a transfer between two wallets', async ({ page }) => {
        // Select "From" wallet
        await page.getByLabel('From').click();
        await page.getByRole('option').first().click();

        // Select "To" wallet
        await page.getByLabel('To').click();
        await page.getByRole('option').first().click();

        // Fill amount
        await page.getByLabel('Amount').fill('100');

        // Submit
        await page.getByRole('button', { name: /send money/i }).click();

        // Should show success alert
        await expect(page.getByText(/transfer complete/i)).toBeVisible({
            timeout: 10000,
        });
    });
});

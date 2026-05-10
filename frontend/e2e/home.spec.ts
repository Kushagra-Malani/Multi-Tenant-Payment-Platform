import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
    test('should display tenant cards after loading', async ({ page }) => {
        await page.goto('/');
        await expect(
            page.getByText('Select a tenant to view their isolated dashboard'),
        ).toBeVisible();

        // Wait for at least one tenant card to appear
        const cards = page.locator('.MuiCard-root');
        await expect(cards.first()).toBeVisible({ timeout: 10000 });
    });

    test('should show Super Admin login card', async ({ page }) => {
        await page.goto('/');
        await expect(page.getByText('Super Admin Login')).toBeVisible();
        await expect(
            page.getByText('Manage tenants, users, and platform-wide configuration'),
        ).toBeVisible();
    });

    test('should navigate to login page when clicking a tenant card', async ({
        page,
    }) => {
        await page.goto('/');

        // Wait for cards to load then click the first tenant
        const firstCard = page.locator('.MuiCardActionArea-root').first();
        await expect(firstCard).toBeVisible({ timeout: 10000 });
        await firstCard.click();

        // Should navigate to /login with tenant query param
        await expect(page).toHaveURL(/\/login\?tenant=/);
    });
});

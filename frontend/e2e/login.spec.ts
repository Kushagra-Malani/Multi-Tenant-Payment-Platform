import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
    test('should display Platform when no tenant is specified', async ({
        page,
    }) => {
        await page.goto('/login');
        await expect(page.getByText('PLATFORM')).toBeVisible();
    });

    test('should show email and password fields', async ({ page }) => {
        await page.goto('/login?tenant=bank1');
        await expect(page.getByLabel('Email Address')).toBeVisible();
        await expect(page.getByLabel('Password')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    });

    test('should show error message on invalid credentials', async ({
        page,
    }) => {
        await page.goto('/login?tenant=bank1');

        await page.getByLabel('Email Address').fill('wrong@email.com');
        await page.getByLabel('Password').fill('wrongpassword');
        await page.getByRole('button', { name: 'Sign In' }).click();

        // Should show an error alert
        const alert = page.locator('.MuiAlert-root');
        await expect(alert).toBeVisible({ timeout: 10000 });
        await expect(alert).toContainText(/failed|invalid|credentials/i);
    });

    test('should redirect to dashboard on successful login', async ({
        page,
    }) => {
        await page.goto('/login?tenant=bank1');

        // Replace with real credentials from your database
        await page.getByLabel('Email Address').fill('admin@bank1.com');
        await page.getByLabel('Password').fill('password123');
        await page.getByRole('button', { name: 'Sign In' }).click();

        // Should redirect to dashboard with tenant context
        await expect(page).toHaveURL(/\/dashboard\?tenant=bank1/, {
            timeout: 15000,
        });
    });
});

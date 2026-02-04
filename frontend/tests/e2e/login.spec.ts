import { test, expect } from '@playwright/test';

test.describe('Paperless Full Stack E2E', () => {
    const BASE_URL = 'http://localhost:3009';

    test('should allow user login and redirect to dashboard', async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);

        // Login as staff
        const usernameInput = page.getByLabel('Username');
        await expect(usernameInput).toBeVisible();
        await usernameInput.fill('staff1');

        await page.getByLabel('Password').fill('password');
        await page.getByRole('button', { name: 'Login' }).click();

        // Check redirect
        await expect(page).toHaveURL(`${BASE_URL}/dashboard/staff`);
        await expect(page.locator('h1')).toContainText('Staff Dashboard');
    });

    test('should allow approver login and approve items', async ({ page }) => {
        await page.goto(`${BASE_URL}/login`);

        // Login as approver
        await page.getByLabel('Username').fill('approver1');
        await page.getByLabel('Password').fill('password');
        await page.getByRole('button', { name: 'Login' }).click();

        // Check redirect
        await expect(page).toHaveURL(`${BASE_URL}/dashboard/approver`);
        await expect(page.locator('h1')).toContainText('Approver Dashboard');
    });

    test('should protect dashboard from unauthenticated access', async ({ page }) => {
        await page.goto(`${BASE_URL}/dashboard/staff`);
        await expect(page).toHaveURL(`${BASE_URL}/login`);
    });
});

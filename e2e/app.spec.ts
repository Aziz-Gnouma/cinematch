import { expect, test } from '@playwright/test';

test('anonymous visitors land on the welcome screen', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByText('Entrer dans la salle')).toBeVisible();
});

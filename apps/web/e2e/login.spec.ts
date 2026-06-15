import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Planista ILS/); // Assuming this is the title
});

test('can log in', async ({ page }) => {
  await page.goto('/login');
  
  // Zakładając, że są to selektory, można je dostosować
  await page.fill('input[type="email"]', 'admin@amu.edu.pl');
  await page.fill('input[type="password"]', 'admin123'); // lub inne hasło dev
  await page.click('button[type="submit"]');

  // Po zalogowaniu powinno przekierować na stronę główną lub grid
  await expect(page).toHaveURL('/');
});

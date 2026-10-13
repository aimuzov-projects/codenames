import { expect, type Page } from '@playwright/test'

/** Opens the app and waits for the main menu (after the startup loader from index.html is gone). */
export async function openApp(page: Page) {
	await page.goto('/')
	await expect(page.getByRole('button', { name: 'Играть' })).toBeVisible()
}

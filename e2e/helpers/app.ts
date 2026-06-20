import { type Page, expect } from '@playwright/test'

/** Открывает приложение и ждёт главное меню (после ухода стартового лоадера из index.html). */
export async function openApp(page: Page) {
	await page.goto('/')
	await expect(page.getByRole('button', { name: 'Играть' })).toBeVisible()
}

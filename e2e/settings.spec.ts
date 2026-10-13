import { expect, test } from '@playwright/test'

import { openApp } from './helpers/app'

test.describe('настройки', () => {
	test.beforeEach(async ({ page }) => {
		await openApp(page)
		await page.getByRole('button', { name: /Настройки/ }).click()
		await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible()
	})

	test('переключатель звука меняет состояние', async ({ page }) => {
		// Видимый переключатель — button[role=switch]; #sound — скрытый input для формы.
		const sound = page.getByRole('switch').first()
		await expect(sound).toBeChecked() // по умолчанию включён
		await sound.click()
		await expect(sound).not.toBeChecked()
	})

	test('тёмная тема применяется к <html> и снимается светлой', async ({ page }) => {
		await page.getByRole('button', { name: 'Тёмная' }).click()
		await expect(page.locator('html')).toHaveClass(/dark/)
		await page.getByRole('button', { name: 'Светлая' }).click()
		await expect(page.locator('html')).not.toHaveClass(/dark/)
	})

	test('размер слов применяется к <html>', async ({ page }) => {
		await page.getByRole('button', { name: 'Огромный' }).click()
		await expect(page.locator('html')).toHaveAttribute('style', /--card-word-size:\s*17px/)
	})

	test('таймер хода выбирается', async ({ page }) => {
		const t = page.getByRole('button', { name: '2 мин' })
		await t.click()
		await expect(t).toHaveAttribute('aria-pressed', 'true')
	})

	test('приглушение отгаданных слов переключается', async ({ page }) => {
		// Второй переключатель на экране — «приглушать отгаданные».
		const dim = page.getByRole('switch').nth(1)
		await expect(dim).not.toBeChecked()
		await dim.click()
		await expect(dim).toBeChecked()
	})
})

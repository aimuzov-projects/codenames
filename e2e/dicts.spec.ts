import { expect, test } from '@playwright/test'

import { openApp } from './helpers/app'

test.describe('словари и паки', () => {
	test('снятие всех словарей блокирует старт игры', async ({ page }) => {
		await openApp(page)
		await page.getByRole('button', { name: 'Словари' }).click()

		// Uncheck all selected packs.
		const checks = page.getByRole('checkbox')
		const n = await checks.count()

		for (let i = 0; i < n; i++) {
			const c = checks.nth(i)

			if (await c.isChecked()) await c.click()
		}

		await expect(page.getByText(/Слов выбрано: 0/)).toBeVisible()
		await expect(page.getByText(/нужно минимум 25/)).toBeVisible()

		// On the "Play" screen "One device" is disabled: not enough words.
		await page.getByRole('button', { name: 'Назад' }).click()
		await page.getByRole('button', { name: 'Играть' }).click()
		await expect(page.getByRole('button', { name: 'Одно устройство' })).toBeDisabled()
	})

	test('импорт и удаление своего пака', async ({ page }) => {
		await openApp(page)
		await page.getByRole('button', { name: 'Словари' }).click()
		await page.getByRole('button', { name: 'Свои паки…' }).click()
		await expect(page.getByText('Сохранённые (0)')).toBeVisible()

		await page.getByPlaceholder('Название пака').fill('Тест-пак')
		await page.getByPlaceholder(/Слова через запятую/).fill('альфа, бета, гамма')
		await expect(page.getByText('Слов: 3')).toBeVisible()
		await page.getByRole('button', { name: 'Сохранить' }).click()

		await expect(page.getByText('Сохранённые (1)')).toBeVisible()
		await expect(page.getByText('Тест-пак')).toBeVisible()

		await page.getByRole('button', { name: 'Удалить' }).click()
		await expect(page.getByText('Сохранённые (0)')).toBeVisible()
	})
})

import { expect, test } from '@playwright/test'

import { openApp } from './helpers/app'
import { revealSpymasterView, startHotSeat } from './helpers/game'

test.describe('навигация по меню', () => {
	test.beforeEach(async ({ page }) => {
		await openApp(page)
	})

	test('логотип меняется по клику, подпись автора ведёт на GitHub', async ({ page }) => {
		const logo = page.getByRole('img', { name: 'Codenames' })
		const before = await logo.getAttribute('src')

		await page.getByRole('button', { name: 'Сменить логотип' }).click()
		await expect(logo).not.toHaveAttribute('src', before ?? '')
		await expect(page.getByRole('link', { name: /aimuzov/ })).toHaveAttribute('href', 'https://github.com/aimuzov')
	})

	test('Словари открываются и «назад» возвращает в меню', async ({ page }) => {
		await page.getByRole('button', { name: 'Словари' }).click()
		await expect(page.getByRole('heading', { name: 'Словари' })).toBeVisible()
		await page.getByRole('button', { name: 'Назад' }).click()
		await expect(page.getByRole('button', { name: 'Играть' })).toBeVisible()
	})

	test('Словари → Свои паки → назад', async ({ page }) => {
		await page.getByRole('button', { name: 'Словари' }).click()
		await page.getByRole('button', { name: 'Свои паки…' }).click()
		await expect(page.getByRole('heading', { name: 'Свои паки' })).toBeVisible()
		await page.getByRole('button', { name: 'Назад' }).click()
		await expect(page.getByRole('heading', { name: 'Словари' })).toBeVisible()
	})

	test('Правила открываются', async ({ page }) => {
		await page.getByRole('button', { name: 'Правила' }).click()
		await expect(page.getByRole('heading', { name: 'Правила' })).toBeVisible()
	})

	test('Настройки → журнал изменений', async ({ page }) => {
		await page.getByRole('button', { name: /Настройки/ }).click()
		await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible()
		await page.getByRole('button', { name: 'Весь список изменений' }).click()
		await expect(page.getByRole('heading', { name: 'Что нового', level: 1 })).toBeVisible()
	})

	test('просмотр журнала гасит индикатор «новое» на кнопке настроек', async ({ page }) => {
		// На свежем профиле есть непрочитанные изменения — кнопка настроек помечена «новое».
		await expect(page.getByRole('button', { name: 'Настройки (есть новое)' })).toBeVisible()

		await page.getByRole('button', { name: /Настройки/ }).click()
		await page.getByRole('button', { name: 'Весь список изменений' }).click()
		await expect(page.getByRole('heading', { name: 'Что нового', level: 1 })).toBeVisible()

		// Возвращаемся в меню — индикатор погас.
		await page.getByRole('button', { name: 'Назад' }).click() // журнал → настройки
		await page.getByRole('button', { name: 'Назад' }).click() // настройки → меню
		await expect(page.getByRole('button', { name: 'Настройки (есть новое)' })).toBeHidden()
		await expect(page.getByRole('button', { name: 'Настройки', exact: true })).toBeVisible()
	})

	test('Играть → Лобби → экран подключения', async ({ page }) => {
		await page.getByRole('button', { name: 'Играть' }).click()
		await expect(page.getByRole('heading', { name: 'Играть' })).toBeVisible()
		await page.getByRole('button', { name: 'Лобби' }).click()
		await expect(page.getByRole('heading', { name: 'Лобби' })).toBeVisible()
		await page.getByRole('button', { name: 'Подключиться' }).click()
		await expect(page.getByRole('heading', { name: 'Подключение' })).toBeVisible()
	})

	test('Играть → Создать → лобби хоста', async ({ page }) => {
		await page.getByRole('button', { name: 'Играть' }).click()
		await page.getByRole('button', { name: 'Лобби' }).click()
		await page.getByRole('button', { name: 'Создать' }).click()
		await expect(page.getByRole('heading', { name: 'Создание игры' })).toBeVisible()
	})

	test('Играть → Одно устройство — попадаем на доску', async ({ page }) => {
		await startHotSeat(page)
		await expect(page.getByTestId('card')).toHaveCount(25)
	})

	test('Статистика открывается с доски', async ({ page }) => {
		await startHotSeat(page)
		// Снимаем гейт «Ход капитана» (модальный) — иначе он перекрывает шапку с кнопкой.
		await revealSpymasterView(page)
		await page.getByRole('button', { name: 'Статистика' }).click()
		await expect(page.getByRole('heading', { name: 'Статистика' })).toBeVisible()
	})

	test('сквозная кнопка настроек доступна и на вложенных экранах', async ({ page }) => {
		await page.getByRole('button', { name: 'Играть' }).click()
		await page.getByRole('button', { name: /Настройки/ }).click()
		await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible()
		// Возврат ведёт обратно на экран «Играть», а не на главную.
		await page.getByRole('button', { name: 'Назад' }).click()
		await expect(page.getByRole('heading', { name: 'Играть' })).toBeVisible()
	})
})

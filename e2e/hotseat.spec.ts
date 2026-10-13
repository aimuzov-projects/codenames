import { expect, test } from '@playwright/test'

import { openApp } from './helpers/app'
import {
	cards,
	giveClue,
	indicesOf,
	readKey,
	revealCardAt,
	revealedCount,
	revealSpymasterView,
	startHotSeat,
	startingTeam,
} from './helpers/game'

test.describe('hot-seat (одно устройство)', () => {
	test.beforeEach(async ({ page }) => {
		await openApp(page)
	})

	test('верная карта продолжает ход, неверная — передаёт его', async ({ page }) => {
		await startHotSeat(page)
		await revealSpymasterView(page)
		const key = await readKey(page)
		const mine = startingTeam(key)
		const myCards = indicesOf(key, mine)
		const neutral = indicesOf(key, 'neutral')

		await giveClue(page, 'подсказка', 9)

		// Own card: revealed in its own color, the turn stays (no captain gate).
		await revealCardAt(page, myCards[0]!)
		await expect(cards(page).nth(myCards[0]!)).toHaveAttribute('data-revealed', 'true')
		expect(await revealedCount(page, mine)).toBe(1)
		await expect(page.getByRole('button', { name: 'Показать поле' })).toBeHidden()

		// Neutral card: the turn passes, the phone handoff gate shows up again.
		await revealCardAt(page, neutral[0]!)
		await expect(page.getByRole('button', { name: 'Показать поле' })).toBeVisible({
			timeout: 5_000,
		})
	})

	test('открытие всех своих слов приводит к победе', async ({ page }) => {
		await startHotSeat(page)
		await revealSpymasterView(page)
		const key = await readKey(page)
		const mine = startingTeam(key)
		const myCards = indicesOf(key, mine)

		await giveClue(page, 'всё', 9)
		for (const i of myCards) await revealCardAt(page, i)

		const label = mine === 'red' ? 'Красные победили' : 'Синие победили'
		await expect(page.getByText(label)).toBeVisible({ timeout: 5_000 })
	})

	test('ассасин — мгновенный проигрыш открывшей команды', async ({ page }) => {
		await startHotSeat(page)
		await revealSpymasterView(page)
		const key = await readKey(page)
		const mine = startingTeam(key)
		const assassin = indicesOf(key, 'assassin')[0]!

		await giveClue(page, 'риск', 1)
		await revealCardAt(page, assassin)

		// The revealing team loses → the opponent wins.
		const winner = mine === 'red' ? 'Синие победили' : 'Красные победили'
		await expect(page.getByText(winner)).toBeVisible({ timeout: 5_000 })
	})

	test('открытие карты соперника передаёт ход', async ({ page }) => {
		await startHotSeat(page)
		await revealSpymasterView(page)
		const key = await readKey(page)
		const mine = startingTeam(key)
		const opp = mine === 'red' ? 'blue' : 'red'

		await giveClue(page, 'тест', 3)
		await revealCardAt(page, indicesOf(key, opp)[0]!)

		// The card is revealed in the opponent's color, the turn passes: captain gate.
		expect(await revealedCount(page, opp)).toBe(1)
		await expect(page.getByRole('button', { name: 'Показать поле' })).toBeVisible({
			timeout: 5_000,
		})
	})

	test('«Завершить ход» после догадки передаёт ход', async ({ page }) => {
		await startHotSeat(page)
		await revealSpymasterView(page)
		const key = await readKey(page)
		const mine = startingTeam(key)

		await giveClue(page, 'тест', 3)
		await revealCardAt(page, indicesOf(key, mine)[0]!)
		// The button is locked for ~5s from the start of the turn, Playwright waits for enabled by itself.
		await page.getByRole('button', { name: 'Завершить ход' }).click()
		await expect(page.getByRole('button', { name: 'Показать поле' })).toBeVisible({
			timeout: 5_000,
		})
	})

	test('«Завершить ход» без догадок — через подтверждение', async ({ page }) => {
		await startHotSeat(page)
		await revealSpymasterView(page)
		const key = await readKey(page)
		void key

		await giveClue(page, 'тест', 2)
		// Without a single guess the click opens a confirmation.
		await page.getByRole('button', { name: 'Завершить ход' }).click()
		await expect(page.getByText('Завершить ход без догадок?')).toBeVisible()
		await page.getByRole('alertdialog').getByRole('button', { name: 'Завершить ход' }).click()
		await expect(page.getByRole('button', { name: 'Показать поле' })).toBeVisible({
			timeout: 5_000,
		})
	})

	test('«Новая игра» сбрасывает поле', async ({ page }) => {
		await startHotSeat(page)
		await revealSpymasterView(page)
		const key = await readKey(page)
		const mine = startingTeam(key)

		await giveClue(page, 'тест', 3)
		await revealCardAt(page, indicesOf(key, mine)[0]!)
		expect(await revealedCount(page, mine)).toBe(1)

		// A new game in the middle of a game goes through confirmation.
		await page.getByRole('button', { name: 'Новая игра' }).click()
		await expect(page.getByText('Начать новую игру?')).toBeVisible()
		await page.getByRole('button', { name: 'Начать заново' }).click()

		// Fresh board: no revealed cards, the captain gate again.
		await expect(page.getByRole('button', { name: 'Показать поле' })).toBeVisible()
		await expect(page.locator('[data-testid="card"][data-revealed="true"]')).toHaveCount(0)
	})

	test('выход из партии возвращает в меню', async ({ page }) => {
		await startHotSeat(page)
		await revealSpymasterView(page)
		await giveClue(page, 'тест', 2) // game in progress: the clue is given

		await page.getByRole('button', { name: 'Назад' }).click()
		await expect(page.getByText('Выйти из игры?')).toBeVisible()
		await page.getByRole('button', { name: 'Выйти' }).click()
		await expect(page.getByRole('button', { name: 'Играть' })).toBeVisible()
	})
})

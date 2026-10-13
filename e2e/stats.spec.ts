import { expect, test } from '@playwright/test'

import { openApp } from './helpers/app'
import {
	cards,
	giveClue,
	indicesOf,
	readKey,
	revealCardAt,
	revealSpymasterView,
	startHotSeat,
	startingTeam,
} from './helpers/game'

test.describe('статистика партии', () => {
	test.beforeEach(async ({ page }) => {
		await openApp(page)
	})

	test('после ходов статистика показывает подсказку и открытые слова в таймлайне', async ({ page }) => {
		await startHotSeat(page)
		await revealSpymasterView(page)
		const key = await readKey(page)
		const mine = startingTeam(key)
		const [a, b] = indicesOf(key, mine)
		// Read the words in the captain view before submitting the clue, after that the key gets hidden.
		const wordA = (await cards(page).nth(a!).innerText()).trim()
		const wordB = (await cards(page).nth(b!).innerText()).trim()

		await giveClue(page, 'кит', 3)
		await revealCardAt(page, a!) // own cards: the turn stays, the header is available
		await revealCardAt(page, b!)

		await page.getByRole('button', { name: 'Статистика' }).click()
		await expect(page.getByRole('heading', { name: 'Статистика' })).toBeVisible()

		// Timeline: the turn's clue and the words revealed under it.
		await expect(page.getByText('Таймлайн')).toBeVisible()
		await expect(page.getByText('кит ·')).toBeVisible()
		await expect(page.getByText(wordA, { exact: true })).toBeVisible()
		await expect(page.getByText(wordB, { exact: true })).toBeVisible()
	})

	test('тап по чипу счёта открывает статистику с фильтром по команде', async ({ page }) => {
		await startHotSeat(page)
		await revealSpymasterView(page)
		const key = await readKey(page)
		const mine = startingTeam(key)
		const label = mine === 'red' ? 'Красные' : 'Синие'

		await giveClue(page, 'кит', 3)
		await revealCardAt(page, indicesOf(key, mine)[0]!) // the turn stays, so the chip is clickable

		// The board has two score chips with the same aria-label, tell them apart by team name.
		await page.getByRole('button', { name: 'Открыть статистику' }).filter({ hasText: label }).click()

		await expect(page.getByRole('heading', { name: `Статистика · ${label}` })).toBeVisible()
		await expect(page.getByText('кит ·')).toBeVisible()
	})
})

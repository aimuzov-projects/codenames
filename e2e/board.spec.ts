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

test.describe('доска: хедер, попапы и переходы', () => {
	test.beforeEach(async ({ page }) => {
		await openApp(page)
	})

	test('кнопка «назад» во время партии показывает подтверждение; «Отмена» оставляет в игре', async ({ page }) => {
		await startHotSeat(page)
		await revealSpymasterView(page)
		const key = await readKey(page)
		const mine = startingTeam(key)
		const myCard = indicesOf(key, mine)[0]!

		await giveClue(page, 'тест', 3)
		await revealCardAt(page, myCard) // own card: the turn stays, the game is in progress
		await expect(cards(page).nth(myCard)).toHaveAttribute('data-revealed', 'true')

		// "Back" during a started game does not exit right away, it asks for confirmation.
		await page.getByRole('button', { name: 'Назад' }).click()
		await expect(page.getByText('Выйти из игры?')).toBeVisible()

		// "Cancel": we stay on the board, progress is not lost.
		await page.getByRole('button', { name: 'Отмена' }).click()
		await expect(page.getByText('Выйти из игры?')).toBeHidden()
		await expect(cards(page).nth(myCard)).toHaveAttribute('data-revealed', 'true')
		await expect(page.getByRole('button', { name: 'Назад' })).toBeVisible()
		await expect(page.getByRole('button', { name: 'Играть' })).toBeHidden()

		// Another "Back" → "Exit" leads to the menu.
		await page.getByRole('button', { name: 'Назад' }).click()
		await page.getByRole('button', { name: 'Выйти' }).click()
		await expect(page.getByRole('button', { name: 'Играть' })).toBeVisible()
	})

	test('передача хода на нейтральной карте показывает её как причину в гейте капитана', async ({ page }) => {
		await startHotSeat(page)
		await revealSpymasterView(page)
		const key = await readKey(page)
		const neutral = indicesOf(key, 'neutral')[0]!
		// Read the word in the captain view before submitting the clue (the key gets hidden after).
		const word = (await cards(page).nth(neutral).innerText()).trim()

		await giveClue(page, 'тест', 3)
		await revealCardAt(page, neutral) // neutral → the turn passes

		// The phone handoff gate shows after the reveal animation (revealLocked ~1.5s).
		const gate = page.getByRole('dialog')
		await expect(gate.getByText('Вы открыли общее слово')).toBeVisible({ timeout: 5_000 })
		await expect(gate.getByText(word, { exact: false })).toBeVisible()
	})

	test('передача хода на карте соперника показывает её как причину в гейте капитана', async ({ page }) => {
		await startHotSeat(page)
		await revealSpymasterView(page)
		const key = await readKey(page)
		const mine = startingTeam(key)
		const opp = mine === 'red' ? 'blue' : 'red'
		const oppCard = indicesOf(key, opp)[0]!
		const word = (await cards(page).nth(oppCard).innerText()).trim()

		await giveClue(page, 'тест', 3)
		await revealCardAt(page, oppCard) // opponent's card → the turn passes

		const gate = page.getByRole('dialog')
		await expect(gate.getByText('Вы открыли слово соперников')).toBeVisible({ timeout: 5_000 })
		await expect(gate.getByText(word, { exact: false })).toBeVisible()
	})

	test('приглушение отгаданных слов делает слово на открытой карте полупрозрачным', async ({ page }) => {
		// Turn on "dim guessed words" in settings (the second switch), go back to the menu.
		await page.getByRole('button', { name: /Настройки/ }).click()
		const dim = page.getByRole('switch').nth(1)
		await dim.click()
		await expect(dim).toBeChecked()
		await page.getByRole('button', { name: 'Назад' }).click()

		await startHotSeat(page)
		await revealSpymasterView(page)
		const key = await readKey(page)
		const mine = startingTeam(key)
		const idx = indicesOf(key, mine)[0]!
		const word = (await cards(page).nth(idx).innerText()).trim()

		await giveClue(page, 'кит', 3)
		await revealCardAt(page, idx)

		// After the reveal animation (checkmark ~1s) the word shows up dimmed (opacity-30).
		// .last() is the innermost span with the word (the outer parent contains the same text).
		const wordEl = cards(page).nth(idx).getByText(word, { exact: true }).last()
		await expect(wordEl).toHaveCSS('opacity', '0.3')
	})

	test('«Новая игра» из оверлея победы сбрасывает поле', async ({ page }) => {
		await startHotSeat(page)
		await revealSpymasterView(page)
		const key = await readKey(page)
		const mine = startingTeam(key)
		const myCards = indicesOf(key, mine)

		await giveClue(page, 'всё', 9)
		for (const i of myCards) await revealCardAt(page, i)

		const label = mine === 'red' ? 'Красные победили' : 'Синие победили'
		await expect(page.getByText(label)).toBeVisible({ timeout: 5_000 })

		// "New game" in the win overlay (not in the header) is a separate path without confirmation.
		await page.getByRole('dialog').getByRole('button', { name: 'Новая игра' }).click()

		// New board: the captain gate again, no revealed cards.
		await expect(page.getByRole('button', { name: 'Показать поле' })).toBeVisible()
		await expect(page.locator('[data-testid="card"][data-revealed="true"]')).toHaveCount(0)
	})
})

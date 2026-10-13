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
		await revealCardAt(page, myCard) // своя карта — ход остаётся, партия идёт
		await expect(cards(page).nth(myCard)).toHaveAttribute('data-revealed', 'true')

		// «Назад» во время начатой партии не выходит сразу, а спрашивает подтверждение.
		await page.getByRole('button', { name: 'Назад' }).click()
		await expect(page.getByText('Выйти из игры?')).toBeVisible()

		// «Отмена» — остаёмся на доске, прогресс не потерян.
		await page.getByRole('button', { name: 'Отмена' }).click()
		await expect(page.getByText('Выйти из игры?')).toBeHidden()
		await expect(cards(page).nth(myCard)).toHaveAttribute('data-revealed', 'true')
		await expect(page.getByRole('button', { name: 'Назад' })).toBeVisible()
		await expect(page.getByRole('button', { name: 'Играть' })).toBeHidden()

		// Повторный «Назад» → «Выйти» уводит в меню.
		await page.getByRole('button', { name: 'Назад' }).click()
		await page.getByRole('button', { name: 'Выйти' }).click()
		await expect(page.getByRole('button', { name: 'Играть' })).toBeVisible()
	})

	test('передача хода на нейтральной карте показывает её как причину в гейте капитана', async ({ page }) => {
		await startHotSeat(page)
		await revealSpymasterView(page)
		const key = await readKey(page)
		const neutral = indicesOf(key, 'neutral')[0]!
		// Слово читаем в виде капитана до подачи подсказки (потом ключ скроется).
		const word = (await cards(page).nth(neutral).innerText()).trim()

		await giveClue(page, 'тест', 3)
		await revealCardAt(page, neutral) // нейтраль → ход переходит

		// Гейт передачи телефона показывается после анимации открытия (revealLocked ~1.5с).
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
		await revealCardAt(page, oppCard) // карта соперника → ход переходит

		const gate = page.getByRole('dialog')
		await expect(gate.getByText('Вы открыли слово соперников')).toBeVisible({ timeout: 5_000 })
		await expect(gate.getByText(word, { exact: false })).toBeVisible()
	})

	test('приглушение отгаданных слов делает слово на открытой карте полупрозрачным', async ({ page }) => {
		// Включаем «приглушать отгаданные» в настройках (второй переключатель), возвращаемся в меню.
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

		// После анимации открытия (галочка ~1с) слово проявляется приглушённым (opacity-30).
		// .last() — самый внутренний span со словом (внешний-родитель содержит тот же текст).
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

		// «Новая игра» в оверлее победы (а не в хедере) — отдельный путь без подтверждения.
		await page.getByRole('dialog').getByRole('button', { name: 'Новая игра' }).click()

		// Новое поле: снова гейт капитана, открытых карт нет.
		await expect(page.getByRole('button', { name: 'Показать поле' })).toBeVisible()
		await expect(page.locator('[data-testid="card"][data-revealed="true"]')).toHaveCount(0)
	})
})

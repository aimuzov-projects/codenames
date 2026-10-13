import { expect, type Locator, type Page } from '@playwright/test'

export type CardType = 'red' | 'blue' | 'neutral' | 'assassin'

/** Locator for all 25 board tiles. */
export const cards = (page: Page): Locator => page.getByTestId('card')

/** Starts a hot-seat game from the main menu (the default packs give ≥25 words). */
export async function startHotSeat(page: Page) {
	await page.getByRole('button', { name: 'Играть' }).click()
	await page.getByRole('button', { name: 'Одно устройство' }).click()
	// The board opens with the "Captain's turn" gate right away.
	await expect(page.getByRole('button', { name: 'Показать поле' })).toBeVisible()
}

/** Passes the phone handoff gate → the captain view opens (with the key). */
export async function revealSpymasterView(page: Page) {
	await page.getByRole('button', { name: 'Показать поле' }).click()
	await expect(page.getByRole('button', { name: 'Придумать подсказку' })).toBeVisible()
}

/**
 * Reads the key: the type of each of the 25 cards by index. Only available in the captain view:
 * in the player view hidden cards have no data-card-type (anti-cheat).
 */
export async function readKey(page: Page): Promise<CardType[]> {
	await expect(cards(page)).toHaveCount(25)
	const types = await cards(page).evaluateAll((els) => els.map((el) => el.getAttribute('data-card-type')))
	if (types.some((t) => t === null)) {
		throw new Error('readKey должен вызываться в виде капитана — ключ виден не полностью')
	}
	return types as CardType[]
}

/** Indices of cards of the given type. */
export function indicesOf(key: CardType[], type: CardType): number[] {
	return key.flatMap((t, i) => (t === type ? [i] : []))
}

/** The starting team is the one with 9 cards in the layout. */
export function startingTeam(key: CardType[]): 'red' | 'blue' {
	return indicesOf(key, 'red').length === 9 ? 'red' : 'blue'
}

/** The captain gives a clue: opens the composer, types the word and steps the number to count. */
export async function giveClue(page: Page, word: string, count: number) {
	await page.getByRole('button', { name: 'Придумать подсказку' }).click()
	const input = page.getByRole('textbox')
	await input.fill(word)
	// The number defaults to 2, step it to the target with ±.
	const more = page.getByRole('button', { name: 'Больше' })
	const less = page.getByRole('button', { name: 'Меньше' })
	for (let n = 2; n < count; n++) await more.click()
	for (let n = 2; n > count; n--) await less.click()
	await page.getByRole('button', { name: 'Дать' }).click()
	// After submitting: guessing phase, the key is hidden, the clue button disappears.
	await expect(page.getByRole('button', { name: 'Придумать подсказку' })).toBeHidden()
}

/** Reveals a card by index (player view). */
export async function revealCardAt(page: Page, index: number) {
	await cards(page).nth(index).click()
}

/** How many cards of the given type are already revealed. */
export async function revealedCount(page: Page, type: CardType): Promise<number> {
	return await cards(page).evaluateAll(
		(els, t) =>
			els.filter((el) => el.getAttribute('data-revealed') === 'true' && el.getAttribute('data-card-type') === t)
				.length,
		type,
	)
}

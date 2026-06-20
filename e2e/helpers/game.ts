import { type Page, type Locator, expect } from '@playwright/test'

export type CardType = 'red' | 'blue' | 'neutral' | 'assassin'

/** Локатор всех 25 плиток поля. */
export const cards = (page: Page): Locator => page.getByTestId('card')

/** Из главного меню запускает hot-seat партию (паки по умолчанию дают ≥25 слов). */
export async function startHotSeat(page: Page) {
	await page.getByRole('button', { name: 'Играть' }).click()
	await page.getByRole('button', { name: 'Одно устройство' }).click()
	// На доске сразу гейт «Ход капитана».
	await expect(page.getByRole('button', { name: 'Показать поле' })).toBeVisible()
}

/** Проходит гейт передачи телефона → открывается вид капитана (с ключом). */
export async function revealSpymasterView(page: Page) {
	await page.getByRole('button', { name: 'Показать поле' }).click()
	await expect(page.getByRole('button', { name: 'Придумать подсказку' })).toBeVisible()
}

/**
 * Читает ключ: тип каждой из 25 карт по индексу. Доступно только в виде капитана —
 * в виде игрока у закрытых карт нет data-card-type (анти-чит).
 */
export async function readKey(page: Page): Promise<CardType[]> {
	await expect(cards(page)).toHaveCount(25)
	const types = await cards(page).evaluateAll((els) =>
		els.map((el) => el.getAttribute('data-card-type')),
	)
	if (types.some((t) => t === null)) {
		throw new Error('readKey должен вызываться в виде капитана — ключ виден не полностью')
	}
	return types as CardType[]
}

/** Индексы карт указанного типа. */
export function indicesOf(key: CardType[], type: CardType): number[] {
	return key.flatMap((t, i) => (t === type ? [i] : []))
}

/** Стартовая команда — у кого в раскладе 9 карт. */
export function startingTeam(key: CardType[]): 'red' | 'blue' {
	return indicesOf(key, 'red').length === 9 ? 'red' : 'blue'
}

/** Капитан даёт подсказку: открывает композер, вводит слово и доводит число до count. */
export async function giveClue(page: Page, word: string, count: number) {
	await page.getByRole('button', { name: 'Придумать подсказку' }).click()
	const input = page.getByRole('textbox')
	await input.fill(word)
	// Число по умолчанию 2 — доводим до нужного через ±.
	const more = page.getByRole('button', { name: 'Больше' })
	const less = page.getByRole('button', { name: 'Меньше' })
	for (let n = 2; n < count; n++) await more.click()
	for (let n = 2; n > count; n--) await less.click()
	await page.getByRole('button', { name: 'Дать' }).click()
	// После подачи — фаза догадок, ключ скрыт, кнопка подсказки исчезает.
	await expect(page.getByRole('button', { name: 'Придумать подсказку' })).toBeHidden()
}

/** Открывает карту по индексу (вид игрока). */
export async function revealCardAt(page: Page, index: number) {
	await cards(page).nth(index).click()
}

/** Сколько карт указанного типа уже открыто. */
export async function revealedCount(page: Page, type: CardType): Promise<number> {
	return await cards(page).evaluateAll(
		(els, t) =>
			els.filter(
				(el) =>
					el.getAttribute('data-revealed') === 'true' && el.getAttribute('data-card-type') === t,
			).length,
		type,
	)
}

import { expect, test } from '@playwright/test'

import { openApp } from './helpers/app'
import { revealSpymasterView, startHotSeat } from './helpers/game'

/** Доводит до открытого композера подсказки в виде капитана. */
async function openComposer(page: import('@playwright/test').Page) {
	await startHotSeat(page)
	await revealSpymasterView(page)
	await page.getByRole('button', { name: 'Придумать подсказку' }).click()
}

test.describe('композер подсказки', () => {
	test.beforeEach(async ({ page }) => {
		await openApp(page)
	})

	test('кнопка «Дать» заблокирована, пока нет непустого слова', async ({ page }) => {
		await openComposer(page)
		const give = page.getByRole('button', { name: 'Дать' })
		const input = page.getByRole('textbox')

		await expect(give).toBeDisabled() // поле пустое
		await input.fill('   ') // только пробелы — непробельного токена нет
		await expect(give).toBeDisabled()
		await input.fill('кит')
		await expect(give).toBeEnabled()
	})

	test('счётчик слов не выходит за пределы [1..9]', async ({ page }) => {
		await openComposer(page)
		const count = page.getByTestId('clue-count')
		const less = page.getByRole('button', { name: 'Меньше' })
		const more = page.getByRole('button', { name: 'Больше' })

		await expect(count).toHaveText('2') // значение по умолчанию

		await less.click()
		await expect(count).toHaveText('1')
		await less.click()
		await less.click()
		await expect(count).toHaveText('1') // ниже 1 не опускается

		for (let i = 0; i < 12; i++) await more.click()
		await expect(count).toHaveText('9') // выше 9 не поднимается
	})

	test('подсказка остаётся одним словом — лишнее отбрасывается', async ({ page }) => {
		await openComposer(page)
		const input = page.getByRole('textbox')

		await input.fill('два слова')
		await expect(input).toHaveValue('два') // onChange оставляет только первый токен
	})
})

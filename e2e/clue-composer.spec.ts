import { expect, test } from '@playwright/test'

import { openApp } from './helpers/app'
import { revealSpymasterView, startHotSeat } from './helpers/game'

/** Gets to an open clue composer in the captain view. */
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

		await expect(give).toBeDisabled() // the field is empty
		await input.fill('   ') // only spaces, no non-whitespace token
		await expect(give).toBeDisabled()
		await input.fill('кит')
		await expect(give).toBeEnabled()
	})

	test('счётчик слов не выходит за пределы [1..9]', async ({ page }) => {
		await openComposer(page)
		const count = page.getByTestId('clue-count')
		const less = page.getByRole('button', { name: 'Меньше' })
		const more = page.getByRole('button', { name: 'Больше' })

		await expect(count).toHaveText('2') // default value

		await less.click()
		await expect(count).toHaveText('1')
		await less.click()
		await less.click()
		await expect(count).toHaveText('1') // doesn't go below 1

		for (let i = 0; i < 12; i++) await more.click()

		await expect(count).toHaveText('9') // doesn't go above 9
	})

	test('подсказка остаётся одним словом — лишнее отбрасывается', async ({ page }) => {
		await openComposer(page)
		const input = page.getByRole('textbox')

		await input.fill('два слова')
		await expect(input).toHaveValue('два') // onChange keeps only the first token
	})
})

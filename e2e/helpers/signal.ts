import { expect, type Page } from '@playwright/test'

/**
 * Хуки сигналинга для e2e (за VITE_E2E). Заменяют камеру: код offer/answer читается строкой
 * из скрытого узла рядом с QR, а «сканирование» — это вставка строки в поле. Сам транспорт
 * (WebRTC DataChannel) при этом настоящий.
 */

/** Читает offer/answer-код, показанный на текущем экране (вместо съёмки QR). */
export async function readSignalOut(page: Page): Promise<string> {
	const out = page.getByTestId('signal-out')
	// Код появляется после сборки ICE-кандидатов (non-trickle) — ждём с запасом.
	await expect(out).toHaveCount(1, { timeout: 20_000 })
	const code = await out.textContent()
	if (!code) throw new Error('signal-out пуст')
	return code
}

/** Подаёт код в сканер (вместо съёмки QR камерой). */
export async function submitSignalIn(page: Page, code: string) {
	await page.getByTestId('signal-in').fill(code)
	await page.getByTestId('signal-submit').click()
}

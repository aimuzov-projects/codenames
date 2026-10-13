import { expect, type Page } from '@playwright/test'

/**
 * Signaling hooks for e2e (behind PUBLIC_E2E). They replace the camera: the offer/answer code is read
 * as a string from a hidden node next to the QR, and "scanning" means pasting the string into a field.
 * The transport itself (WebRTC DataChannel) is real.
 */

/** Reads the offer/answer code shown on the current screen (instead of shooting the QR). */
export async function readSignalOut(page: Page): Promise<string> {
	const out = page.getByTestId('signal-out')
	// The code appears after ICE candidates are gathered (non-trickle), so wait with a margin.
	await expect(out).toHaveCount(1, { timeout: 20_000 })
	const code = await out.textContent()
	if (!code) throw new Error('signal-out пуст')
	return code
}

/** Feeds the code into the scanner (instead of shooting the QR with the camera). */
export async function submitSignalIn(page: Page, code: string) {
	await page.getByTestId('signal-in').fill(code)
	await page.getByTestId('signal-submit').click()
}

import { devices, expect, type Page } from '@playwright/test'

import { openApp } from './app'
import { readSignalOut, submitSignalIn } from './signal'

/** Manual contexts don't inherit the project `use`, so device and ignoreHTTPSErrors are set explicitly. */
export const mobileCtx = { ...devices['Pixel 7'], ignoreHTTPSErrors: true }

/**
 * The host creates a game and lands in the "Create game" lobby (red captain by default).
 * The relay is always available, so the lobby starts in online mode: we switch it
 * to the offline QR handshake, which is what these tests check.
 */
export async function startHost(host: Page) {
	await openApp(host)
	await host.getByRole('button', { name: 'Играть' }).click()
	await host.getByRole('button', { name: 'Лобби' }).click()
	await host.getByRole('button', { name: 'Создать' }).click()
	await expect(host.getByRole('heading', { name: 'Создание игры' })).toBeVisible()
	await host.getByRole('button', { name: 'Играть без интернета' }).click()
	await expect(host.getByRole('button', { name: 'Добавить игрока' })).toBeVisible()
}

/**
 * Full host↔guest handshake via the signaling test hooks (a real WebRTC DataChannel).
 * The host must be in the lobby; afterwards the guest is on the setup screen, the host is back in the lobby.
 */
export async function connectGuest(host: Page, guest: Page) {
	await openApp(guest)
	await guest.getByRole('button', { name: 'Играть' }).click()
	await guest.getByRole('button', { name: 'Лобби' }).click()
	await guest.getByRole('button', { name: 'Подключиться' }).click()
	await guest.getByRole('button', { name: 'Рядом, без интернета' }).click()
	const offer = await readSignalOut(guest)

	await guest.getByRole('button', { name: 'Далее' }).click()

	await host.getByRole('button', { name: 'Добавить игрока' }).click()
	await submitSignalIn(host, offer)
	const answer = await readSignalOut(host)

	await submitSignalIn(guest, answer)

	await expect(guest.getByText('Подключено ✓')).toBeVisible({ timeout: 20_000 })

	await expect(host.getByRole('heading', { name: 'Создание игры' })).toBeVisible({
		timeout: 20_000,
	})
}

/** The guest picks a team and role on the setup screen (via the SetupPicker segment controls). */
export async function guestPick(guest: Page, team: 'Красные' | 'Синие', role: 'Игрок' | 'Капитан') {
	await guest.getByRole('radio', { name: team }).click()
	await guest.getByRole('radio', { name: role }).click()
}

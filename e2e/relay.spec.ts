import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

import { openApp } from './helpers/app'
import { mobileCtx } from './helpers/net'

/**
 * Online mode: a room on the WS relay (see src/backend/server.ts). We check what it was made for:
 * the connection heals on its own, no walking around with a camera; we fake network loss with `context.setOffline`.
 */

async function openPeers(browser: Browser, n: number) {
	const ctxs = await Promise.all(Array.from({ length: n }, () => browser.newContext(mobileCtx)))
	const pages = await Promise.all(ctxs.map((c) => c.newPage()))

	return { ctxs, pages }
}

/** The host opens a room and returns its code. */
async function hostRoom(host: Page): Promise<string> {
	await openApp(host)
	await host.getByRole('button', { name: 'Играть' }).click()
	await host.getByRole('button', { name: 'Лобби' }).click()
	await host.getByRole('button', { name: 'Создать' }).click()
	const code = host.getByTestId('room-code')

	await expect(code).toBeVisible({ timeout: 20_000 })

	return (await code.textContent()) ?? ''
}

/** The guest joins a room by code. */
async function joinRoom(guest: Page, code: string) {
	await openApp(guest)
	await guest.getByRole('button', { name: 'Играть' }).click()
	await guest.getByRole('button', { name: 'Лобби' }).click()
	await guest.getByRole('button', { name: 'Подключиться' }).click()
	await guest.getByRole('button', { name: 'Войти по коду' }).click()
	await guest.getByRole('textbox').fill(code)
	await guest.getByRole('button', { name: 'Войти' }).click()
	await expect(guest.getByText('Подключено ✓')).toBeVisible({ timeout: 20_000 })
}

/** Device sleep simulation: the network goes away, then comes back. */
async function blink(ctx: BrowserContext, page: Page, offlineWhile: () => Promise<void>) {
	await ctx.setOffline(true)
	await offlineWhile()
	await ctx.setOffline(false)
	// The transport wakes up on the online event, but we also nudge it with tab visibility to be safe.
	await page.bringToFront()
}

test.describe('онлайн-режим (релей)', () => {
	test('вход по коду комнаты и автоматический возврат после обрыва', async ({ browser }) => {
		const { ctxs, pages } = await openPeers(browser, 2)
		const [host, guest] = pages

		try {
			const code = await hostRoom(host!)

			expect(code).toMatch(/^[A-Z2-9]{6}$/)

			await joinRoom(guest!, code)
			await guest!.getByRole('radio', { name: 'Синие' }).click()
			await guest!.getByRole('radio', { name: 'Капитан' }).click()
			await expect(host!.getByRole('listitem')).toHaveCount(2)

			// The guest's phone went to sleep, the network is gone.
			await blink(ctxs[1]!, guest!, async () => {
				await expect(guest!.getByText('Соединение потеряно')).toBeVisible({ timeout: 30_000 })
			})

			// Comes back on its own: no QR, no buttons, and in the same seat.
			await expect(guest!.getByText('Подключено ✓')).toBeVisible({ timeout: 30_000 })
			await expect(host!.getByRole('listitem')).toHaveCount(2)
			await expect(host!.getByRole('listitem').filter({ hasText: 'капитан' })).toHaveCount(2)
		} finally {
			await Promise.all(ctxs.map((c) => c.close()))
		}
	})

	test('уснувший хост возвращается в свою комнату — гости остаются на местах', async ({ browser }) => {
		const { ctxs, pages } = await openPeers(browser, 2)
		const [host, guest] = pages

		try {
			const code = await hostRoom(host!)

			await joinRoom(guest!, code)
			await expect(host!.getByRole('listitem')).toHaveCount(2)

			// The host fell asleep: the guest sees the connection loss but stays in the app.
			await blink(ctxs[0]!, host!, async () => {
				await expect(guest!.getByText('Соединение потеряно')).toBeVisible({ timeout: 30_000 })
			})

			// The host takes the same room, the guest introduces itself again, the roster is unchanged.
			await expect(host!.getByTestId('room-code')).toHaveText(code, { timeout: 30_000 })
			await expect(guest!.getByText('Подключено ✓')).toBeVisible({ timeout: 30_000 })
			await expect(host!.getByRole('listitem')).toHaveCount(2)
		} finally {
			await Promise.all(ctxs.map((c) => c.close()))
		}
	})
})

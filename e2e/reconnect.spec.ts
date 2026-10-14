import { expect, test, type Browser, type Page } from '@playwright/test'

import { cards, giveClue, indicesOf, readKey, revealCardAt, startingTeam } from './helpers/game'
import { connectGuest, guestPick, mobileCtx, startHost } from './helpers/net'
import { readSignalOut, submitSignalIn } from './helpers/signal'

/** Spins up N isolated mobile contexts and their pages. */
async function openPeers(browser: Browser, n: number) {
	const ctxs = await Promise.all(Array.from({ length: n }, () => browser.newContext(mobileCtx)))
	const pages = await Promise.all(ctxs.map((c) => c.newPage()))

	return { ctxs, pages }
}

/** Simulates the aftermath of device sleep: the guest's channel closes (see the hook in net.ts). */
async function dropLink(page: Page) {
	await page.evaluate(() => (window as unknown as { __e2eDropLink: () => void }).__e2eDropLink())
}

/** Assembles a full roster: g1 is a red player, g2 the blue captain, g3 a blue player. */
async function seatFour(host: Page, g1: Page, g2: Page, g3: Page) {
	await startHost(host) // the host is the red captain
	await connectGuest(host, g1)
	await guestPick(g1, 'Красные', 'Игрок')
	await connectGuest(host, g2)
	await guestPick(g2, 'Синие', 'Капитан')
	await connectGuest(host, g3)
	await guestPick(g3, 'Синие', 'Игрок')
}

test.describe('переподключение после обрыва', () => {
	test('гость возвращается в идущую партию на своё место', async ({ browser }) => {
		const { ctxs, pages } = await openPeers(browser, 4)
		const [host, g1, g2, g3] = pages

		try {
			await seatFour(host!, g1!, g2!, g3!)
			await host!.getByRole('button', { name: 'Начать игру' }).click()
			await expect(cards(g1!)).toHaveCount(25, { timeout: 20_000 })

			// Make the game "in progress": a clue from the starting team and one reveal.
			const key = await readKey(host!)
			const start = startingTeam(key)
			const captain = start === 'red' ? host! : g2!
			const operative = start === 'red' ? g1! : g3!

			await giveClue(captain, 'связь', 2)
			await revealCardAt(operative, indicesOf(key, start)[0]!)

			await expect(g1!.locator('[data-testid="card"][data-revealed="true"]')).toHaveCount(1, {
				timeout: 20_000,
			})

			// Device g1 "fell asleep": the channel dropped.
			await dropLink(g1!)
			await expect(g1!.getByText('Связь с хостом потеряна')).toBeVisible({ timeout: 20_000 })
			// The board is still there, the game keeps being shown.
			await expect(cards(g1!)).toHaveCount(25)
			// The host sees who dropped off right on the board.
			await expect(host!.getByText(/Не на связи/)).toBeVisible({ timeout: 20_000 })

			// Coming back: the guest shows a new offer, the host accepts it from the board.
			await g1!.getByRole('button', { name: 'Переподключиться' }).click()
			await expect(g1!.getByRole('heading', { name: 'Переподключение' })).toBeVisible()
			const offer = await readSignalOut(g1!)

			await g1!.getByRole('button', { name: 'Далее' }).click()

			await host!.getByRole('button', { name: 'Подключить' }).click()
			await submitSignalIn(host!, offer)
			const answer = await readSignalOut(host!)

			await submitSignalIn(g1!, answer)

			// The guest is back on the board, in the same seat (red player) and with the current game state.
			await expect(cards(g1!)).toHaveCount(25, { timeout: 20_000 })
			await expect(g1!.getByText('Связь с хостом потеряна')).toBeHidden()
			await expect(g1!.locator('[data-testid="card"][data-revealed="true"]')).toHaveCount(1)
			await expect(g1!.getByText(/игрок/i).first()).toBeVisible()
			// No duplicate in the roster: the host still sees four, all online.
			await expect(host!.getByText(/Не на связи/)).toBeHidden({ timeout: 20_000 })
		} finally {
			await Promise.all(ctxs.map((c) => c.close()))
		}
	})

	test('перезапуск приложения не теряет партию', async ({ browser }) => {
		const { ctxs, pages } = await openPeers(browser, 4)
		const [host, g1, g2, g3] = pages

		try {
			await seatFour(host!, g1!, g2!, g3!)
			await host!.getByRole('button', { name: 'Начать игру' }).click()
			await expect(cards(g1!)).toHaveCount(25, { timeout: 20_000 })

			const key = await readKey(host!)
			const start = startingTeam(key)
			const captain = start === 'red' ? host! : g2!
			const operative = start === 'red' ? g1! : g3!

			await giveClue(captain, 'память', 2)
			await revealCardAt(operative, indicesOf(key, start)[0]!)

			// Both must have the move before the reload: the guest saves the snapshot it got from the host,
			// and on the fast production build the reload could otherwise outrun the broadcast.
			for (const page of [host!, g1!]) {
				await expect(page.locator('[data-testid="card"][data-revealed="true"]')).toHaveCount(1, {
					timeout: 20_000,
				})
			}

			// The guest app got unloaded from memory (iOS does this regularly).
			await g1!.reload()
			await g1!.getByRole('button', { name: 'Вернуться в игру' }).click()
			// The board is in place, with the revealed card and the clue from the game, but without a connection.
			await expect(cards(g1!)).toHaveCount(25)
			await expect(g1!.locator('[data-testid="card"][data-revealed="true"]')).toHaveCount(1)
			await expect(g1!.getByText('память')).toBeVisible()
			await expect(g1!.getByText('Связь с хостом потеряна')).toBeVisible()

			// Now the same with the host: it keeps the canonical game state.
			await host!.reload()
			await host!.getByRole('button', { name: 'Вернуться в игру' }).click()
			await expect(cards(host!)).toHaveCount(25)
			await expect(host!.locator('[data-testid="card"][data-revealed="true"]')).toHaveCount(1)
			// The captain's key is restored too.
			await expect(host!.locator('[data-testid="card"][data-card-type]')).toHaveCount(25)

			// And the guest returns to the same game via a new handshake.
			await g1!.getByRole('button', { name: 'Переподключиться' }).click()
			const offer = await readSignalOut(g1!)

			await g1!.getByRole('button', { name: 'Далее' }).click()
			await host!.getByRole('button', { name: 'Подключить' }).click()
			await submitSignalIn(host!, offer)
			const answer = await readSignalOut(host!)

			await submitSignalIn(g1!, answer)

			await expect(g1!.getByText('Связь с хостом потеряна')).toBeHidden({ timeout: 20_000 })
			await expect(g1!.locator('[data-testid="card"][data-revealed="true"]')).toHaveCount(1)
		} finally {
			await Promise.all(ctxs.map((c) => c.close()))
		}
	})

	test('в лобби вернувшийся гость сохраняет выбранную команду и роль', async ({ browser }) => {
		const { ctxs, pages } = await openPeers(browser, 2)
		const [host, guest] = pages

		try {
			await startHost(host!)
			await connectGuest(host!, guest!)
			await guestPick(guest!, 'Синие', 'Капитан')
			await expect(host!.getByRole('listitem')).toHaveCount(2)

			await dropLink(guest!)
			// In the lobby the host removes an offline player after 5 seconds, we make it back before that.
			await guest!.getByRole('button', { name: 'Переподключиться' }).click()
			const offer = await readSignalOut(guest!)

			await guest!.getByRole('button', { name: 'Далее' }).click()

			await host!.getByRole('button', { name: 'Добавить игрока' }).click()
			await submitSignalIn(host!, offer)
			const answer = await readSignalOut(host!)

			await submitSignalIn(guest!, answer)

			await expect(guest!.getByText('Подключено ✓')).toBeVisible({ timeout: 20_000 })
			// The roster is unchanged: two players, the guest is the blue captain.
			await expect(host!.getByRole('listitem')).toHaveCount(2)
			await expect(host!.getByRole('listitem').filter({ hasText: 'капитан' })).toHaveCount(2)
		} finally {
			await Promise.all(ctxs.map((c) => c.close()))
		}
	})
})

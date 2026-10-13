import { expect, test, type Browser } from '@playwright/test'

import { giveClue, indicesOf, readKey, revealCardAt, revealedCount, startingTeam } from './helpers/game'
import { connectGuest, guestPick, mobileCtx, startHost } from './helpers/net'

/** Spins up N isolated mobile contexts and their pages. */
async function openPeers(browser: Browser, n: number) {
	const ctxs = await Promise.all(Array.from({ length: n }, () => browser.newContext(mobileCtx)))
	const pages = await Promise.all(ctxs.map((c) => c.newPage()))
	return { ctxs, pages }
}

test.describe('сетевой режим (P2P)', () => {
	test('рукопожатие хост↔гость и блокировка старта при неполном составе', async ({ browser }) => {
		const { ctxs, pages } = await openPeers(browser, 2)
		const [host, guest] = pages
		try {
			await startHost(host!)
			await connectGuest(host!, guest!)

			await expect(host!.getByRole('listitem')).toHaveCount(2)

			// Two players aren't enough: each team needs a captain and a player.
			await host!.getByRole('button', { name: 'Начать игру' }).click()
			await expect(host!.getByText('Нельзя начать игру')).toBeVisible()
		} finally {
			await Promise.all(ctxs.map((c) => c.close()))
		}
	})

	test('гость выбирает команду/роль — правило «один капитан на команду»', async ({ browser }) => {
		const { ctxs, pages } = await openPeers(browser, 2)
		const [host, guest] = pages
		try {
			await startHost(host!) // the host is the red captain
			await connectGuest(host!, guest!)

			// The guest picks red, which already has a captain (the host), so the "Captain" role is unavailable.
			await guest!.getByRole('radio', { name: 'Красные' }).click()
			await expect(guest!.getByRole('radio', { name: 'Капитан' })).toBeDisabled()

			// Becomes a red player; the host sees it in the roster.
			await guest!.getByRole('radio', { name: 'Игрок' }).click()
			await expect(host!.getByRole('listitem').filter({ hasText: 'игрок' })).toHaveCount(1)
		} finally {
			await Promise.all(ctxs.map((c) => c.close()))
		}
	})

	test('партия по сети: старт, анти-чит, синхронизация подсказки и открытий', async ({ browser }) => {
		const { ctxs, pages } = await openPeers(browser, 4)
		const [host, g1, g2, g3] = pages
		try {
			await startHost(host!) // red captain
			// Assemble a full roster: g1 is a red player, g2 the blue captain, g3 a blue player.
			await connectGuest(host!, g1!)
			await guestPick(g1!, 'Красные', 'Игрок')
			await connectGuest(host!, g2!)
			await guestPick(g2!, 'Синие', 'Капитан')
			await connectGuest(host!, g3!)
			await guestPick(g3!, 'Синие', 'Игрок')

			await expect(host!.getByRole('listitem')).toHaveCount(4)
			await host!.getByRole('button', { name: 'Начать игру' }).click()

			// The game has started, everyone is on the board.
			await expect(host!.getByTestId('card')).toHaveCount(25)
			await expect(g1!.getByTestId('card')).toHaveCount(25, { timeout: 20_000 })
			await expect(g3!.getByTestId('card')).toHaveCount(25, { timeout: 20_000 })

			// Anti-cheat: the captain (host) sees the key for all 25 cards, the player (g3) for none of the hidden ones.
			await expect(host!.locator('[data-testid="card"][data-card-type]')).toHaveCount(25)
			await expect(g3!.locator('[data-testid="card"][data-card-type]')).toHaveCount(0)

			// The starting team's captain gives a clue, their player sees it, reveals a card,
			// and the captain sees it revealed (two-way sync over a real channel).
			const key = await readKey(host!)
			const start = startingTeam(key)
			const captain = start === 'red' ? host! : g2!
			const operative = start === 'red' ? g1! : g3!

			await giveClue(captain, 'синхро', 3)
			await expect(operative.getByText('синхро')).toBeVisible({ timeout: 20_000 })

			await revealCardAt(operative, indicesOf(key, start)[0]!)
			await expect.poll(() => revealedCount(host!, start), { timeout: 20_000 }).toBe(1)
		} finally {
			await Promise.all(ctxs.map((c) => c.close()))
		}
	})

	test('хост перезапускает партию — гость получает свежее поле', async ({ browser }) => {
		const { ctxs, pages } = await openPeers(browser, 4)
		const [host, g1, g2, g3] = pages
		try {
			await startHost(host!) // red captain
			await connectGuest(host!, g1!)
			await guestPick(g1!, 'Красные', 'Игрок')
			await connectGuest(host!, g2!)
			await guestPick(g2!, 'Синие', 'Капитан')
			await connectGuest(host!, g3!)
			await guestPick(g3!, 'Синие', 'Игрок')

			await host!.getByRole('button', { name: 'Начать игру' }).click()
			await expect(g1!.getByTestId('card')).toHaveCount(25, { timeout: 20_000 })

			// Make the game "in progress": a clue + one reveal, synced to the host.
			const key = await readKey(host!)
			const start = startingTeam(key)
			const captain = start === 'red' ? host! : g2!
			const operative = start === 'red' ? g1! : g3!
			await giveClue(captain, 'рестарт', 3)
			await revealCardAt(operative, indicesOf(key, start)[0]!)
			await expect.poll(() => revealedCount(host!, start), { timeout: 20_000 }).toBe(1)

			// The host restarts the game from the header (game in progress → via confirmation).
			await host!.getByRole('button', { name: 'Новая игра' }).click()
			await host!.getByRole('button', { name: 'Начать заново' }).click()

			// The guest gets a fresh board: no revealed cards.
			await expect
				.poll(() => g1!.locator('[data-testid="card"][data-revealed="true"]').count(), {
					timeout: 20_000,
				})
				.toBe(0)
		} finally {
			await Promise.all(ctxs.map((c) => c.close()))
		}
	})

	test('перетасовка ростера даёт играбельный состав', async ({ browser }) => {
		const { ctxs, pages } = await openPeers(browser, 4)
		const [host, g1, g2, g3] = pages
		try {
			await startHost(host!)
			await connectGuest(host!, g1!)
			await guestPick(g1!, 'Красные', 'Игрок')
			await connectGuest(host!, g2!)
			await guestPick(g2!, 'Синие', 'Капитан')
			await connectGuest(host!, g3!)
			await guestPick(g3!, 'Синие', 'Игрок')
			await expect(host!.getByRole('listitem')).toHaveCount(4)

			// Shuffle: the button is only available with 4+ connected.
			await host!.getByRole('button', { name: 'Перемешать игроков' }).click()

			// The roster stays valid: start goes through without an alert and the game begins.
			await host!.getByRole('button', { name: 'Начать игру' }).click()
			await expect(host!.getByText('Нельзя начать игру')).toBeHidden()
			await expect(host!.getByTestId('card')).toHaveCount(25, { timeout: 20_000 })
		} finally {
			await Promise.all(ctxs.map((c) => c.close()))
		}
	})
})

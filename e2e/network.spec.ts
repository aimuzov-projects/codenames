import { expect, test, type Browser } from '@playwright/test'

import { giveClue, indicesOf, readKey, revealCardAt, revealedCount, startingTeam } from './helpers/game'
import { connectGuest, guestPick, mobileCtx, startHost } from './helpers/net'

/** Поднимает N изолированных мобильных контекстов и их страницы. */
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

			// Двух игроков мало: нужно по капитану и игроку в каждой команде.
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
			await startHost(host!) // хост — красный капитан
			await connectGuest(host!, guest!)

			// Гость выбирает красных — там уже есть капитан (хост), роль «Капитан» недоступна.
			await guest!.getByRole('radio', { name: 'Красные' }).click()
			await expect(guest!.getByRole('radio', { name: 'Капитан' })).toBeDisabled()

			// Становится игроком красных; хост видит это в ростере.
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
			await startHost(host!) // красный капитан
			// Собираем полный состав: g1 — красный игрок, g2 — синий капитан, g3 — синий игрок.
			await connectGuest(host!, g1!)
			await guestPick(g1!, 'Красные', 'Игрок')
			await connectGuest(host!, g2!)
			await guestPick(g2!, 'Синие', 'Капитан')
			await connectGuest(host!, g3!)
			await guestPick(g3!, 'Синие', 'Игрок')

			await expect(host!.getByRole('listitem')).toHaveCount(4)
			await host!.getByRole('button', { name: 'Начать игру' }).click()

			// Партия началась — все на доске.
			await expect(host!.getByTestId('card')).toHaveCount(25)
			await expect(g1!.getByTestId('card')).toHaveCount(25, { timeout: 20_000 })
			await expect(g3!.getByTestId('card')).toHaveCount(25, { timeout: 20_000 })

			// Анти-чит: капитан (host) видит ключ всех 25 карт, игрок (g3) — ни одной закрытой.
			await expect(host!.locator('[data-testid="card"][data-card-type]')).toHaveCount(25)
			await expect(g3!.locator('[data-testid="card"][data-card-type]')).toHaveCount(0)

			// Капитан стартовой команды даёт подсказку — его игрок видит её, открывает карту,
			// и капитан видит её открытой (двусторонняя синхронизация по реальному каналу).
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
			await startHost(host!) // красный капитан
			await connectGuest(host!, g1!)
			await guestPick(g1!, 'Красные', 'Игрок')
			await connectGuest(host!, g2!)
			await guestPick(g2!, 'Синие', 'Капитан')
			await connectGuest(host!, g3!)
			await guestPick(g3!, 'Синие', 'Игрок')

			await host!.getByRole('button', { name: 'Начать игру' }).click()
			await expect(g1!.getByTestId('card')).toHaveCount(25, { timeout: 20_000 })

			// Делаем партию «идущей»: подсказка + одно открытие, синхронизированное на хост.
			const key = await readKey(host!)
			const start = startingTeam(key)
			const captain = start === 'red' ? host! : g2!
			const operative = start === 'red' ? g1! : g3!
			await giveClue(captain, 'рестарт', 3)
			await revealCardAt(operative, indicesOf(key, start)[0]!)
			await expect.poll(() => revealedCount(host!, start), { timeout: 20_000 }).toBe(1)

			// Хост перезапускает партию из хедера (партия идёт → через подтверждение).
			await host!.getByRole('button', { name: 'Новая игра' }).click()
			await host!.getByRole('button', { name: 'Начать заново' }).click()

			// Гость получает свежее поле: открытых карт нет.
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

			// Перемешиваем — кнопка доступна только при 4+ подключённых.
			await host!.getByRole('button', { name: 'Перемешать игроков' }).click()

			// Состав остаётся валидным: старт проходит без алерта и партия начинается.
			await host!.getByRole('button', { name: 'Начать игру' }).click()
			await expect(host!.getByText('Нельзя начать игру')).toBeHidden()
			await expect(host!.getByTestId('card')).toHaveCount(25, { timeout: 20_000 })
		} finally {
			await Promise.all(ctxs.map((c) => c.close()))
		}
	})
})

import { test, expect, type Browser, type Page } from '@playwright/test'
import { connectGuest, guestPick, mobileCtx, startHost } from './helpers/net'
import { readSignalOut, submitSignalIn } from './helpers/signal'
import { cards, giveClue, indicesOf, readKey, revealCardAt, startingTeam } from './helpers/game'

/** Поднимает N изолированных мобильных контекстов и их страницы. */
async function openPeers(browser: Browser, n: number) {
	const ctxs = await Promise.all(Array.from({ length: n }, () => browser.newContext(mobileCtx)))
	const pages = await Promise.all(ctxs.map((c) => c.newPage()))
	return { ctxs, pages }
}

/** Имитирует последствия сна устройства: канал гостя закрывается (см. хук в net.ts). */
async function dropLink(page: Page) {
	await page.evaluate(() => (window as unknown as { __e2eDropLink: () => void }).__e2eDropLink())
}

/** Собирает полный состав: g1 — красный игрок, g2 — синий капитан, g3 — синий игрок. */
async function seatFour(host: Page, g1: Page, g2: Page, g3: Page) {
	await startHost(host) // хост — красный капитан
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

			// Делаем партию «идущей»: подсказка стартовой команды и одно открытие.
			const key = await readKey(host!)
			const start = startingTeam(key)
			const captain = start === 'red' ? host! : g2!
			const operative = start === 'red' ? g1! : g3!
			await giveClue(captain, 'связь', 2)
			await revealCardAt(operative, indicesOf(key, start)[0]!)
			await expect(g1!.locator('[data-testid="card"][data-revealed="true"]')).toHaveCount(1, {
				timeout: 20_000,
			})

			// Устройство g1 «уснуло»: канал оборвался.
			await dropLink(g1!)
			await expect(g1!.getByText('Связь с хостом потеряна')).toBeVisible({ timeout: 20_000 })
			// Доска при этом никуда не делась — партия продолжает отображаться.
			await expect(cards(g1!)).toHaveCount(25)
			// Хост видит, кто отвалился, прямо на доске.
			await expect(host!.getByText(/Не на связи/)).toBeVisible({ timeout: 20_000 })

			// Возвращаемся: гость показывает новый offer, хост принимает его из доски.
			await g1!.getByRole('button', { name: 'Переподключиться' }).click()
			await expect(g1!.getByRole('heading', { name: 'Переподключение' })).toBeVisible()
			const offer = await readSignalOut(g1!)
			await g1!.getByRole('button', { name: 'Далее' }).click()

			await host!.getByRole('button', { name: 'Подключить' }).click()
			await submitSignalIn(host!, offer)
			const answer = await readSignalOut(host!)
			await submitSignalIn(g1!, answer)

			// Гость снова на доске, с прежним местом (красный игрок) и текущим состоянием партии.
			await expect(cards(g1!)).toHaveCount(25, { timeout: 20_000 })
			await expect(g1!.getByText('Связь с хостом потеряна')).toBeHidden()
			await expect(g1!.locator('[data-testid="card"][data-revealed="true"]')).toHaveCount(1)
			await expect(g1!.getByText(/игрок/i).first()).toBeVisible()
			// Дубля в ростере не завелось: хост по-прежнему видит четверых и все на связи.
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
			await expect(host!.locator('[data-testid="card"][data-revealed="true"]')).toHaveCount(1, {
				timeout: 20_000,
			})

			// Приложение гостя выгрузили из памяти (iOS так делает регулярно).
			await g1!.reload()
			await g1!.getByRole('button', { name: 'Вернуться в игру' }).click()
			// Доска на месте — с открытой картой и подсказкой из партии, но без связи.
			await expect(cards(g1!)).toHaveCount(25)
			await expect(g1!.locator('[data-testid="card"][data-revealed="true"]')).toHaveCount(1)
			await expect(g1!.getByText('память')).toBeVisible()
			await expect(g1!.getByText('Связь с хостом потеряна')).toBeVisible()

			// Теперь то же самое с хостом — он хранит канон партии.
			await host!.reload()
			await host!.getByRole('button', { name: 'Вернуться в игру' }).click()
			await expect(cards(host!)).toHaveCount(25)
			await expect(host!.locator('[data-testid="card"][data-revealed="true"]')).toHaveCount(1)
			// Ключ капитана тоже восстановлен.
			await expect(host!.locator('[data-testid="card"][data-card-type]')).toHaveCount(25)

			// И гость возвращается в эту же партию через новое рукопожатие.
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
			// В лобби офлайн-игрока хост убирает через 5 секунд — успеваем вернуться раньше.
			await guest!.getByRole('button', { name: 'Переподключиться' }).click()
			const offer = await readSignalOut(guest!)
			await guest!.getByRole('button', { name: 'Далее' }).click()

			await host!.getByRole('button', { name: 'Добавить игрока' }).click()
			await submitSignalIn(host!, offer)
			const answer = await readSignalOut(host!)
			await submitSignalIn(guest!, answer)

			await expect(guest!.getByText('Подключено ✓')).toBeVisible({ timeout: 20_000 })
			// Ростер прежний: двое, гость — синий капитан.
			await expect(host!.getByRole('listitem')).toHaveCount(2)
			await expect(host!.getByRole('listitem').filter({ hasText: 'капитан' })).toHaveCount(2)
		} finally {
			await Promise.all(ctxs.map((c) => c.close()))
		}
	})
})

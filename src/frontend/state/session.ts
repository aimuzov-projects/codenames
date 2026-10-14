import {
	createGame,
	redactStateForRole,
	reducer,
	type GameConfig,
	type GameEvent,
	type GameState,
	type RedactedState,
	type Role,
	type Team,
} from '#frontend/game/index.ts'
import { atom, computed } from '#frontend/lib/atom.ts'

/**
 * Слой сессии. Три режима:
 *  - 'local'  — одно устройство (hot-seat): канон в gameAtom, ключ по кнопке.
 *  - 'host'   — сетевой хост: канон в gameAtom, рассылка состояния гостям (см. net.ts).
 *  - 'guest'  — сетевой клиент: рендер remoteViewAtom, интенты уходят хосту.
 */
export type Mode = 'local' | 'host' | 'guest'

export const modeAtom = atom<Mode>('local')

/** Каноническое состояние партии (режимы local/host). */
export const gameAtom = atom<GameState | null>(null)

/** Состояние, полученное от хоста (режим guest). */
export const remoteViewAtom = atom<RedactedState | null>(null)

/** Назначенная роль игрока (сетевые режимы). */
export const myRoleAtom = atom<Role>('operative')
export const myTeamAtom = atom<Team>('red')

/** Роль, под которой редактируется/отображается поле. */
export const viewRoleAtom = atom<Role>('operative')

/**
 * Причина передачи хода капитану (hot-seat): какое неверное слово открыли в прошлом ходу.
 * Показывается в попапе передачи телефона. null — старт/добровольное завершение хода.
 */
export const handoffReasonAtom = atom<{ word: string; type: 'neutral' | Team } | null>(null)

/**
 * Блокировка попапов на время анимации открытия карты. Пока true — гейт передачи
 * телефона (PassPhone) и оверлей победы (Board) скрыты, чтобы сперва отыграла
 * реакция на открытие (заливка + галочка/крестик, см. CardTile).
 */
export const revealLockedAtom = atom(false)

/** Задержка показа попапа после клика по карте — под длительность анимации открытия. */
const REVEAL_POPUP_DELAY_MS = 1500

export const isHostAtom = computed([modeAtom], () => modeAtom() !== 'guest')

/** Что отображает UI. */
export const viewAtom = computed<RedactedState | null>([modeAtom, remoteViewAtom, gameAtom, viewRoleAtom], () => {
	if (modeAtom() === 'guest') return remoteViewAtom()

	const game = gameAtom()

	return game ? redactStateForRole(game, viewRoleAtom()) : null
})

/** Счёт — из публичной информации (открытые карты + известный расклад 9/8). */
export const scoreAtom = computed<Record<Team, number>>([viewAtom], () => {
	const view = viewAtom()

	if (!view) return { red: 0, blue: 0 }

	const totalRed = view.startingTeam === 'red' ? 9 : 8
	const totalBlue = view.startingTeam === 'blue' ? 9 : 8
	const revealed = (team: Team) => view.cards.filter((c) => c.revealed && c.type === team).length

	return { red: totalRed - revealed('red'), blue: totalBlue - revealed('blue') }
})

export const isOverAtom = computed([viewAtom], () => viewAtom()?.phase === 'over')

// --- Сетевые хуки (регистрируются net.ts, чтобы избежать циклической зависимости) ---
let intentSender: ((event: GameEvent) => void) | null = null
let hostSubmit: ((senderId: string, event: GameEvent) => void) | null = null

export function setIntentSender(fn: ((event: GameEvent) => void) | null) {
	intentSender = fn
}
export function setHostSubmit(fn: ((senderId: string, event: GameEvent) => void) | null) {
	hostSubmit = fn
}

/** Применяет событие к канону (только local/host). Возвращает true, если состояние есть. */
export function applyEvent(event: GameEvent) {
	const game = gameAtom()

	if (!game) return false

	gameAtom.set(reducer(game, event, Date.now()))

	return true
}

/** Действие игрока из UI. Маршрутизируется по режиму. */
const playerAction = (event: GameEvent) => {
	const mode = modeAtom()

	if (mode === 'guest') {
		intentSender?.(event)
	} else if (mode === 'host') {
		hostSubmit?.('host', event) // хост — тоже игрок с id 'host'
	} else {
		applyEvent(event)
	}
}

/** Начинает новую партию на этом устройстве: поле открыто под игроком, причина передачи хода сброшена. */
export function startGame(config: GameConfig) {
	gameAtom.set(createGame(config))
	viewRoleAtom.set('operative')
	handoffReasonAtom.set(null)
}

export function giveClue(word: string, count: number) {
	playerAction({ type: 'GIVE_CLUE', word, count })

	if (modeAtom() === 'local') viewRoleAtom.set('operative') // hot-seat: прячем ключ
}

export function revealCard(index: number) {
	const before = gameAtom()

	playerAction({ type: 'REVEAL_CARD', index })

	if (modeAtom() === 'local' && before?.phase === 'guess') {
		const after = gameAtom()
		const card = after?.cards[index]
		const turnPassed = !!after && after.phase === 'clue' && after.currentTeam !== before.currentTeam

		// Ход перешёл из-за неверной карты (чужая или нейтральная, не ассасин) — покажем её в попапе.
		handoffReasonAtom.set(
			turnPassed && card && card.type !== before.currentTeam && card.type !== 'assassin'
				? { word: card.word, type: card.type as 'neutral' | Team }
				: null,
		)

		// Попап (передача хода / победа) откладываем до конца анимации открытия карты.
		if (turnPassed || after?.phase === 'over') {
			revealLockedAtom.set(true)
			setTimeout(() => revealLockedAtom.set(false), REVEAL_POPUP_DELAY_MS)
		}
	}
}

export function endTurn() {
	handoffReasonAtom.set(null)
	playerAction({ type: 'END_TURN' })
}

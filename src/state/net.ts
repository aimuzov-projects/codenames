import { action, addChangeHook, atom, wrap } from '@reatom/core'
import {
	createGame,
	redactStateForRole,
	type GameConfig,
	type GameEvent,
	type Role,
	type Team,
} from '@/game/index.ts'
import { HostHub } from '@/transport/hostHub.ts'
import { GuestConnection } from '@/transport/webrtc.ts'
import { WsGuestTransport, WsHostTransport } from '@/transport/wsRelay.ts'
import type { GuestTransport, HostTransport } from '@/transport/types.ts'
import type { ClientMessage, HostMessage, PlayerInfo } from '@/transport/messages.ts'
import { RELAY_URL } from '@/lib/relay.ts'
import { deviceId } from './deviceId.ts'
import {
	clearSnapshot,
	loadSnapshot,
	saveSnapshot,
	type SessionSnapshot,
} from './persistSession.ts'
import { validateIntent } from './validateIntent.ts'
import { E2E } from '@/lib/e2e.ts'
import { pickSlot, reshuffleRoster, resolveSetup } from './roster.ts'
import {
	applyEvent,
	gameAtom,
	modeAtom,
	myRoleAtom,
	myTeamAtom,
	remoteViewAtom,
	setHostSubmit,
	setIntentSender,
	viewRoleAtom,
} from './session.ts'
import { goTo, goToJoin } from './ui.ts'

export const HOST_ID = 'host'

export const rosterAtom = atom<PlayerInfo[]>([], 'roster')
export const myIdAtom = atom<string>(HOST_ID, 'myId')
export const myNameAtom = atom<string>('', 'myName')
export const startedAtom = atom<boolean>(false, 'started')
export const connStatusAtom = atom<'idle' | 'connecting' | 'connected' | 'error'>(
	'idle',
	'connStatus',
)

/**
 * Соединения, чей `hello` уже дошёл до хоста (экран «Добавить игрока» ждёт по этому списку:
 * игрока в ростере до `hello` ещё нет, потому что его id приходит именно в этом сообщении).
 */
export const joinedConnIdsAtom = atom<string[]>([], 'joinedConnIds')

/**
 * Транспорт партии: 'qr' — WebRTC с рукопожатием через камеру (работает без интернета, на одном
 * хотспоте), 'relay' — комната на WS-сервере (нужен интернет, зато переподключается сама).
 */
export type Transport = 'qr' | 'relay'

export const transportAtom = atom<Transport>('qr', 'transport')
/** Код комнаты на релее: у хоста приходит с сервера, у гостя — введён или отсканирован. */
export const roomCodeAtom = atom<string>('', 'roomCode')

let hub: HostTransport | null = null
let guest: GuestTransport | null = null

// ---------- helpers ----------
function patchRoster(id: string, patch: Partial<PlayerInfo>) {
	rosterAtom.set(rosterAtom().map((p) => (p.id === id ? { ...p, ...patch } : p)))
}

// ---------- связка соединения и игрока (хост) ----------
// За партию у одного игрока может смениться несколько соединений (переподключение после сна),
// поэтому транспортный connId и игровой playerId живут отдельно.
const playerByConn = new Map<string, string>()
const connByPlayer = new Map<string, string>()

function bindConn(connId: string, playerId: string) {
	const prev = connByPlayer.get(playerId)
	if (prev !== undefined && prev !== connId) playerByConn.delete(prev)
	playerByConn.set(connId, playerId)
	connByPlayer.set(playerId, connId)
	joinedConnIdsAtom.set([...joinedConnIdsAtom(), connId])
}

/** Снимает привязку закрытого соединения; возвращает игрока, если тот действительно ушёл. */
function unbindConn(connId: string): string | null {
	const playerId = playerByConn.get(connId)
	playerByConn.delete(connId)
	joinedConnIdsAtom.set(joinedConnIdsAtom().filter((c) => c !== connId))
	// Старое соединение может закрыться уже после того, как игрок вернулся через новое
	// (обрыв WebRTC замечают с задержкой). Тогда привязка указывает на живой канал — не трогаем.
	if (playerId === undefined || connByPlayer.get(playerId) !== connId) return null
	connByPlayer.delete(playerId)
	return playerId
}

// ---------- отложенное удаление офлайн-игрока из лобби ----------
// Полминуты — чтобы уснувший в лобби успел вернуться на своё место (рукопожатие по QR не мгновенное).
// Старт партии офлайн-игроки не блокируют: isRosterReady смотрит только на подключённых.
const OFFLINE_REMOVAL_MS = 30_000
const removalTimers = new Map<string, ReturnType<typeof setTimeout>>()

function removePlayer(id: string) {
	rosterAtom.set(rosterAtom().filter((p) => p.id !== id))
}

function clearRemovalTimer(id: string) {
	const t = removalTimers.get(id)
	if (t !== undefined) {
		clearTimeout(t)
		removalTimers.delete(id)
	}
}

function scheduleRemoval(id: string) {
	clearRemovalTimer(id)
	const timer = setTimeout(() => {
		removalTimers.delete(id)
		const p = rosterAtom().find((p) => p.id === id)
		// Удаляем только если всё ещё в лобби и игрок всё ещё офлайн.
		if (!startedAtom() && p && !p.connected) {
			removePlayer(id)
			broadcastLobby()
		}
	}, OFFLINE_REMOVAL_MS)
	removalTimers.set(id, timer)
}

function roleOf(id: string): Role {
	return rosterAtom().find((p) => p.id === id)?.role ?? 'operative'
}

// ---------- пульс ----------
/**
 * Уснувшее устройство замораживает вебвью, и канал нередко умирает молча — без close.
 * Поэтому обе стороны раз в HEARTBEAT_MS шлют `ping` и считают связь потерянной, если
 * собеседник молчит дольше SILENCE_MS. Признак мягкий: пришедшее сообщение сразу возвращает
 * связь в строй, соединение мы при этом не закрываем.
 */
const HEARTBEAT_MS = 5000
const SILENCE_MS = 20_000

let heartbeat: ReturnType<typeof setInterval> | null = null
const lastSeen = new Map<string, number>()

function stopHeartbeat() {
	if (heartbeat !== null) clearInterval(heartbeat)
	heartbeat = null
	lastSeen.clear()
}

function startHeartbeat(tick: () => void) {
	stopHeartbeat()
	heartbeat = setInterval(tick, HEARTBEAT_MS)
}

function silentFor(key: string, now: number): boolean {
	const seen = lastSeen.get(key)
	return seen !== undefined && now - seen > SILENCE_MS
}

// ================= ХОСТ =================
export const startHosting = action(
	(name: string, team: Team, role: Role, transport: Transport = 'qr') => {
		modeAtom.set('host')
		myIdAtom.set(HOST_ID)
		myNameAtom.set(name)
		myTeamAtom.set(team)
		myRoleAtom.set(role)
		viewRoleAtom.set(role)
		startedAtom.set(false)
		gameAtom.set(null)
		rosterAtom.set([{ id: HOST_ID, name, team, role, connected: true }])
		transportAtom.set(transport)
		roomCodeAtom.set('')

		openHostHub()
		setHostSubmit(hostSubmit)
		setIntentSender(null)
	},
	'startHosting',
)

/** Поднимает транспорт хоста и его обработчики (общее для нового хостинга и восстановления). */
function openHostHub() {
	hub?.close()
	hub =
		transportAtom() === 'relay'
			? new WsHostTransport(
					RELAY_URL,
					roomCodeAtom() || null,
					(code) => roomCodeAtom.set(code),
					hostRelayFatal,
				)
			: new HostHub()
	// onConnect не трогаем: пока не пришёл `hello`, мы не знаем, кто именно подключился.
	hub.onDisconnect((connId) => {
		const playerId = unbindConn(connId)
		if (playerId === null) return
		patchRoster(playerId, { connected: false })
		broadcastLobby()
		if (!startedAtom()) scheduleRemoval(playerId)
	})
	hub.onMessage(handleClientMessage)
	startHeartbeat(hostHeartbeat)
}

/** Комнату занял кто-то другой — код придётся получить заново (партия при этом цела). */
function hostRelayFatal() {
	roomCodeAtom.set('')
}

/** Пульс хоста: рассылает `ping` и переводит замолчавших игроков в офлайн. */
function hostHeartbeat() {
	hub?.broadcast({ t: 'ping' })
	const now = Date.now()
	let changed = false
	for (const [connId, playerId] of playerByConn) {
		if (!silentFor(connId, now)) continue
		if (rosterAtom().find((p) => p.id === playerId)?.connected === false) continue
		patchRoster(playerId, { connected: false })
		changed = true
	}
	if (changed) broadcastLobby()
}

/** Принимает offer гостя (из QR/строки); возвращает id соединения и answer-код для показа гостю. */
export const acceptGuestOffer = action(async (offerCode: string) => {
	if (!(hub instanceof HostHub)) throw new Error('Рукопожатие по QR недоступно в этом режиме')
	return await wrap(hub.acceptGuest(offerCode))
}, 'acceptGuestOffer')

function handleClientMessage(connId: string, msg: ClientMessage) {
	lastSeen.set(connId, Date.now())
	if (msg.t === 'hello') {
		welcomePlayer(connId, msg.id, msg.name)
		return
	}
	const playerId = playerByConn.get(connId)
	if (playerId === undefined) return // сообщение до `hello` — отправителя ещё не знаем
	// Заговорил тот, кого пульс успел записать в офлайн (связь только подвисала) — возвращаем.
	if (rosterAtom().find((p) => p.id === playerId)?.connected === false) {
		clearRemovalTimer(playerId)
		patchRoster(playerId, { connected: true })
		broadcastLobby()
	}
	switch (msg.t) {
		case 'ping':
			break
		case 'setup':
			patchRoster(playerId, resolveSetup(rosterAtom(), playerId, msg.team, msg.role))
			broadcastLobby()
			break
		case 'intent':
			hostSubmit(playerId, msg.event)
			break
	}
}

/**
 * Заводит нового игрока или возвращает знакомого (переподключение после обрыва/сна) на его
 * прежнее место — с той же командой и ролью, сразу с актуальным состоянием партии.
 */
function welcomePlayer(connId: string, playerId: string, name: string) {
	clearRemovalTimer(playerId)
	bindConn(connId, playerId)
	const patch = { name: name || 'Игрок', connected: true }
	if (rosterAtom().some((p) => p.id === playerId)) {
		patchRoster(playerId, patch)
	} else {
		const slot = pickSlot(rosterAtom())
		rosterAtom.set([...rosterAtom(), { id: playerId, ...slot, ...patch }])
	}
	hub?.send(connId, { t: 'welcome', youId: playerId })
	broadcastLobby()
	sendStateTo(playerId)
}

function hostSubmit(senderId: string, event: GameEvent) {
	const game = gameAtom()
	if (!game || !validateIntent(rosterAtom(), game, senderId, event)) return
	applyEvent(event)
	broadcastState()
}

function broadcastLobby() {
	hub?.broadcast({ t: 'lobby', players: rosterAtom(), started: startedAtom() })
}

function sendStateTo(playerId: string) {
	const game = gameAtom()
	const connId = connByPlayer.get(playerId)
	if (!game || connId === undefined) return
	hub?.send(connId, { t: 'state', state: redactStateForRole(game, roleOf(playerId)) })
}

function broadcastState() {
	if (!gameAtom()) return
	for (const playerId of connByPlayer.keys()) sendStateTo(playerId)
}

/** Хост настраивает свою команду/роль. */
export const setHostSetup = action((team: Team, role: Role) => {
	const resolved = resolveSetup(rosterAtom(), HOST_ID, team, role)
	myTeamAtom.set(resolved.team)
	myRoleAtom.set(resolved.role)
	viewRoleAtom.set(resolved.role)
	patchRoster(HOST_ID, resolved)
	broadcastLobby()
}, 'setHostSetup')

/** Хост перетасовывает весь состав (команды и роли) с соблюдением баланса. */
export const hostReshuffle = action(() => {
	const next = reshuffleRoster(rosterAtom())
	rosterAtom.set(next)
	const me = next.find((p) => p.id === HOST_ID)
	if (me) {
		myTeamAtom.set(me.team)
		myRoleAtom.set(me.role)
		viewRoleAtom.set(me.role)
	}
	broadcastLobby()
}, 'hostReshuffle')

/** Хост запускает партию. */
export const hostStartGame = action((config: GameConfig) => {
	gameAtom.set(createGame(config))
	startedAtom.set(true)
	broadcastLobby()
	broadcastState()
	goTo('board')
}, 'hostStartGame')

// ================= ГОСТЬ =================
export const startJoining = action(
	(name: string, options: { transport?: Transport; code?: string } = {}) => {
		modeAtom.set('guest')
		myNameAtom.set(name)
		myIdAtom.set(deviceId())
		remoteViewAtom.set(null)
		rosterAtom.set([])
		startedAtom.set(false)
		transportAtom.set(options.transport ?? 'qr')
		roomCodeAtom.set(options.code ?? '')
		openGuestConnection()
	},
	'startJoining',
)

/** Создаёт гостевое соединение, не трогая уже накопленное состояние (см. также guestReconnect). */
function openGuestConnection() {
	guest?.close()
	connStatusAtom.set('connecting')

	guest =
		transportAtom() === 'relay'
			? new WsGuestTransport(RELAY_URL, roomCodeAtom(), myIdAtom(), guestRelayFatal)
			: new GuestConnection<HostMessage, ClientMessage>()
	// Подписки — до рукопожатия.
	guest.onMessage(handleHostMessage)
	guest.onOpen(() => {
		connStatusAtom.set('connected')
		lastSeen.set(HOST_ID, Date.now())
		guest?.send({ t: 'hello', id: myIdAtom(), name: myNameAtom() })
	})
	guest.onClose(() => connStatusAtom.set('error'))
	startHeartbeat(guestHeartbeat)

	setIntentSender((event) => guest?.send({ t: 'intent', event }))
	setHostSubmit(null)
}

/** Комнаты с таким кодом нет (опечатка или хост давно ушёл) — дальше пробовать бессмысленно. */
function guestRelayFatal() {
	connStatusAtom.set('error')
	guest?.close()
	guest = null
	stopHeartbeat()
}

/** Пульс гостя: отмечается сам и следит, не замолчал ли хост. */
function guestHeartbeat() {
	guest?.send({ t: 'ping' })
	if (connStatusAtom() === 'connected' && silentFor(HOST_ID, Date.now())) {
		connStatusAtom.set('error')
	}
}

/**
 * Гость переподключается после обрыва (сон устройства, потеря сети). В отличие от startJoining
 * ничего не сбрасывает: доска, ростер и id остаются на экране, пока идёт новое рукопожатие —
 * хост узнает игрока по тому же id и вернёт его на место.
 */
export const guestReconnect = action(() => {
	openGuestConnection()
}, 'guestReconnect')

/** Гость создаёт offer-код для показа хосту (только режим QR). */
export const guestCreateOffer = action(async () => {
	if (!(guest instanceof GuestConnection)) throw new Error('Подключение не начато')
	return await wrap(guest.createOfferCode())
}, 'guestCreateOffer')

/** Гость принимает answer-код хоста; после этого канал откроется (только режим QR). */
export const guestAcceptAnswer = action(async (answerCode: string) => {
	if (!(guest instanceof GuestConnection)) throw new Error('Подключение не начато')
	await wrap(guest.acceptAnswerCode(answerCode))
}, 'guestAcceptAnswer')

/** Гость выбирает команду/роль и сообщает хосту. */
export const guestSetup = action((team: Team, role: Role) => {
	const resolved = resolveSetup(rosterAtom(), myIdAtom(), team, role)
	myTeamAtom.set(resolved.team)
	myRoleAtom.set(resolved.role)
	guest?.send({ t: 'setup', team: resolved.team, role: resolved.role })
}, 'guestSetup')

function handleHostMessage(msg: HostMessage) {
	lastSeen.set(HOST_ID, Date.now())
	// Хост снова на связи: подвисший канал ожил (или пульс поспешил объявить его мёртвым).
	if (connStatusAtom() !== 'connected' && guest?.open) connStatusAtom.set('connected')
	switch (msg.t) {
		case 'ping':
			break
		case 'welcome':
			myIdAtom.set(msg.youId)
			break
		case 'lobby': {
			rosterAtom.set(msg.players)
			startedAtom.set(msg.started)
			const me = msg.players.find((p) => p.id === myIdAtom())
			if (me) {
				myTeamAtom.set(me.team)
				myRoleAtom.set(me.role)
			}
			// На доску гостя переводит приход состояния (см. 'state' ниже) — там уже есть, что
			// показать. По одному lobby переходить нельзя: состояние ещё в пути, доска оказалась бы
			// пустой (view === null) и Board выкинул бы гостя в меню. Если состояние уже получено
			// (повторный lobby во время партии), держим гостя на доске.
			if (msg.started && remoteViewAtom() != null) goTo('board')
			break
		}
		case 'state':
			remoteViewAtom.set(msg.state)
			startedAtom.set(true)
			goTo('board')
			break
	}
}

// ================= общий выход =================
export const leaveSession = action(() => {
	for (const t of removalTimers.values()) clearTimeout(t)
	removalTimers.clear()
	playerByConn.clear()
	connByPlayer.clear()
	joinedConnIdsAtom.set([])
	stopHeartbeat()
	hub?.close()
	guest?.close()
	hub = null
	guest = null
	setHostSubmit(null)
	setIntentSender(null)
	modeAtom.set('local')
	rosterAtom.set([])
	startedAtom.set(false)
	connStatusAtom.set('idle')
	gameAtom.set(null)
	remoteViewAtom.set(null)
}, 'leaveSession')

// ================= восстановление после перезапуска =================
/**
 * Сетевую партию держим в localStorage: iOS выгружает PWA из памяти, и без снимка возврат
 * в приложение означал бы потерю партии — у хоста вместе с каноном, то есть для всех сразу.
 */
export const savedSessionAtom = atom<SessionSnapshot | null>(loadSnapshot(), 'savedSession')

function saveSession() {
	if (modeAtom() === 'local') {
		clearSnapshot()
		savedSessionAtom.set(null)
		return
	}
	const snap = {
		mode: modeAtom() as 'host' | 'guest',
		transport: transportAtom(),
		code: roomCodeAtom(),
		id: myIdAtom(),
		name: myNameAtom(),
		team: myTeamAtom(),
		role: myRoleAtom(),
		roster: rosterAtom(),
		started: startedAtom(),
		game: modeAtom() === 'host' ? gameAtom() : null,
		view: modeAtom() === 'guest' ? remoteViewAtom() : null,
	}
	savedSessionAtom.set(saveSnapshot(snap))
}

for (const source of [modeAtom, gameAtom, remoteViewAtom, rosterAtom, startedAtom, roomCodeAtom]) {
	addChangeHook(source, saveSession)
}

/**
 * Возвращает игрока в сохранённую партию. Хост поднимает хаб и ждёт, пока гости подключатся
 * заново (их соединения перезапуск не пережили); гость оказывается на своей доске со статусом
 * «связь потеряна» и кнопкой переподключения.
 */
export const resumeSession = action(() => {
	const snap = savedSessionAtom()
	if (!snap) return false

	modeAtom.set(snap.mode)
	transportAtom.set(snap.transport)
	roomCodeAtom.set(snap.code)
	myIdAtom.set(snap.id)
	myNameAtom.set(snap.name)
	myTeamAtom.set(snap.team)
	myRoleAtom.set(snap.role)
	viewRoleAtom.set(snap.role)
	startedAtom.set(snap.started)
	// Живых соединений после перезапуска нет ни у кого, кроме нас самих.
	rosterAtom.set(snap.roster.map((p) => ({ ...p, connected: p.id === snap.id })))

	if (snap.mode === 'host') {
		gameAtom.set(snap.game)
		remoteViewAtom.set(null)
		connStatusAtom.set('idle')
		openHostHub()
		setHostSubmit(hostSubmit)
		setIntentSender(null)
		goTo(snap.started ? 'board' : 'host')
	} else {
		gameAtom.set(null)
		remoteViewAtom.set(snap.view)
		setHostSubmit(null)
		setIntentSender(null)
		if (snap.transport === 'relay') {
			// Комната и id известны — гость возвращается в партию сам, без единого действия.
			openGuestConnection()
			goTo(snap.started && snap.view ? 'board' : 'join')
		} else {
			connStatusAtom.set('error')
			if (snap.started && snap.view) goTo('board')
			else goToJoin('reconnect')
		}
	}
	return true
}, 'resumeSession')

// e2e-хук: обрывает канал у гостя. Усыпить устройство в тесте нельзя, а последствия сна —
// именно такие: канал закрывается, состояние партии на экране остаётся. Под VITE_E2E.
if (E2E) {
	;(window as unknown as { __e2eDropLink?: () => void }).__e2eDropLink = () => guest?.close()
}

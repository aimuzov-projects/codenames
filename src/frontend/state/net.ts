import {
	createGame,
	redactStateForRole,
	type GameConfig,
	type GameEvent,
	type Role,
	type Team,
} from '#frontend/game/index.ts'
import { atom, onChange } from '#frontend/lib/atom.ts'
import { E2E } from '#frontend/lib/e2e.ts'
import { relayUrl } from '#frontend/lib/relay.ts'
import { deviceId } from '#frontend/state/device-id.ts'
import { clearSnapshot, loadSnapshot, saveSnapshot, type SessionSnapshot } from '#frontend/state/persist-session.ts'
import { pickSlot, reshuffleRoster, resolveSetup } from '#frontend/state/roster.ts'
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
} from '#frontend/state/session.ts'
import { goTo, goToJoin } from '#frontend/state/ui.ts'
import { validateIntent } from '#frontend/state/validate-intent.ts'
import { HostHub } from '#frontend/transport/host-hub.ts'
import type { ClientMessage, HostMessage, PlayerInfo } from '#frontend/transport/messages.ts'
import type { GuestTransport, HostTransport } from '#frontend/transport/types.ts'
import { GuestConnection } from '#frontend/transport/webrtc.ts'
import { WsGuestTransport, WsHostTransport } from '#frontend/transport/ws-relay.ts'

export const HOST_ID = 'host'

/** Guest side of the QR handshake: besides the channel, it can issue an offer and accept an answer. */
type QrGuest = GuestTransport & {
	createOfferCode(): Promise<string>
	acceptAnswerCode(code: string): Promise<void>
}

/**
 * Where QR-mode transports come from. Unit tests swap the factories for fakes: Node has no
 * WebRTC, and the lobby and game logic only needs a channel we can poke by hand.
 */
export const qrTransports = {
	host: () => new HostHub(),
	guest: (): QrGuest => new GuestConnection<HostMessage, ClientMessage>(),
}

export const rosterAtom = atom<PlayerInfo[]>([])
export const myIdAtom = atom<string>(HOST_ID)
export const myNameAtom = atom<string>('')
export const startedAtom = atom<boolean>(false)
export const connStatusAtom = atom<'idle' | 'connecting' | 'connected' | 'error'>('idle')

/**
 * Connections whose `hello` has already reached the host (the "Add player" screen waits on this list:
 * the player isn't in the roster before `hello`, because their id arrives in exactly that message).
 */
export const joinedConnIdsAtom = atom<string[]>([])

/**
 * Game transport: 'qr' is WebRTC with a camera handshake (works offline, on a single hotspot),
 * 'relay' is a room on the WS server (needs internet, but reconnects on its own).
 */
export type Transport = 'qr' | 'relay'

export const transportAtom = atom<Transport>('qr')
/** Relay room code: the host gets it from the server, the guest types or scans it. */
export const roomCodeAtom = atom<string>('')

let hub: HostTransport | null = null
let guest: GuestTransport | null = null
/** Same guest channel while the game runs over QR: only it has offer and answer. */
let qrGuest: QrGuest | null = null

// ---------- helpers ----------
function patchRoster(id: string, patch: Partial<PlayerInfo>) {
	rosterAtom.set(rosterAtom().map((p) => (p.id === id ? { ...p, ...patch } : p)))
}

// ---------- connection-to-player binding (host) ----------
// A player can go through several connections during a game (reconnecting after sleep),
// so the transport connId and the game playerId are kept separate.
const playerByConn = new Map<string, string>()
const connByPlayer = new Map<string, string>()

function bindConn(connId: string, playerId: string) {
	const prev = connByPlayer.get(playerId)

	if (prev !== undefined && prev !== connId) playerByConn.delete(prev)

	playerByConn.set(connId, playerId)
	connByPlayer.set(playerId, connId)
	joinedConnIdsAtom.set([...joinedConnIdsAtom(), connId])
}

/** Unbinds a closed connection; returns the player if they've actually left. */
function unbindConn(connId: string): string | null {
	const playerId = playerByConn.get(connId)

	playerByConn.delete(connId)
	joinedConnIdsAtom.set(joinedConnIdsAtom().filter((c) => c !== connId))

	// The old connection may close after the player has already come back through a new one
	// (a WebRTC drop is noticed with a delay). Then the binding points to a live channel, leave it.
	if (playerId === undefined || connByPlayer.get(playerId) !== connId) return null

	connByPlayer.delete(playerId)

	return playerId
}

// ---------- delayed removal of an offline player from the lobby ----------
// Half a minute, so whoever fell asleep in the lobby can get back to their seat (QR handshake isn't instant).
// Offline players don't block the game start: isRosterReady only looks at connected ones.
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

		// Remove only if we're still in the lobby and the player is still offline.
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

// ---------- heartbeat ----------
/**
 * A sleeping device freezes the webview, and the channel often dies silently, without close.
 * So both sides send `ping` every HEARTBEAT_MS and consider the link lost if the other side
 * stays silent longer than SILENCE_MS. It's a soft signal: any incoming message brings the link
 * right back, and we don't close the connection.
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

// ================= HOST =================
export function startHosting(name: string, team: Team, role: Role, transport: Transport = 'qr') {
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
}

/** Brings up the host transport and its handlers (shared by fresh hosting and restore). */
function openHostHub() {
	hub?.close()

	hub =
		transportAtom() === 'relay'
			? new WsHostTransport(relayUrl(), roomCodeAtom() || null, (code) => roomCodeAtom.set(code), hostRelayFatal)
			: qrTransports.host()

	// We skip onConnect: until `hello` arrives, we don't know who exactly connected.
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

/** Someone else took the room, so we'll have to get a new code (the game itself is intact). */
function hostRelayFatal() {
	roomCodeAtom.set('')
}

/** Host heartbeat: broadcasts `ping` and marks players who went silent as offline. */
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

/** Accepts a guest offer (from QR/string); returns the connection id and the answer code to show the guest. */
export async function acceptGuestOffer(offerCode: string) {
	if (!(hub instanceof HostHub)) throw new Error('Рукопожатие по QR недоступно в этом режиме')

	return await hub.acceptGuest(offerCode)
}

function handleClientMessage(connId: string, msg: ClientMessage) {
	lastSeen.set(connId, Date.now())

	if (msg.t === 'hello') {
		welcomePlayer(connId, msg.id, msg.name)

		return
	}

	const playerId = playerByConn.get(connId)

	if (playerId === undefined) return // message before `hello`, we don't know the sender yet

	// Someone the heartbeat already marked offline is talking (the link only stalled), bring them back.
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
 * Adds a new player or puts a known one (reconnecting after a drop/sleep) back in their old seat,
 * with the same team and role, and sends them the current game state right away.
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

/** Host sets their own team/role. */
export function setHostSetup(team: Team, role: Role) {
	const resolved = resolveSetup(rosterAtom(), HOST_ID, team, role)

	myTeamAtom.set(resolved.team)
	myRoleAtom.set(resolved.role)
	viewRoleAtom.set(resolved.role)
	patchRoster(HOST_ID, resolved)
	broadcastLobby()
}

/** Host reshuffles the whole roster (teams and roles), keeping it balanced. */
export function hostReshuffle() {
	const next = reshuffleRoster(rosterAtom())

	rosterAtom.set(next)
	const me = next.find((p) => p.id === HOST_ID)

	if (me) {
		myTeamAtom.set(me.team)
		myRoleAtom.set(me.role)
		viewRoleAtom.set(me.role)
	}

	broadcastLobby()
}

/** Host starts the game. */
export function hostStartGame(config: GameConfig) {
	gameAtom.set(createGame(config))
	startedAtom.set(true)
	broadcastLobby()
	broadcastState()
	goTo('board')
}

// ================= GUEST =================
export function startJoining(name: string, options: { transport?: Transport; code?: string } = {}) {
	modeAtom.set('guest')
	myNameAtom.set(name)
	myIdAtom.set(deviceId())
	remoteViewAtom.set(null)
	rosterAtom.set([])
	startedAtom.set(false)
	transportAtom.set(options.transport ?? 'qr')
	roomCodeAtom.set(options.code ?? '')
	openGuestConnection()
}

/** Creates the guest connection without touching the state collected so far (see also guestReconnect). */
function openGuestConnection() {
	guest?.close()
	connStatusAtom.set('connecting')

	qrGuest = transportAtom() === 'relay' ? null : qrTransports.guest()
	guest = qrGuest ?? new WsGuestTransport(relayUrl(), roomCodeAtom(), myIdAtom(), guestRelayFatal)
	// Subscribe before the handshake.
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

/** No room with this code (a typo or the host left long ago), no point in retrying. */
function guestRelayFatal() {
	connStatusAtom.set('error')
	guest?.close()
	guest = null
	qrGuest = null
	stopHeartbeat()
}

/** Guest heartbeat: checks in and watches whether the host went silent. */
function guestHeartbeat() {
	guest?.send({ t: 'ping' })

	if (connStatusAtom() === 'connected' && silentFor(HOST_ID, Date.now())) {
		connStatusAtom.set('error')
	}
}

/**
 * Guest reconnects after a drop (device sleep, network loss). Unlike startJoining it resets
 * nothing: the board, roster and id stay on screen during the new handshake, and the host
 * will recognize the player by the same id and put them back in their seat.
 */
export function guestReconnect() {
	openGuestConnection()
}

/** Guest creates the offer code to show the host (QR mode only). */
export async function guestCreateOffer() {
	if (!qrGuest) throw new Error('Подключение не начато')

	return await qrGuest.createOfferCode()
}

/** Guest accepts the host's answer code; the channel opens after that (QR mode only). */
export async function guestAcceptAnswer(answerCode: string) {
	if (!qrGuest) throw new Error('Подключение не начато')

	await qrGuest.acceptAnswerCode(answerCode)
}

/** Guest picks a team/role and tells the host. */
export function guestSetup(team: Team, role: Role) {
	const resolved = resolveSetup(rosterAtom(), myIdAtom(), team, role)

	myTeamAtom.set(resolved.team)
	myRoleAtom.set(resolved.role)
	guest?.send({ t: 'setup', team: resolved.team, role: resolved.role })
}

function handleHostMessage(msg: HostMessage) {
	lastSeen.set(HOST_ID, Date.now())

	// Host is back: a stalled channel came alive (or the heartbeat declared it dead too early).
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

			// The guest goes to the board when the state arrives (see 'state' below), then there's
			// something to show. We can't switch on lobby alone: the state is still in flight, the board
			// would be empty (view === null) and Board would kick the guest to the menu. If the state is
			// already here (a repeated lobby mid-game), we keep the guest on the board.
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

// ================= common exit =================
export function leaveSession() {
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
}

// ================= restore after restart =================
/**
 * We keep the network game in localStorage: iOS unloads the PWA from memory, and without a snapshot
 * coming back to the app would mean losing the game. On the host that is the canonical state, i.e. for everyone.
 */
export const savedSessionAtom = atom<SessionSnapshot | null>(loadSnapshot())

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
	onChange(source, saveSession)
}

/**
 * Returns the player to the saved game. The host brings up the hub and waits for guests to
 * reconnect (their connections didn't survive the restart); the guest lands on their board with
 * the "connection lost" status and a reconnect button.
 */
export function resumeSession() {
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
	// After a restart nobody has a live connection except ourselves.
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
			// Room and id are known, so the guest rejoins on their own, without a single tap.
			openGuestConnection()
			goTo(snap.started && snap.view ? 'board' : 'join')
		} else {
			connStatusAtom.set('error')

			if (snap.started && snap.view) goTo('board')
			else goToJoin('reconnect')
		}
	}

	return true
}

// e2e hook: drops the guest's channel. We can't put a device to sleep in a test, and sleep has
// exactly this effect: the channel closes, the game state stays on screen. Behind PUBLIC_E2E.
if (E2E) {
	;(window as unknown as { __e2eDropLink?: () => void }).__e2eDropLink = () => guest?.close()
}

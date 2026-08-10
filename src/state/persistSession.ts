import type { GameState, RedactedState, Role, Team } from '@/game/index.ts'
import type { PlayerInfo } from '@/transport/messages.ts'

/**
 * Снимок сетевой партии в localStorage. Нужен, потому что iOS выгружает PWA из памяти:
 * без него разбуженное через час приложение открывалось бы на главном экране, а партия
 * (у хоста — канон, у гостя — последний вид) пропадала бесследно.
 *
 * Хранилище — чистое: собирает и восстанавливает снимок net.ts, здесь только формат и I/O.
 */
const KEY = 'codenames.session'
const VERSION = 1
/** Дольше суток партию не воскрешаем — это уже не «вернуться в игру», а мусор. */
const TTL_MS = 24 * 60 * 60 * 1000

export interface SessionSnapshot {
	v: number
	ts: number
	mode: 'host' | 'guest'
	/** Чем играли: 'qr' (WebRTC на одной сети) или 'relay' (комната на сервере). */
	transport: 'qr' | 'relay'
	/** Код комнаты релея — по нему хост занимает её обратно, а гость входит без лишних вопросов. */
	code: string
	id: string
	name: string
	team: Team
	role: Role
	roster: PlayerInfo[]
	started: boolean
	/** Канон партии — только у хоста. */
	game: GameState | null
	/** Последний присланный хостом вид — только у гостя. */
	view: RedactedState | null
}

export function loadSnapshot(): SessionSnapshot | null {
	try {
		const raw = localStorage.getItem(KEY)
		if (!raw) return null
		const snap = JSON.parse(raw) as SessionSnapshot
		if (snap.v !== VERSION || Date.now() - snap.ts > TTL_MS) {
			clearSnapshot()
			return null
		}
		return snap
	} catch {
		return null
	}
}

/** Сохраняет снимок и возвращает его в полном виде (с версией и меткой времени). */
export function saveSnapshot(snap: Omit<SessionSnapshot, 'v' | 'ts'>): SessionSnapshot {
	const full: SessionSnapshot = { ...snap, v: VERSION, ts: Date.now() }
	try {
		localStorage.setItem(KEY, JSON.stringify(full))
	} catch {
		// приватный режим / переполнение — переживём перезапуск без восстановления
	}
	return full
}

export function clearSnapshot() {
	try {
		localStorage.removeItem(KEY)
	} catch {
		// см. выше
	}
}

import type { ClientMessage, HostMessage } from './messages.ts'

/**
 * Конверт сообщений WS-релея. Сервер — тупой маршрутизатор: он знает только комнаты, кто в них
 * хост и кто гости, а `data` (игровые ClientMessage/HostMessage) не разбирает.
 *
 * Формат общий для сервера (server/index.ts) и клиента (wsRelay.ts), поэтому лежит в src:
 * сервер импортирует его отсюда, чтобы стороны не разъезжались.
 */

/** Гость→сервер и хост→сервер. */
export type RelayIn =
	/** Хост открывает комнату; `code` — вернуться в свою после обрыва или перезапуска. */
	| { t: 'host'; code?: string }
	/** Гость входит в комнату под своим id устройства. */
	| { t: 'join'; code: string; id: string }
	/** Переслать полезную нагрузку: хост указывает id гостя, гость — всегда хосту. */
	| { t: 'to'; to?: string; data: ClientMessage | HostMessage }

/** Сервер→клиенту. */
export type RelayOut =
	/** Комната открыта (хосту). */
	| { t: 'hosting'; code: string }
	/** Вход выполнен (гостю). */
	| { t: 'joined'; code: string }
	/** Полезная нагрузка от собеседника: гостю приходит от 'host'. */
	| { t: 'from'; from: string; data: ClientMessage | HostMessage }
	/** Хосту — гость появился или пропал. */
	| { t: 'peer'; id: string; online: boolean }
	/** Гостю — хост на связи или нет (он мог уснуть или перезапуститься). */
	| { t: 'host-online'; online: boolean }
	| { t: 'error'; reason: 'no-room' | 'room-taken' | 'bad-message' }

/** Алфавит кода комнаты — без символов, которые путаются при диктовке и наборе (0/O, 1/I). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH = 6

export function normalizeRoomCode(input: string): string {
	return input
		.trim()
		.toUpperCase()
		.replaceAll(/[^A-Z2-9]/g, '')
}

export function isRoomCode(code: string): boolean {
	return code.length === ROOM_CODE_LENGTH && [...code].every((c) => ROOM_CODE_ALPHABET.includes(c))
}

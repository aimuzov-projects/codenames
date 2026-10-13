/**
 * Конверт сообщений WS-релея. Сервер — тупой маршрутизатор: он знает только комнаты, кто в них
 * хост и кто гости, а `data` (игровые сообщения) не разбирает, поэтому её тип задаёт клиент.
 *
 * Формат общий для сервера (src/backend/server.ts) и клиента (transport/ws-relay.ts), поэтому
 * лежит в src/shared: так стороны не разъезжаются.
 */

/** Гость→сервер и хост→сервер. */
export type RelayIn<Data = unknown> =
	/** Хост открывает комнату; `code` — вернуться в свою после обрыва или перезапуска. */
	| { t: 'host'; code?: string }
	/** Гость входит в комнату под своим id устройства. */
	| { t: 'join'; code: string; id: string }
	/** Переслать полезную нагрузку: хост указывает id гостя, гость — всегда хосту. */
	| { t: 'to'; to?: string; data: Data }

/** Сервер→клиенту. */
export type RelayOut<Data = unknown> =
	/** Комната открыта (хосту). */
	| { t: 'hosting'; code: string }
	/** Вход выполнен (гостю). */
	| { t: 'joined'; code: string }
	/** Полезная нагрузка от собеседника: гостю приходит от 'host'. */
	| { t: 'from'; from: string; data: Data }
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

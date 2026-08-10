import { describe, expect, it } from 'vitest'
import { isRoomCode, normalizeRoomCode, ROOM_CODE_ALPHABET } from './relayProtocol.ts'

describe('код комнаты', () => {
	it('приводит ввод к каноническому виду: регистр, пробелы, дефисы', () => {
		expect(normalizeRoomCode(' abc-234 ')).toBe('ABC234')
		expect(normalizeRoomCode('a b c 2 3 4')).toBe('ABC234')
	})

	it('выбрасывает символы, которых нет в алфавите (0/O и 1/I путают при диктовке)', () => {
		// Ноль и единицу в кодах не выдаём, так что и на вводе они лишние.
		expect(normalizeRoomCode('AB0C1D')).toBe('ABCD')
	})

	it('валидным считает ровно шесть символов алфавита', () => {
		expect(isRoomCode('ABC234')).toBe(true)
		expect(isRoomCode('ABC23')).toBe(false)
		expect(isRoomCode('ABC2345')).toBe(false)
		expect(isRoomCode('ABC01D')).toBe(false)
	})

	it('в алфавите нет похожих друг на друга знаков', () => {
		for (const c of '01IO') expect(ROOM_CODE_ALPHABET).not.toContain(c)
	})
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { isRoomCode, normalizeRoomCode, ROOM_CODE_ALPHABET } from '#shared/relay-protocol.ts'

describe('код комнаты', () => {
	it('приводит ввод к каноническому виду: регистр, пробелы, дефисы', () => {
		assert.equal(normalizeRoomCode(' abc-234 '), 'ABC234')
		assert.equal(normalizeRoomCode('a b c 2 3 4'), 'ABC234')
	})

	it('выбрасывает символы, которых нет в алфавите (0/O и 1/I путают при диктовке)', () => {
		// We never issue zero and one in codes, so on input they're extraneous too.
		assert.equal(normalizeRoomCode('AB0C1D'), 'ABCD')
	})

	it('валидным считает ровно шесть символов алфавита', () => {
		assert.equal(isRoomCode('ABC234'), true)
		assert.equal(isRoomCode('ABC23'), false)
		assert.equal(isRoomCode('ABC2345'), false)
		assert.equal(isRoomCode('ABC01D'), false)
	})

	it('в алфавите нет похожих друг на друга знаков', () => {
		for (const c of '01IO') assert.ok(!ROOM_CODE_ALPHABET.includes(c))
	})
})

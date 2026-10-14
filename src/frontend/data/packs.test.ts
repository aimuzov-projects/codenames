import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { BUILTIN_PACKS, DEFAULT_PACK_IDS, isPlayable, mergeWords, parseWordList } from '#frontend/data/packs.ts'
import { BOARD_SIZE } from '#frontend/game/index.ts'

describe('parseWordList', () => {
	it('разбивает по переводам строк, запятым и точкам с запятой', () => {
		assert.deepEqual(parseWordList('кот, пёс\nмышь; конь'), ['кот', 'пёс', 'мышь', 'конь'])
	})

	it('обрезает пробелы и выкидывает пустые', () => {
		assert.deepEqual(parseWordList('  кот  ,\n\n , пёс ,'), ['кот', 'пёс'])
	})

	it('убирает точные дубли, сохраняя порядок первого вхождения', () => {
		assert.deepEqual(parseWordList('кот\nпёс\nкот'), ['кот', 'пёс'])
	})

	it('сохраняет словосочетания (не режет по пробелам)', () => {
		assert.deepEqual(parseWordList('красная площадь\nзимний дворец'), ['красная площадь', 'зимний дворец'])
	})

	it('на пустом вводе возвращает пустой массив', () => {
		assert.deepEqual(parseWordList('   \n , ; '), [])
	})
})

describe('mergeWords', () => {
	it('объединяет слова паков и убирает дубли между ними', () => {
		const a = { id: 'a', title: 'A', lang: 'ru', builtin: true, words: ['кот', 'пёс'] }
		const b = { id: 'b', title: 'B', lang: 'ru', builtin: true, words: ['пёс', 'мышь'] }

		assert.deepEqual(mergeWords([a, b]), ['кот', 'пёс', 'мышь'])
	})

	it('на пустом списке паков возвращает пустой массив', () => {
		assert.deepEqual(mergeWords([]), [])
	})
})

describe('isPlayable', () => {
	it('пак играбелен при наличии минимум BOARD_SIZE уникальных слов', () => {
		assert.equal(isPlayable(Array.from({ length: BOARD_SIZE }, (_, i) => `w${i}`)), true)
		assert.equal(isPlayable(Array.from({ length: BOARD_SIZE - 1 }, (_, i) => `w${i}`)), false)
	})
})

describe('BUILTIN_PACKS', () => {
	it('каждый встроенный пак играбелен сам по себе', () => {
		assert.ok(BUILTIN_PACKS.length > 0)

		for (const pack of BUILTIN_PACKS) {
			assert.equal(isPlayable(pack.words), true)
		}
	})

	it('все встроенные паки содержат только уникальные слова', () => {
		for (const pack of BUILTIN_PACKS) {
			assert.equal(new Set(pack.words).size, pack.words.length)
		}
	})

	it('у встроенных паков уникальные id', () => {
		const ids = BUILTIN_PACKS.map((p) => p.id)

		assert.equal(new Set(ids).size, ids.length)
	})

	it('паки из дефолтного выбора существуют', () => {
		const ids = new Set(BUILTIN_PACKS.map((p) => p.id))

		for (const id of DEFAULT_PACK_IDS) {
			assert.equal(ids.has(id), true)
		}
	})
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { NAMES, randomName } from '#frontend/data/names.ts'

describe('randomName', () => {
	it('rng=0 возвращает первый элемент словаря', () => {
		assert.equal(
			randomName(() => 0),
			NAMES[0],
		)
	})

	it('rng→1 возвращает последний элемент словаря', () => {
		assert.equal(
			randomName(() => 0.999999),
			NAMES[NAMES.length - 1],
		)
	})

	it('всегда возвращает имя из словаря', () => {
		for (const r of [0, 0.25, 0.5, 0.75, 0.99]) {
			assert.ok(NAMES.includes(randomName(() => r)))
		}
	})
})

describe('NAMES', () => {
	it('не содержит дублей', () => {
		assert.equal(new Set(NAMES).size, NAMES.length)
	})

	it('не пустой', () => {
		assert.ok(NAMES.length > 0)
	})
})

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { site } from '#frontend/data/site.ts'

import { pageTitle } from './title.ts'

test('главная получает только название сайта', () => {
	assert.equal(pageTitle(), site.name)
})

test('остальные страницы — своё название и сайт через тире', () => {
	assert.equal(pageTitle('Контакты'), `Контакты — ${site.name}`)
})

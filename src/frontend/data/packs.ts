import ruAnimals from '#frontend/data/packs/ru-animals.json' with { type: 'json' }
import ruCars from '#frontend/data/packs/ru-cars.json' with { type: 'json' }
import ruCity from '#frontend/data/packs/ru-city.json' with { type: 'json' }
import ruFantasy from '#frontend/data/packs/ru-fantasy.json' with { type: 'json' }
import ruFood from '#frontend/data/packs/ru-food.json' with { type: 'json' }
import ruHiking from '#frontend/data/packs/ru-hiking.json' with { type: 'json' }
import ruMemes from '#frontend/data/packs/ru-memes.json' with { type: 'json' }
import ruMusic from '#frontend/data/packs/ru-music.json' with { type: 'json' }
import ruNature from '#frontend/data/packs/ru-nature.json' with { type: 'json' }
import ruPeople from '#frontend/data/packs/ru-people.json' with { type: 'json' }
import ruScience from '#frontend/data/packs/ru-science.json' with { type: 'json' }
import ruSpace from '#frontend/data/packs/ru-space.json' with { type: 'json' }
import ruSport from '#frontend/data/packs/ru-sport.json' with { type: 'json' }
import { BOARD_SIZE } from '#frontend/game/index.ts'

export type WordPack = {
	id: string
	title: string
	lang: string
	/** true: built-in pack, false: custom (IndexedDB). */
	builtin: boolean
	words: string[]
}

/** Built-in packs are grouped by theme: those are what get mixed, 3-5 at a time. */
export const BUILTIN_PACKS: WordPack[] = [
	{ id: 'ru-animals', title: 'Животные', lang: 'ru', builtin: true, words: ruAnimals },
	{ id: 'ru-nature', title: 'Природа и стихии', lang: 'ru', builtin: true, words: ruNature },
	{ id: 'ru-people', title: 'Люди и профессии', lang: 'ru', builtin: true, words: ruPeople },
	{ id: 'ru-city', title: 'Город и транспорт', lang: 'ru', builtin: true, words: ruCity },
	{ id: 'ru-music', title: 'Музыка и искусство', lang: 'ru', builtin: true, words: ruMusic },
	{ id: 'ru-sport', title: 'Спорт и игры', lang: 'ru', builtin: true, words: ruSport },
	{ id: 'ru-fantasy', title: 'Фэнтези и мифы', lang: 'ru', builtin: true, words: ruFantasy },
	{ id: 'ru-science', title: 'Наука и техника', lang: 'ru', builtin: true, words: ruScience },
	{ id: 'ru-space', title: 'Космос', lang: 'ru', builtin: true, words: ruSpace },
	{ id: 'ru-food', title: 'Еда и напитки', lang: 'ru', builtin: true, words: ruFood },
	{ id: 'ru-cars', title: 'Машины', lang: 'ru', builtin: true, words: ruCars },
	{ id: 'ru-memes', title: 'Мемы', lang: 'ru', builtin: true, words: ruMemes },
	{ id: 'ru-hiking', title: 'Походы', lang: 'ru', builtin: true, words: ruHiking },
]

/** Packs selected by default: a starter mix of three themes. */
export const DEFAULT_PACK_IDS = ['ru-animals', 'ru-nature', 'ru-food']

/** Parses user text into a list of words: separators are newline, comma, `;`. */
export function parseWordList(text: string): string[] {
	const words = text
		.split(/[\n,;]+/)
		.map((w) => w.trim())
		.filter(Boolean)

	return [...new Set(words)]
}

/** Merges words from several packs, removing duplicates. */
export function mergeWords(packs: WordPack[]): string[] {
	return [...new Set(packs.flatMap((p) => p.words))]
}

/** A pack can be used on its own if it has enough unique words for the board. */
export function isPlayable(words: string[]): boolean {
	return new Set(words).size >= BOARD_SIZE
}

export { BOARD_SIZE }

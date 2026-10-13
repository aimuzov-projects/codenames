import { devices, expect, type Page } from '@playwright/test'

import { openApp } from './app'
import { readSignalOut, submitSignalIn } from './signal'

/** Ручные контексты не наследуют project-use — device и ignoreHTTPSErrors задаём явно. */
export const mobileCtx = { ...devices['Pixel 7'], ignoreHTTPSErrors: true }

/**
 * Хост создаёт игру и оказывается в лобби «Создание игры» (по умолчанию — красный капитан).
 * В e2e-сборке задан VITE_RELAY_URL, поэтому лобби стартует в онлайн-режиме — переключаем его
 * на офлайновое рукопожатие по QR, которое и проверяют эти тесты.
 */
export async function startHost(host: Page) {
	await openApp(host)
	await host.getByRole('button', { name: 'Играть' }).click()
	await host.getByRole('button', { name: 'Лобби' }).click()
	await host.getByRole('button', { name: 'Создать' }).click()
	await expect(host.getByRole('heading', { name: 'Создание игры' })).toBeVisible()
	await host.getByRole('button', { name: 'Играть без интернета' }).click()
	await expect(host.getByRole('button', { name: 'Добавить игрока' })).toBeVisible()
}

/**
 * Полное рукопожатие хост↔гость через тест-хуки сигналинга (реальный WebRTC DataChannel).
 * Хост должен быть в лобби; по завершении гость на экране setup, хост снова в лобби.
 */
export async function connectGuest(host: Page, guest: Page) {
	await openApp(guest)
	await guest.getByRole('button', { name: 'Играть' }).click()
	await guest.getByRole('button', { name: 'Лобби' }).click()
	await guest.getByRole('button', { name: 'Подключиться' }).click()
	await guest.getByRole('button', { name: 'Рядом, без интернета' }).click()
	const offer = await readSignalOut(guest)
	await guest.getByRole('button', { name: 'Далее' }).click()

	await host.getByRole('button', { name: 'Добавить игрока' }).click()
	await submitSignalIn(host, offer)
	const answer = await readSignalOut(host)
	await submitSignalIn(guest, answer)

	await expect(guest.getByText('Подключено ✓')).toBeVisible({ timeout: 20_000 })
	await expect(host.getByRole('heading', { name: 'Создание игры' })).toBeVisible({
		timeout: 20_000,
	})
}

/** Гость выбирает команду и роль на экране setup (через сегмент-контролы SetupPicker). */
export async function guestPick(guest: Page, team: 'Красные' | 'Синие', role: 'Игрок' | 'Капитан') {
	await guest.getByRole('radio', { name: team }).click()
	await guest.getByRole('radio', { name: role }).click()
}

<script lang="ts">
	import type { Component } from 'svelte'

	import Toaster from '#frontend/components/ui/toaster.svelte'
	import { keepScreenAwake } from '#frontend/lib/wake-lock.ts'
	import AddPlayer from '#frontend/screens/add-player.svelte'
	import Board from '#frontend/screens/board.svelte'
	import Changelog from '#frontend/screens/changelog.svelte'
	import Dicts from '#frontend/screens/dicts.svelte'
	import Home from '#frontend/screens/home.svelte'
	import HostLobby from '#frontend/screens/host-lobby.svelte'
	import Join from '#frontend/screens/join.svelte'
	import Lobby from '#frontend/screens/lobby.svelte'
	import Packs from '#frontend/screens/packs.svelte'
	import Play from '#frontend/screens/play.svelte'
	import Rules from '#frontend/screens/rules.svelte'
	import Settings from '#frontend/screens/settings.svelte'
	import Stats from '#frontend/screens/stats.svelte'
	import { registerServiceWorker } from '#frontend/state/pwa.ts'
	import { applyCardWordSize, keepAwakeAtom } from '#frontend/state/settings.ts'
	import { applyTheme } from '#frontend/state/theme.ts'
	import { hydrateCustomPacks, screenAtom, type Screen } from '#frontend/state/ui.ts'

	const screens: Record<Screen, Component> = {
		home: Home,
		play: Play,
		lobby: Lobby,
		dicts: Dicts,
		rules: Rules,
		board: Board,
		packs: Packs,
		host: HostLobby,
		'host-add': AddPlayer,
		join: Join,
		settings: Settings,
		stats: Stats,
		changelog: Changelog,
	}

	/** Screens where falling asleep hurts most: the game and network lobbies, which wait for connections. */
	const awakeScreens = new Set<Screen>(['board', 'host', 'host-add', 'join'])

	applyTheme()
	applyCardWordSize()
	registerServiceWorker()
	void hydrateCustomPacks()

	// The startup loader from pages/index.astro is removed after the real UI renders for the first time.
	$effect(() => {
		const loader = document.getElementById('initial-loader')

		if (!loader) return

		loader.classList.add('loader--hiding')
		const timer = setTimeout(() => loader.remove(), 200)

		return () => clearTimeout(timer)
	})

	// Pin #root to visualViewport. With the keyboard open the visible area shrinks and on iOS shifts
	// up, and the shell follows it: content stays put, the document has nothing to scroll, and the
	// composer row at the bottom edge sits right above the keyboard.
	$effect(() => {
		const vv = window.visualViewport
		const root = document.getElementById('root')

		if (!vv || !root) return

		const apply = () => {
			root.style.height = `${vv.height}px`
			// translate3d stays even at zero: a stable compositing layer keeps the overlay from flickering
			// when the transform appears abruptly as the keyboard opens.
			root.style.transform = `translate3d(${vv.offsetLeft}px, ${vv.offsetTop}px, 0)`
		}

		apply()
		vv.addEventListener('resize', apply)
		vv.addEventListener('scroll', apply)

		return () => {
			vv.removeEventListener('resize', apply)
			vv.removeEventListener('scroll', apply)
			root.style.height = ''
			root.style.transform = ''
		}
	})

	$effect(() => ($keepAwakeAtom && awakeScreens.has($screenAtom) ? keepScreenAwake() : undefined))

	const Current = $derived(screens[$screenAtom])
</script>

<!-- key remounts the screen on every transition, so the enter animation replays. Toasts are outside
     the block so a screen change doesn't reset them. -->
{#key $screenAtom}
	<Current />
{/key}
<Toaster />

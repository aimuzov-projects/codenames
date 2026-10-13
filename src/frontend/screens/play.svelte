<script lang="ts">
	import Smartphone from '@lucide/svelte/icons/smartphone'
	import Users from '@lucide/svelte/icons/users'

	import Footer from '#frontend/components/footer.svelte'
	import MenuButton from '#frontend/components/menu-button.svelte'
	import MenuLayout from '#frontend/components/menu-layout.svelte'
	import Screen from '#frontend/components/screen.svelte'
	import TopBar from '#frontend/components/top-bar.svelte'
	import { BOARD_SIZE } from '#frontend/game/index.ts'
	import { modeAtom, startGame } from '#frontend/state/session.ts'
	import { goBack, goTo, selectedWordsAtom } from '#frontend/state/ui.ts'

	const ready = $derived($selectedWordsAtom.length >= BOARD_SIZE)

	function startLocal() {
		modeAtom.set('local')
		startGame({ words: selectedWordsAtom() })
		goTo('board')
	}
</script>

<Screen staticBody onback={goBack}>
	{#snippet header()}<TopBar title="Играть" onback={goBack} />{/snippet}
	<MenuLayout>
		<MenuButton icon={Users} onclick={() => goTo('lobby')}>Лобби</MenuButton>
		<MenuButton icon={Smartphone} variant="outline" onclick={startLocal} disabled={!ready}>
			Одно устройство
		</MenuButton>
		{#if !ready}
			<button type="button" class="play__shortage" onclick={() => goTo('dicts')}>
				Слов выбрано: {$selectedWordsAtom.length} — нужно минимум {BOARD_SIZE}. Выбрать словари
			</button>
		{/if}
	</MenuLayout>
	<Footer />
</Screen>

<style>
	.play__shortage {
		padding: 0;
		border: 0;
		font-size: 0.875rem;
		color: var(--destructive);
		text-underline-offset: 4px;
		background: none;

		&:hover {
			text-decoration: underline;
		}
	}
</style>

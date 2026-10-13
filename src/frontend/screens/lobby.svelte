<script lang="ts">
	import LogIn from '@lucide/svelte/icons/log-in'
	import Plus from '@lucide/svelte/icons/plus'

	import Footer from '#frontend/components/footer.svelte'
	import MenuButton from '#frontend/components/menu-button.svelte'
	import MenuLayout from '#frontend/components/menu-layout.svelte'
	import Screen from '#frontend/components/screen.svelte'
	import TopBar from '#frontend/components/top-bar.svelte'
	import { BOARD_SIZE } from '#frontend/game/index.ts'
	import { goBack, goTo, goToJoin, selectedWordsAtom } from '#frontend/state/ui.ts'

	const ready = $derived($selectedWordsAtom.length >= BOARD_SIZE)
</script>

<Screen staticBody onback={goBack}>
	{#snippet header()}<TopBar title="Лобби" onback={goBack} />{/snippet}
	<MenuLayout>
		<MenuButton icon={LogIn} onclick={() => goToJoin('new')}>Подключиться</MenuButton>
		<MenuButton icon={Plus} variant="outline" onclick={() => goTo('host')} disabled={!ready}>Создать</MenuButton>
		{#if !ready}
			<button type="button" class="lobby__shortage" onclick={() => goTo('dicts')}>
				Чтобы создать игру, выбери словари (минимум {BOARD_SIZE} слов)
			</button>
		{/if}
	</MenuLayout>
	<Footer />
</Screen>

<style>
	.lobby__shortage {
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

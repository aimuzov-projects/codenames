<script lang="ts">
	import BookOpen from '@lucide/svelte/icons/book-open'
	import Play from '@lucide/svelte/icons/play'
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw'
	import ScrollText from '@lucide/svelte/icons/scroll-text'

	import Footer from '#frontend/components/footer.svelte'
	import MenuButton from '#frontend/components/menu-button.svelte'
	import MenuLayout from '#frontend/components/menu-layout.svelte'
	import Screen from '#frontend/components/screen.svelte'
	import TopBar from '#frontend/components/top-bar.svelte'
	import { resumeSession, savedSessionAtom } from '#frontend/state/net.ts'
	import { goTo } from '#frontend/state/ui.ts'
</script>

<Screen staticBody>
	{#snippet header()}<TopBar />{/snippet}
	<MenuLayout>
		<!-- A network game that wasn't closed explicitly: the app was evicted from memory or closed by mistake. -->
		{#if $savedSessionAtom}
			<MenuButton icon={RotateCcw} accent onclick={() => resumeSession()}>Вернуться в игру</MenuButton>
		{/if}
		<MenuButton icon={Play} accent={!$savedSessionAtom} onclick={() => goTo('play')}>Играть</MenuButton>
		<MenuButton icon={BookOpen} variant="outline" onclick={() => goTo('dicts')}>Словари</MenuButton>
		<MenuButton icon={ScrollText} variant="outline" onclick={() => goTo('rules')}>Правила</MenuButton>
	</MenuLayout>
	<Footer />
</Screen>

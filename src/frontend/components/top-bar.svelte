<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left'
	import type { Snippet } from 'svelte'

	import SettingsButton from '#frontend/components/settings-button.svelte'
	import Button from '#frontend/components/ui/button.svelte'

	type Props = {
		/** Screen title in `<h1>`. For a custom title, use the `heading` snippet. */
		title?: string
		heading?: Snippet
		/** When set, a "back" button appears on the left. */
		onback?: () => void
		/** Extra actions on the right, before the settings button. */
		right?: Snippet
		/** Settings button on the right, shown on every screen. */
		showSettings?: boolean
	}

	let { title, heading, onback, right, showSettings = true }: Props = $props()
</script>

<header class="top-bar">
	{#if onback}
		<Button variant="outline" size="icon" ripple onclick={onback} aria-label="Назад">
			<ArrowLeft />
		</Button>
	{/if}
	{#if title}
		<h1 class="top-bar__title">{title}</h1>
	{:else if heading}
		{@render heading()}
	{/if}
	{#if right || showSettings}
		<div class="top-bar__actions">
			{@render right?.()}
			{#if showSettings}<SettingsButton />{/if}
		</div>
	{/if}
</header>

<style>
	.top-bar {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		min-height: 2.5rem;

		&__title {
			font-size: 1.125rem;
			font-weight: 700;
			letter-spacing: -0.025em;
		}

		&__actions {
			display: flex;
			flex-shrink: 0;
			gap: 0.5rem;
			align-items: center;
			margin-left: auto;
		}
	}
</style>

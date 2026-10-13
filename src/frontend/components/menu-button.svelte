<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right'
	import type { Component, Snippet } from 'svelte'

	import Button from '#frontend/components/ui/button.svelte'

	type Props = {
		/** Ведущая иконка lucide. */
		icon: Component
		onclick: () => void
		variant?: 'default' | 'outline'
		disabled?: boolean
		/** Главный CTA экрана: скользящий блик. Не больше одного на экран. */
		accent?: boolean
		children: Snippet
	}

	let { icon: Icon, onclick, variant = 'default', disabled = false, accent = false, children }: Props = $props()
</script>

<!-- Крупная кнопка меню: иконка, подпись и шеврон -- намёк на переход. -->
<Button size="lg" {variant} {disabled} block start ripple sheen={accent} {onclick}>
	<Icon />
	<span>{@render children()}</span>
	<span class="menu-button__chevron"><ChevronRight /></span>
</Button>

<style>
	.menu-button__chevron {
		display: flex;
		margin-left: auto;
		opacity: 0.6;
	}
</style>

<script lang="ts">
	import type { Snippet } from 'svelte'

	import { edgeSwipeBack } from '#frontend/lib/edge-swipe.ts'
	import { navDirectionAtom } from '#frontend/state/ui.ts'

	type Props = {
		/** Header pinned to the top (usually top-bar). Doesn't scroll with the body. */
		header?: Snippet
		/** "Back" for the left-edge swipe -- the same as the header button. */
		onback?: () => void
		/** Fade at the bottom edge: content dissolves into the background instead of cutting off. */
		bottomFade?: boolean
		/**
		 * Don't animate the whole body on return -- the content moves itself. That's how menu-layout
		 * keeps the logo in place and animates only the buttons.
		 */
		staticBody?: boolean
		/** Spacing between body blocks; tighter on the board. */
		gap?: 'normal' | 'tight'
		children?: Snippet
	}

	let { header, onback, bottomFade = false, staticBody = false, gap = 'normal', children }: Props = $props()

	$effect(() => (onback ? edgeSwipeBack(onback) : undefined))
</script>

<!--
	The header is sticky inside the scroll container: content slides under it, and the header's gradient
	background (solid at the top, transparent at the bottom edge) gives a soft see-through in both themes.
-->
<div class="screen">
	<div class="screen__scroll">
		{#if header}
			<div class="screen__header">{@render header()}</div>
		{/if}
		<div
			class="screen__body screen__body--{gap}"
			class:screen__body--enter-back={!staticBody && $navDirectionAtom === 'back'}
		>
			{@render children?.()}
		</div>
	</div>
	{#if bottomFade}
		<div class="screen__fade"></div>
	{/if}
</div>

<style>
	.screen {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 28rem;
		height: 100dvh;
		margin-inline: auto;

		&__scroll {
			scrollbar-width: none;
			overflow: clip auto;
			overscroll-behavior: contain;
			display: flex;
			flex: 1;
			flex-direction: column;
			padding-bottom: calc(var(--safe-bottom) + 1.25rem);

			&::-webkit-scrollbar {
				display: none;
			}
		}

		&__header {
			position: sticky;
			z-index: 10;
			top: 0;
			padding: calc(var(--safe-top) + 1rem) 1rem 0.75rem;
			background: linear-gradient(to top, transparent, var(--background) 1rem);
		}

		&__body {
			display: flex;
			flex: 1;
			flex-direction: column;
			padding: 0.125rem 1rem 0;

			&--normal {
				gap: 0.875rem;
			}

			&--tight {
				gap: 0.75rem;
			}

			&--enter-back {
				animation: screen-in-left 240ms ease-out;

				@media (--reduced-motion) {
					animation: none;
				}
			}
		}

		&__fade {
			pointer-events: none;
			position: absolute;
			z-index: 10;
			inset-inline: 0;
			bottom: 0;
			height: calc(var(--safe-bottom) + 1rem);
			background: linear-gradient(to bottom, transparent, var(--background) 1rem);
		}
	}
</style>

<script lang="ts">
	import type { Snippet } from 'svelte'

	import { edgeSwipeBack } from '#frontend/lib/edge-swipe.ts'
	import { navDirectionAtom } from '#frontend/state/ui.ts'

	type Props = {
		/** Хедер, закреплённый сверху (обычно top-bar). Не скроллится вместе с телом. */
		header?: Snippet
		/** «Назад» для жеста от левого края -- тот же, что у кнопки в хедере. */
		onback?: () => void
		/** Затухание у нижней кромки: контент растворяется в фоне, а не обрывается. */
		bottomFade?: boolean
		/**
		 * Не анимировать тело целиком при возврате -- контент двигает себя сам. Так menu-layout
		 * держит логотип на месте и анимирует только кнопки.
		 */
		staticBody?: boolean
		/** Расстояние между блоками тела; у доски оно плотнее. */
		gap?: 'normal' | 'tight'
		children?: Snippet
	}

	let { header, onback, bottomFade = false, staticBody = false, gap = 'normal', children }: Props = $props()

	$effect(() => (onback ? edgeSwipeBack(onback) : undefined))
</script>

<!--
	Хедер sticky внутри скролл-контейнера: контент проезжает под ним, а градиентный фон хедера
	(сплошной сверху, прозрачный у нижней кромки) даёт мягкое просвечивание в обеих темах.
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
				gap: 0.5rem;
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

<script lang="ts">
	import type { Snippet } from 'svelte'
	import type { HTMLButtonAttributes } from 'svelte/elements'

	import { tapFeedback } from '#frontend/audio/tap.ts'

	type Props = HTMLButtonAttributes & {
		variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link'
		size?: 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg'
		/** Stretch to the parent's full width. */
		block?: boolean
		/** Content aligned to the left edge (menu buttons: icon, label, chevron). */
		start?: boolean
		/** Ripple from the touch point and click feedback: for accent actions. */
		ripple?: boolean
		/** Sliding shine for the screen's main CTA. At most one per screen. */
		sheen?: boolean
		children?: Snippet
	}

	let {
		variant = 'default',
		size = 'default',
		block = false,
		start = false,
		ripple = false,
		sheen = false,
		type = 'button',
		children,
		onpointerdown,
		...rest
	}: Props = $props()

	type Ink = { id: number; x: number; y: number; size: number }
	let inks = $state<Ink[]>([])
	let nextInk = 0

	function press(event: PointerEvent & { currentTarget: EventTarget & HTMLButtonElement }) {
		if (ripple) {
			tapFeedback()
			if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
				const rect = event.currentTarget.getBoundingClientRect()
				const id = nextInk++
				const ink = {
					id,
					x: event.clientX - rect.left,
					y: event.clientY - rect.top,
					size: Math.max(rect.width, rect.height) * 2.2,
				}
				inks = [...inks, ink]
				setTimeout(() => (inks = inks.filter((i) => i.id !== id)), 600)
			}
		}
		onpointerdown?.(event)
	}
</script>

<button
	{type}
	class="button button--{variant} button--{size}"
	class:button--block={block}
	class:button--start={start}
	class:button--sheen={sheen}
	onpointerdown={press}
	{...rest}
>
	{@render children?.()}
	{#each inks as ink (ink.id)}
		<span
			class="button__ink"
			aria-hidden="true"
			style:left="{ink.x}px"
			style:top="{ink.y}px"
			style:width="{ink.size}px"
			style:height="{ink.size}px"
		></span>
	{/each}
</button>

<style>
	.button {
		--icon-size: 1rem;
		user-select: none;

		position: relative;
		overflow: hidden;
		display: inline-flex;
		flex-shrink: 0;
		gap: 0.5rem;
		align-items: center;
		justify-content: center;
		height: 2.75rem;
		padding-inline: 1rem;
		border: 1px solid transparent;
		border-radius: var(--radius-lg);
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--primary-foreground);
		white-space: nowrap;
		background: var(--primary);
		background-clip: padding-box;
		outline: none;
		transition:
			transform 150ms,
			background-color 150ms,
			color 150ms,
			opacity 150ms;

		&:active {
			transform: scale(0.97);
		}

		&:focus-visible {
			border-color: var(--ring);
			box-shadow: 0 0 0 3px color-mix(in oklch, var(--ring) 50%, transparent);
		}

		&:disabled {
			pointer-events: none;
			opacity: 0.5;
		}

		& :global(.lucide-icon) {
			pointer-events: none;
			flex-shrink: 0;
			width: var(--icon-size);
			height: var(--icon-size);
		}

		&--default:hover {
			background: color-mix(in oklch, var(--primary) 80%, transparent);
		}

		&--outline {
			border-color: var(--border);
			color: var(--foreground);
			background: var(--background);

			&:hover {
				background: var(--muted);
			}

			:global(.dark) & {
				border-color: var(--input);
				background: color-mix(in oklch, var(--input) 30%, transparent);

				&:hover {
					background: color-mix(in oklch, var(--input) 50%, transparent);
				}
			}
		}

		&--secondary {
			color: var(--secondary-foreground);
			background: var(--secondary);

			&:hover {
				background: color-mix(in oklch, var(--secondary), var(--foreground) 5%);
			}
		}

		&--ghost {
			color: inherit;
			background: transparent;

			&:hover {
				background: var(--muted);
			}
		}

		&--destructive {
			color: var(--destructive);
			background: color-mix(in oklch, var(--destructive) 10%, transparent);

			&:hover {
				background: color-mix(in oklch, var(--destructive) 20%, transparent);
			}
		}

		&--link {
			height: auto;
			padding: 0;
			color: var(--primary);
			text-underline-offset: 4px;
			background: transparent;

			&:hover {
				text-decoration: underline;
			}
		}

		&--xs {
			--icon-size: 0.875rem;

			gap: 0.25rem;
			height: 2rem;
			padding-inline: 0.625rem;
			border-radius: min(var(--radius-md), 10px);
			font-size: 0.75rem;
		}

		&--sm {
			gap: 0.375rem;
			height: 2.25rem;
			padding-inline: 0.875rem;
			border-radius: min(var(--radius-md), 12px);
			font-size: 0.85rem;
		}

		&--lg {
			--icon-size: 1.25rem;

			height: 4rem;
			padding-inline: 1.5rem;
			font-size: 1rem;
		}

		&--icon {
			--icon-size: 1.25rem;

			width: 2.75rem;
			padding: 0;
		}

		&--icon-sm {
			width: 2.25rem;
			height: 2.25rem;
			padding: 0;
			border-radius: min(var(--radius-md), 12px);
		}

		&--icon-lg {
			--icon-size: 1.5rem;

			width: 3rem;
			height: 3rem;
			padding: 0;
		}

		&--block {
			width: 100%;
		}

		&--start {
			gap: 0.75rem;
			justify-content: flex-start;
		}

		/* The shine runs in the text color, so it suits any button background. */
		&--sheen::after {
			pointer-events: none;
			content: '';
			position: absolute;
			inset-block: 0;
			left: -45%;
			transform: skewX(-18deg);
			width: 32%;
			background: linear-gradient(
				100deg,
				transparent,
				color-mix(in oklch, currentcolor 22%, transparent),
				transparent
			);
			animation: button-sheen 3.5s ease-in-out infinite;

			@media (--reduced-motion) {
				display: none;
			}
		}

		&__ink {
			pointer-events: none;
			position: absolute;
			transform: translate(-50%, -50%) scale(0);
			border-radius: 9999px;
			background: color-mix(in oklch, currentcolor 25%, transparent);
			animation: button-ink 600ms ease-out forwards;
		}
	}

	@keyframes button-sheen {
		0% {
			left: -45%;
		}

		35%,
		100% {
			left: 125%;
		}
	}

	@keyframes button-ink {
		to {
			transform: translate(-50%, -50%) scale(1);
			opacity: 0;
		}
	}
</style>

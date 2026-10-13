<script lang="ts">
	import Check from '@lucide/svelte/icons/check'
	import X from '@lucide/svelte/icons/x'
	import { untrack } from 'svelte'

	import type { RedactedCard } from '#frontend/game/index.ts'

	type Props = {
		card: RedactedCard
		interactive: boolean
		onreveal?: () => void
		/** Приглушить слово на открытой карте. */
		hideWord?: boolean
	}

	let { card, interactive, onreveal, hideWord = false }: Props = $props()

	/** Сколько держим галочку или крестик перед возвратом к слову (см. REVEAL_POPUP_DELAY_MS в session.ts). */
	const ICON_HOLD_MS = 1000
	const SHAKE_MS = 500

	const type = $derived(card.type)
	const revealed = $derived(card.revealed && type !== null)
	const tinted = $derived(!card.revealed && type !== null)
	const clickable = $derived(interactive && !card.revealed && type === null)
	// Чужая открытая карта: открыта не своим типом (соперник, нейтрал или ассасин).
	const foreign = $derived(revealed && card.openedBy !== undefined && card.openedBy !== type)

	let showIcon = $state(false)
	let shake = $state(false)
	// Слово приглушается, как только отыграла галочка, -- проявляется сразу приглушённым, без вспышки.
	const masked = $derived(revealed && hideWord && !showIcon)

	// Реакция только на переход «закрыта → открыта», не на маунт уже открытой карты.
	let wasRevealed = untrack(() => card.revealed)
	$effect(() => {
		const was = wasRevealed
		wasRevealed = card.revealed
		if (!card.revealed || was || card.type === null || card.openedBy === undefined) return
		showIcon = true
		const timers = [setTimeout(() => (showIcon = false), ICON_HOLD_MS)]
		if (card.openedBy !== card.type) {
			shake = true
			timers.push(setTimeout(() => (shake = false), SHAKE_MS))
		}
		return () => timers.forEach(clearTimeout)
	})
</script>

<!--
	Корень всегда один и тот же <button>: при открытии фон и текст плавно перетекают в цвет карты.
	Тип попадает в DOM, только когда он раскрыт зрителю: в виде игрока ключ через DOM не подсмотреть.
-->
<button
	type="button"
	class="card-tile"
	class:card-tile--closed={!revealed && !tinted}
	class:card-tile--revealed={revealed}
	class:card-tile--shake={shake}
	class:card-tile--solid-red={revealed && type === 'red'}
	class:card-tile--solid-blue={revealed && type === 'blue'}
	class:card-tile--solid-neutral={revealed && type === 'neutral'}
	class:card-tile--solid-assassin={revealed && type === 'assassin'}
	class:card-tile--tint-red={tinted && type === 'red'}
	class:card-tile--tint-blue={tinted && type === 'blue'}
	class:card-tile--tint-neutral={tinted && type === 'neutral'}
	class:card-tile--tint-assassin={tinted && type === 'assassin'}
	disabled={!clickable}
	onclick={clickable ? onreveal : undefined}
	data-testid="card"
	data-card-type={type ?? undefined}
	data-revealed={card.revealed ? 'true' : undefined}
>
	<span class="card-tile__word">
		<span class="card-tile__text" class:card-tile__text--hidden={showIcon} class:card-tile__text--masked={masked}>
			{card.word}
		</span>
		<!-- Галочка (своя) или крестик (чужая) поверх слова, блёклым тоном текста карты. -->
		<span class="card-tile__reaction" class:card-tile__reaction--shown={showIcon} aria-hidden="true">
			{#if foreign}<X size={24} />{:else}<Check size={24} />{/if}
		</span>
	</span>

	<!-- Капитан видит тип закрытой карты по полоске снизу. -->
	{#if tinted}
		<span class="card-tile__bar card-tile__bar--{type}"></span>
	{/if}

	<!-- Открыта чужой командой: точка открывшего в правом нижнем углу. -->
	{#if foreign && card.openedBy}
		<span class="card-tile__opened card-tile__opened--{card.openedBy}"></span>
	{/if}
</button>

<style>
	.card-tile {
		position: relative;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		min-height: 4rem;
		padding: 0.375rem 0.25rem;
		border: 0;
		border-radius: var(--radius-lg);
		text-align: center;
		transition: transform 150ms;

		&:enabled:active {
			transform: scale(0.97);
		}

		&:disabled {
			cursor: default;
		}

		&--closed {
			color: var(--card-foreground);
			background: var(--card);
			box-shadow: 0 0 0 1px color-mix(in oklch, var(--foreground) 10%, transparent);
		}

		&--revealed {
			transition:
				background-color 500ms,
				color 500ms;
		}

		&--shake {
			animation: card-tile-shake 500ms ease-in-out;

			@media (--reduced-motion) {
				animation: none;
			}
		}

		&--solid-red {
			color: var(--team-red-foreground);
			background: var(--team-red);
		}

		&--solid-blue {
			color: var(--team-blue-foreground);
			background: var(--team-blue);
		}

		&--solid-neutral {
			color: var(--card-neutral-foreground);
			background: var(--card-neutral);
		}

		&--solid-assassin {
			color: var(--card-assassin-foreground);
			background: var(--card-assassin);
		}

		&--tint-red {
			color: var(--team-red-tint-foreground);
			background: var(--team-red-tint);
		}

		&--tint-blue {
			color: var(--team-blue-tint-foreground);
			background: var(--team-blue-tint);
		}

		&--tint-neutral {
			color: var(--card-neutral-tint-foreground);
			background: var(--card-neutral-tint);
		}

		&--tint-assassin {
			color: var(--card-assassin-tint-foreground);
			background: var(--card-assassin-tint);
		}

		&__word {
			position: relative;
			display: block;
			width: 100%;
			min-width: 0;
			font-size: var(--card-word-size, 0.8125rem);
			font-weight: 600;
			line-height: 1.1;
			letter-spacing: 0.025em;
			overflow-wrap: break-word;

			.card-tile--revealed & {
				opacity: 0.95;
			}
		}

		&__text {
			display: block;
			transition: opacity 200ms;

			&--masked {
				opacity: 0.3;
			}

			&--hidden {
				opacity: 0;
			}
		}

		&__reaction {
			position: absolute;
			inset: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			opacity: 0;
			transition: opacity 200ms;

			&--shown {
				opacity: 0.6;
			}
		}

		&__bar {
			position: absolute;
			inset-inline: 0.5rem;
			bottom: 0.375rem;
			height: 3px;
			border-radius: 9999px;

			&--red {
				background: var(--team-red);
			}

			&--blue {
				background: var(--team-blue);
			}

			&--neutral {
				background: var(--card-neutral);
			}

			&--assassin {
				background: var(--card-assassin-tint-foreground);
			}
		}

		/* Яркий оттенок светлее любого фона карты: точка видна и на своём цвете, и на чужом. */
		&__opened {
			position: absolute;
			right: 0.5rem;
			bottom: 0.375rem;
			width: 0.25rem;
			height: 0.25rem;
			border-radius: 9999px;

			&--red {
				background: var(--team-red-bright);
			}

			&--blue {
				background: var(--team-blue-bright);
			}
		}
	}

	@keyframes card-tile-shake {
		0%,
		100% {
			transform: translateX(0);
		}

		15% {
			transform: translateX(-5px);
		}

		30% {
			transform: translateX(4px);
		}

		45% {
			transform: translateX(-3px);
		}

		60% {
			transform: translateX(3px);
		}

		75% {
			transform: translateX(-2px);
		}

		90% {
			transform: translateX(1px);
		}
	}
</style>

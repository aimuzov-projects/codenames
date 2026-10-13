<script lang="ts">
	import Lightbulb from '@lucide/svelte/icons/lightbulb'

	import { openComposer } from '#frontend/components/game/clue-composer.svelte'
	import { modeAtom, myRoleAtom, myTeamAtom, viewAtom, viewRoleAtom } from '#frontend/state/session.ts'
	import { timerSecondsAtom } from '#frontend/state/settings.ts'

	type Props = {
		/** Fraction of turn time left, 0..1; null -- no countdown right now. */
		timeFrac: number | null
	}

	let { timeFrac }: Props = $props()

	const TEAM_GEN = { red: 'красных', blue: 'синих' } as const

	const view = $derived($viewAtom)
	const team = $derived(view?.currentTeam ?? 'red')
	const over = $derived(view?.phase === 'over')
	// All clue words are revealed -- a bonus guess is left (exactly one).
	const isBonus = $derived((view?.guessesRemaining ?? 0) <= 1)
	// During the bonus we show this team's clue from its previous turn; on the first turn there's none yet --
	// then we put "…" instead of nothing so the word block doesn't collapse.
	const clueWord = $derived(isBonus ? (view?.prevClueWord[team] ?? '…') : (view?.clue?.word ?? null))
	const isLocal = $derived($modeAtom === 'local')
	// Timer is on in settings -- always reserve room for the bar (even before the clue)
	// so content doesn't jump on the clue → guess transition. The bar itself is drawn from timeFrac.
	const timerOn = $derived($timerSecondsAtom > 0)
	const inClue = $derived(!over && view?.phase === 'clue')
	// The viewer can give a clue (spymaster in the clue phase) -- the input itself opens from the footer.
	const canCompose = $derived(
		inClue && (isLocal ? $viewRoleAtom === 'spymaster' : $myTeamAtom === team && $myRoleAtom === 'spymaster'),
	)
	// The "Waiting for a clue" prompt is shown for the whole clue phase locally (and under the phone handoff
	// gate): the "pass the phone" instruction comes from the pass-phone modal itself, the bar doesn't repeat it.
	const showInvite = $derived(canCompose || (inClue && isLocal))

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault()
			openComposer()
		}
	}
</script>

<!-- Turn status area: the active clue or waiting for the spymaster (the input itself is in clue-composer). -->
{#if view}
	<!-- svelte-ignore a11y_no_static_element_interactions, a11y_no_noninteractive_tabindex -->
	<div
		class="clue-bar clue-bar--{team}"
		class:clue-bar--timer={timerOn}
		class:clue-bar--over={over}
		class:clue-bar--action={canCompose}
		class:clue-bar--sheen={!view.clue && showInvite}
		role={canCompose ? 'button' : undefined}
		tabindex={canCompose ? 0 : undefined}
		onclick={canCompose ? openComposer : undefined}
		onkeydown={canCompose ? onkeydown : undefined}
	>
		{#if view.clue}
			<!-- A bonus guess looks like a regular clue -- only the caption and the number change. -->
			<div class="clue-bar__text">
				<span class="clue-bar__caption">{isBonus ? 'Бонусное угадывание' : `Подсказка ${TEAM_GEN[team]}`}</span>
				{#if clueWord}<span class="clue-bar__word">{clueWord}</span>{/if}
			</div>
			<span class="clue-bar__chip clue-bar__chip--solid">{isBonus ? view.guessesRemaining : view.clue.count}</span
			>
		{:else if showInvite}
			<!-- Mirrors the clue layout: text on the left, icon chip on the right (where the word count goes). -->
			<div class="clue-bar__text">
				<span class="clue-bar__caption">Ход капитана {TEAM_GEN[team]}</span>
				<span class="clue-bar__word">Ожидаем подсказки</span>
			</div>
			<span class="clue-bar__chip clue-bar__chip--tint"><Lightbulb size={20} /></span>
		{:else}
			<span class="clue-bar__waiting">Капитан {TEAM_GEN[team]} придумывает подсказку</span>
		{/if}

		<!--
			Turn timer -- a "draining" bar along the bottom edge of the block. We always draw it when the timer
			is on: outside the guess phase timeFrac === null, and then an empty gray track fills the space reserved
			at the bottom so content doesn't "hang" above center.
		-->
		{#if timerOn}
			<div
				class="clue-bar__timer"
				role="progressbar"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round((timeFrac ?? 0) * 100)}
			>
				<div class="clue-bar__timer-fill" style:width="{(timeFrac ?? 0) * 100}%"></div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.clue-bar {
		--team: var(--team-red);
		--team-fg: var(--team-red-foreground);
		--team-tint: var(--team-red-tint);
		--team-tint-fg: var(--team-red-tint-foreground);

		position: relative;
		overflow: hidden;
		display: flex;
		gap: 0.75rem;
		align-items: center;
		justify-content: space-between;
		height: 70px;
		padding-inline: 1rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-xl);
		background: var(--card);

		&--blue {
			--team: var(--team-blue);
			--team-fg: var(--team-blue-foreground);
			--team-tint: var(--team-blue-tint);
			--team-tint-fg: var(--team-blue-tint-foreground);
		}

		/* The timer bar takes the bottom 6px -- reserve them so content stays centered. */
		&--timer {
			padding-bottom: 6px;
		}

		&--over {
			opacity: 0.5;
		}

		/* Tapping the prompt bar opens the composer -- same as the "Come up with a clue" button. */
		&--action {
			cursor: pointer;
			user-select: none;

			&:active {
				opacity: 0.9;
			}
		}

		/* Prompt shine: same as the main CTA's, but only while we're calling for a move. */
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
			animation: clue-bar-sheen 3.5s ease-in-out infinite;

			@media (--reduced-motion) {
				display: none;
			}
		}

		&__text {
			display: flex;
			flex-direction: column;
			min-width: 0;
		}

		&__caption {
			font-size: 10px;
			font-weight: 700;
			color: var(--muted-foreground);
			text-transform: uppercase;
			letter-spacing: 0.025em;
		}

		&__word {
			overflow: hidden;
			font-size: 1.5rem;
			font-weight: 600;
			line-height: 1.33;
			text-overflow: ellipsis;
			text-transform: lowercase;
			letter-spacing: 0.025em;
			white-space: nowrap;
		}

		&__chip {
			display: flex;
			flex-shrink: 0;
			align-items: center;
			justify-content: center;
			width: 2.5rem;
			height: 2.5rem;
			border-radius: var(--radius-xl);

			&--solid {
				font-size: 1.25rem;
				font-weight: 700;
				color: var(--team-fg);
				background: var(--team);
			}

			/* Soft fill for the "come up with a clue" prompt icon. */
			&--tint {
				color: var(--team-tint-fg);
				background: var(--team-tint);
			}
		}

		&__waiting {
			font-size: 0.875rem;
			font-weight: 500;
			color: var(--muted-foreground);
		}

		&__timer {
			position: absolute;
			inset-inline: 0;
			bottom: 0;
			height: 6px;
			background: color-mix(in oklch, var(--foreground) 10%, transparent);
		}

		&__timer-fill {
			height: 100%;
			background: var(--team);
			transition: width 250ms linear;
		}
	}

	@keyframes clue-bar-sheen {
		0% {
			left: -45%;
		}

		35%,
		100% {
			left: 125%;
		}
	}
</style>

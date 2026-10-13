<script lang="ts">
	import type { Team } from '#frontend/game/index.ts'

	type Props = {
		team: Team
		count: number
		active: boolean
		/** Mirrors the content toward the screen center: dot and number by the center, status by the outer edge. */
		mirror?: boolean
		/** When passed, the chip becomes a button (a tap opens stats). */
		onclick?: () => void
	}

	let { team, count, active, mirror = false, onclick }: Props = $props()

	const LABEL: Record<Team, string> = { red: 'Красные', blue: 'Синие' }
</script>

<!-- Team score chip: dot + number of words left + turn status. -->
{#snippet content()}
	<span class="score-chip__dot"></span>
	<span class="score-chip__count">{count}</span>
	<span class="score-chip__status">{LABEL[team]} {active ? 'ходят' : 'ожидают'}</span>
{/snippet}

{#if onclick}
	<button
		type="button"
		class="score-chip score-chip--{team} score-chip--button"
		class:score-chip--mirror={mirror}
		class:score-chip--active={active}
		{onclick}
		aria-label="Открыть статистику"
	>
		{@render content()}
	</button>
{:else}
	<div class="score-chip score-chip--{team}" class:score-chip--mirror={mirror} class:score-chip--active={active}>
		{@render content()}
	</div>
{/if}

<style>
	.score-chip {
		--team: var(--team-red);
		--team-fg: var(--team-red-foreground);

		display: flex;
		flex: 1;
		gap: 0.625rem;
		align-items: center;
		padding: 0.625rem 0.75rem;
		border: 0;
		border-radius: var(--radius-xl);
		color: var(--card-foreground);
		background: var(--card);
		box-shadow: 0 0 0 1px color-mix(in oklch, var(--foreground) 10%, transparent);

		&--blue {
			--team: var(--team-blue);
			--team-fg: var(--team-blue-foreground);
		}

		&--mirror {
			flex-direction: row-reverse;
		}

		&--active {
			color: var(--team-fg);
			background: var(--team);
			box-shadow: none;
		}

		&--button {
			outline: none;
			transition: transform 150ms;

			&:active {
				transform: scale(0.98);
			}

			&:focus-visible {
				box-shadow: 0 0 0 2px var(--ring);
			}
		}

		&__dot {
			flex-shrink: 0;
			width: 0.625rem;
			height: 0.625rem;
			border-radius: 9999px;
			background: var(--team);

			.score-chip--active & {
				opacity: 0.9;
				background: currentcolor;
			}
		}

		&__count {
			font-size: 1.125rem;
			font-weight: 700;
			line-height: 1;
		}

		&__status {
			flex: 1;
			font-size: 10px;
			font-weight: 600;
			line-height: 1;
			color: var(--muted-foreground);
			text-align: right;
			text-transform: uppercase;
			letter-spacing: 0.025em;
			white-space: nowrap;

			.score-chip--mirror & {
				text-align: left;
			}

			.score-chip--active & {
				color: inherit;
				opacity: 0.9;
			}
		}
	}
</style>

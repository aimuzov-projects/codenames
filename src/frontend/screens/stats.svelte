<script lang="ts">
	import Check from '@lucide/svelte/icons/check'
	import Skull from '@lucide/svelte/icons/skull'
	import X from '@lucide/svelte/icons/x'

	import WordToken from '#frontend/components/game/word-token.svelte'
	import Screen from '#frontend/components/screen.svelte'
	import TopBar from '#frontend/components/top-bar.svelte'
	import type { CardType, LogEntry, Team } from '#frontend/game/index.ts'
	import { scoreAtom, viewAtom } from '#frontend/state/session.ts'
	import { goBack, goTo, statsTeamAtom } from '#frontend/state/ui.ts'

	const TEAM_NOM: Record<Team, string> = { red: 'Красные', blue: 'Синие' }

	/** Outcome of a reveal relative to the revealing team. */
	type Outcome = 'correct' | 'wrong' | 'assassin'

	const OUTCOME_ICON = { correct: Check, wrong: X, assassin: Skull } as const

	type Reveal = { word: string; type: CardType; outcome: Outcome }

	type Turn = {
		team: Team
		clue: { word: string; count: number }
		reveals: Reveal[]
		/** The turn was ended voluntarily ("End turn" was pressed). */
		passed: boolean
		startAt: number
	}

	/** Groups the flat log into turns: a clue + the cards revealed under it. */
	function buildTurns(log: LogEntry[]): Turn[] {
		const turns: Turn[] = []
		let current: Turn | null = null
		for (const e of log) {
			if (e.kind === 'clue') {
				current = {
					team: e.team,
					clue: { word: e.word, count: e.count },
					reveals: [],
					passed: false,
					startAt: e.at,
				}
				turns.push(current)
			} else if (e.kind === 'reveal' && current) {
				const outcome: Outcome = e.type === 'assassin' ? 'assassin' : e.type === e.team ? 'correct' : 'wrong'
				current.reveals.push({ word: e.word, type: e.type, outcome })
			} else if (e.kind === 'pass' && current) {
				current.passed = true
			}
		}
		return turns
	}

	/** Time relative to the game start, formatted as "m:ss". */
	function fmtRel(ms: number): string {
		const total = Math.max(0, Math.round(ms / 1000))
		const m = Math.floor(total / 60)
		const s = total % 60
		return `${m}:${s.toString().padStart(2, '0')}`
	}

	const view = $derived($viewAtom)
	const sc = $derived($scoreAtom)
	const team = $derived($statsTeamAtom)

	// No game (e.g. it was closed) -- stats have nothing to show.
	$effect(() => {
		if (!view) goTo('home')
	})

	const turns = $derived(view ? buildTurns(view.log) : [])
	const t0 = $derived(view?.log[0]?.at ?? 0)
	const tEnd = $derived(view?.log.at(-1)?.at ?? 0)

	const totalOf = (t: Team) => (view?.startingTeam === t ? 9 : 8)
	const foundOf = (t: Team) => totalOf(t) - sc[t]

	const winner = $derived(view?.winner ?? null)
	const assassinHit = $derived(view?.cards.some((c) => c.revealed && c.type === 'assassin') ?? false)

	// Team filter mode (tap on a score chip): show only that team's data.
	const teamTurns = $derived(team ? turns.filter((t) => t.team === team) : turns)
	// Team time -- the sum of its turn durations (until the next turn starts / the game ends).
	const teamTime = $derived(
		team
			? turns.reduce(
					(sum, t, i) => (t.team === team ? sum + ((turns[i + 1]?.startAt ?? tEnd) - t.startAt) : sum),
					0,
				)
			: 0,
	)
</script>

{#snippet metric(label: string, value: string, dot?: Team)}
	<div class="stats__metric">
		{#if dot}<span class="stats__dot stats__dot--{dot}"></span>{/if}
		<div>
			<div class="stats__metric-value">{value}</div>
			<div class="stats__metric-label">{label}</div>
		</div>
	</div>
{/snippet}

{#snippet hero(t: Team, title: string, subtitle: string)}
	<div class="stats__hero">
		<div class="stats__badge stats__badge--{t}"><WordToken size={22} /></div>
		<div class="stats__hero-text">
			<div class="stats__hero-title">{title}</div>
			<div class="stats__hero-subtitle">{subtitle}</div>
		</div>
	</div>
{/snippet}

<Screen bottomFade onback={goBack}>
	{#snippet header()}
		<TopBar title={team ? `Статистика · ${TEAM_NOM[team]}` : 'Статистика'} onback={goBack} />
	{/snippet}
	{#if view}
		{#if team}
			{@render hero(team, TEAM_NOM[team], `Найдено слов: ${foundOf(team)}/${totalOf(team)}`)}
			<div class="stats__metrics">
				{@render metric('Ходов', String(teamTurns.length))}
				{@render metric('Время', fmtRel(teamTime))}
			</div>
		{:else}
			{#if winner}
				{@render hero(
					winner,
					`${TEAM_NOM[winner]} победили`,
					assassinHit
						? `${TEAM_NOM[winner === 'red' ? 'blue' : 'red']} попались на ассасина`
						: 'Все свои слова найдены',
				)}
			{/if}
			<div class="stats__metrics">
				{@render metric('Красные', `${foundOf('red')}/${totalOf('red')}`, 'red')}
				{@render metric('Синие', `${foundOf('blue')}/${totalOf('blue')}`, 'blue')}
				{@render metric('Ходов', String(turns.length))}
				{@render metric('Время', fmtRel(tEnd - t0))}
			</div>
		{/if}

		<h2 class="stats__heading">Таймлайн</h2>
		{#if teamTurns.length === 0}
			<p class="stats__empty">Нет данных о ходах.</p>
		{:else}
			<div class="stats__turns">
				{#each teamTurns as turn, i (i)}
					<div class="stats__turn stats__turn--{turn.team}">
						<!-- clue + turn time -->
						<div class="stats__clue">
							<span class="stats__dot stats__dot--{turn.team}"></span>
							<span class="stats__clue-word">
								{turn.clue.word} <span class="stats__clue-count">· {turn.clue.count}</span>
							</span>
							<span class="stats__time">{fmtRel(turn.startAt - t0)}</span>
						</div>

						{#if turn.reveals.length > 0}
							<div class="stats__reveals">
								{#each turn.reveals as r, j (j)}
									{@const Icon = OUTCOME_ICON[r.outcome]}
									<span class="stats__reveal stats__reveal--{r.type}"><Icon size={14} />{r.word}</span
									>
								{/each}
							</div>
						{/if}

						{#if turn.reveals.length === 0 && !turn.passed}
							<div class="stats__note">Открытий не было</div>
						{/if}
						{#if turn.passed}<div class="stats__note">Ход завершён</div>{/if}
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</Screen>

<style>
	.stats {
		&__hero {
			display: flex;
			gap: 0.75rem;
			align-items: center;
			padding: 0.75rem;
			border-radius: var(--radius-2xl);
			background: var(--card);
			box-shadow: 0 0 0 1px color-mix(in oklch, var(--foreground) 10%, transparent);
		}

		&__badge {
			display: flex;
			flex-shrink: 0;
			align-items: center;
			justify-content: center;
			width: 3rem;
			height: 3rem;
			border-radius: var(--radius-xl);

			&--red {
				color: var(--team-red-foreground);
				background: var(--team-red);
			}

			&--blue {
				color: var(--team-blue-foreground);
				background: var(--team-blue);
			}
		}

		&__hero-text {
			min-width: 0;
		}

		&__hero-title {
			font-size: 1.125rem;
			font-weight: 700;
			line-height: 1.25;
		}

		&__hero-subtitle {
			font-size: 0.875rem;
			color: var(--muted-foreground);
		}

		&__metrics {
			display: grid;
			grid-template-columns: repeat(2, 1fr);
			gap: 0.625rem;
		}

		&__metric {
			display: flex;
			gap: 0.625rem;
			align-items: center;
			padding: 0.625rem 0.75rem;
			border-radius: var(--radius-xl);
			line-height: 1;
			background: var(--card);
			box-shadow: 0 0 0 1px color-mix(in oklch, var(--foreground) 10%, transparent);
		}

		&__metric-value {
			font-size: 1rem;
			font-weight: 700;
		}

		&__metric-label {
			margin-top: 0.25rem;
			font-size: 10px;
			font-weight: 600;
			color: var(--muted-foreground);
			text-transform: uppercase;
			letter-spacing: 0.025em;
		}

		&__dot {
			flex-shrink: 0;
			width: 0.625rem;
			height: 0.625rem;
			border-radius: 9999px;

			&--red {
				background: var(--team-red);
			}

			&--blue {
				background: var(--team-blue);
			}
		}

		&__heading {
			margin-top: 0.25rem;
			font-size: 0.875rem;
			font-weight: 600;
			color: var(--muted-foreground);
		}

		&__empty {
			font-size: 0.875rem;
			color: var(--muted-foreground);
		}

		&__turns {
			display: flex;
			flex-direction: column;
			gap: 0.625rem;
		}

		&__turn {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			padding: 0.75rem;
			border-left: 4px solid;
			border-radius: var(--radius-xl);
			background: var(--card);
			box-shadow: 0 0 0 1px color-mix(in oklch, var(--foreground) 10%, transparent);

			&--red {
				border-left-color: var(--team-red);
			}

			&--blue {
				border-left-color: var(--team-blue);
			}
		}

		&__clue {
			display: flex;
			gap: 0.5rem;
			align-items: center;
		}

		&__clue-word {
			font-weight: 600;
		}

		&__clue-count {
			color: var(--muted-foreground);
		}

		&__time {
			flex-shrink: 0;
			margin-left: auto;
			font-size: 0.75rem;
			font-variant-numeric: tabular-nums;
			color: var(--muted-foreground);
		}

		&__reveals {
			display: flex;
			flex-wrap: wrap;
			gap: 0.375rem;
		}

		&__reveal {
			display: inline-flex;
			gap: 0.25rem;
			align-items: center;
			padding: 0.25rem 0.5rem;
			border-radius: var(--radius-md);
			font-size: 0.75rem;
			font-weight: 600;

			&--red {
				color: var(--team-red-foreground);
				background: var(--team-red);
			}

			&--blue {
				color: var(--team-blue-foreground);
				background: var(--team-blue);
			}

			&--neutral {
				color: var(--card-neutral-foreground);
				background: var(--card-neutral);
			}

			&--assassin {
				color: var(--card-assassin-foreground);
				background: var(--card-assassin);
			}
		}

		&__note {
			font-size: 0.75rem;
			color: var(--muted-foreground);
		}
	}
</style>

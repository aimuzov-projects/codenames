<script lang="ts">
	import ChartColumn from '@lucide/svelte/icons/chart-column'
	import Check from '@lucide/svelte/icons/check'
	import Lightbulb from '@lucide/svelte/icons/lightbulb'
	import LogOut from '@lucide/svelte/icons/log-out'
	import RefreshCw from '@lucide/svelte/icons/refresh-cw'
	import X from '@lucide/svelte/icons/x'

	import { resumeAudio } from '#frontend/audio/sfx.ts'
	import CardTile from '#frontend/components/game/card-tile.svelte'
	import ClueBar from '#frontend/components/game/clue-bar.svelte'
	import ClueComposer, { openComposer } from '#frontend/components/game/clue-composer.svelte'
	import ConnectionBar from '#frontend/components/game/connection-bar.svelte'
	import PassPhone from '#frontend/components/game/pass-phone.svelte'
	import PlayerBadge from '#frontend/components/game/player-badge.svelte'
	import ScoreChip from '#frontend/components/game/score-chip.svelte'
	import WordToken from '#frontend/components/game/word-token.svelte'
	import Screen from '#frontend/components/screen.svelte'
	import TopBar from '#frontend/components/top-bar.svelte'
	import Button from '#frontend/components/ui/button.svelte'
	import Dialog from '#frontend/components/ui/dialog.svelte'
	import type { Team } from '#frontend/game/index.ts'
	import { endTurnLock, gameFeedback, turnTimer } from '#frontend/lib/game-hooks.svelte.ts'
	import { hostStartGame, leaveSession } from '#frontend/state/net.ts'
	import {
		endTurn,
		modeAtom,
		myRoleAtom,
		myTeamAtom,
		revealCard,
		revealLockedAtom,
		scoreAtom,
		startGame,
		viewAtom,
		viewRoleAtom,
	} from '#frontend/state/session.ts'
	import { hideRevealedWordsAtom } from '#frontend/state/settings.ts'
	import { goTo, goToStats, selectedWordsAtom } from '#frontend/state/ui.ts'

	const TEAM_NOM: Record<Team, string> = { red: 'Красные', blue: 'Синие' }

	const view = $derived($viewAtom)
	const mode = $derived($modeAtom)

	let confirmExit = $state(false)
	let confirmNewGame = $state(false)
	let confirmEmptyPass = $state(false)

	gameFeedback(() => view)
	const timer = turnTimer(
		() => view,
		() => mode,
	)
	const lock = endTurnLock(() => view)

	// The "end turn without guesses" dialog only makes sense in an active guess phase. If the turn
	// ended while the dialog is open (e.g. the turn timer ran out) -- close it, otherwise it
	// stays hanging under the phone handoff gate.
	const guessTurnActive = $derived(!!view && view.phase === 'guess' && !!view.clue)

	$effect(() => {
		if (!guessTurnActive) confirmEmptyPass = false
	})

	// Board without a game: a network guest just waits for the host's state (after "New game" the lobby
	// arrives first, the state follows), so we leave it alone. In a local/host game a board without a
	// game makes no sense, send them to the menu.
	$effect(() => {
		if (!view && mode !== 'guest') goTo('home')
	})

	const team = $derived(view?.currentTeam ?? 'red')
	const over = $derived(view?.phase === 'over')
	const isLocal = $derived(mode === 'local')
	// A network viewer plays for their own team in their own role; in hot-seat everyone takes turns.
	const myOperativeTurn = $derived(isLocal || (team === $myTeamAtom && $myRoleAtom === 'operative'))

	const interactive = $derived(view?.phase === 'guess' && myOperativeTurn)
	const canEnd = $derived(!over && !!view?.clue && myOperativeTurn)
	// By the rules only an operative ends the turn, not the spymaster.
	const viewerIsOperative = $derived(isLocal ? $viewRoleAtom === 'operative' : $myRoleAtom === 'operative')
	// The spymaster can give a clue (clue phase): the footer shows "Come up with a clue" instead of "End turn".
	const canCompose = $derived(
		!over &&
			view?.phase === 'clue' &&
			(isLocal ? $viewRoleAtom === 'spymaster' : team === $myTeamAtom && $myRoleAtom === 'spymaster'),
	)

	function reveal(i: number) {
		resumeAudio()
		revealCard(i)
	}

	function newGame() {
		if (mode === 'host') hostStartGame({ words: selectedWordsAtom() })
		else startGame({ words: selectedWordsAtom() })
	}

	function toMenu() {
		if (!isLocal) leaveSession()

		goTo('home')
	}

	// The game has "started" if a clue was already given or at least one card is revealed.
	const inProgress = $derived(!over && !!view && (!!view.clue || view.cards.some((c) => c.revealed)))
	const requestBack = () => (inProgress ? (confirmExit = true) : toMenu())
	const requestNewGame = () => (inProgress ? (confirmNewGame = true) : newGame())

	// Button lock at the start of a turn (countdown) -- swallows a stray tap while handing the phone over.
	const endLocked = $derived(lock.left > 0)
	// Not a single word revealed this turn: the guess counter is still at max (clue.count + 1).
	// A wrong reveal ends the turn by itself, so only correct ones get as far as the button.
	const noGuessesThisTurn = $derived(!!view?.clue && view.guessesRemaining === view.clue.count + 1)
	const requestEndTurn = () => (noGuessesThisTurn ? (confirmEmptyPass = true) : endTurn())

	const assassinHit = $derived(!!view?.cards.some((c) => c.revealed && c.type === 'assassin'))
	const winner = $derived(view?.winner ?? null)
	// Victory overlay -- only after the reveal animation of the last card.
	const winOpen = $derived(over && !!winner && !$revealLockedAtom)
</script>

{#if view}
	<Screen gap="tight" onback={requestBack}>
		{#snippet header()}
			<TopBar onback={requestBack}>
				{#snippet heading()}<PlayerBadge />{/snippet}
				{#snippet right()}
					<Button variant="outline" size="icon" onclick={() => goToStats()} aria-label="Статистика">
						<ChartColumn />
					</Button>
					{#if mode !== 'guest'}
						<Button variant="outline" size="icon" onclick={requestNewGame} aria-label="Новая игра">
							<RefreshCw />
						</Button>
					{/if}
				{/snippet}
			</TopBar>
		{/snippet}

		<!-- Connection status (network modes). -->
		<ConnectionBar />

		<div class="board__score">
			<ScoreChip
				team="red"
				count={$scoreAtom.red}
				active={team === 'red'}
				mirror
				onclick={() => goToStats('red')}
			/>
			<ScoreChip team="blue" count={$scoreAtom.blue} active={team === 'blue'} onclick={() => goToStats('blue')} />
		</div>

		<ClueBar timeFrac={timer.fraction} />

		<div class="board__grid">
			{#each view.cards as card, i (i)}
				<CardTile {card} {interactive} hideWord={$hideRevealedWordsAtom} onreveal={() => reveal(i)} />
			{/each}
		</div>

		<!-- Footer: the spymaster gives a clue, an operative ends the turn. -->
		{#if canCompose}
			<div class="board__footer board__footer--{team}">
				<Button size="lg" ripple block onclick={openComposer}>
					<Lightbulb />
					Придумать подсказку
				</Button>
			</div>
		{:else if viewerIsOperative}
			<div
				class="board__footer"
				class:board__footer--red={canEnd && team === 'red'}
				class:board__footer--blue={canEnd && team === 'blue'}
			>
				<Button size="lg" ripple block disabled={!canEnd || endLocked} onclick={requestEndTurn}>
					<Check />
					<span>
						Завершить ход
						{#if endLocked}
							· <span class="board__lock">{lock.left}</span>
						{/if}
					</span>
				</Button>
			</div>
		{/if}

		<!-- Clue input overlay (above the board, the field is premounted). -->
		<ClueComposer />

		<!-- Phone handoff gate to the spymaster (hot-seat). -->
		<PassPhone />

		<!-- Exit confirmation during a game. -->
		<Dialog open={confirmExit} onclose={() => (confirmExit = false)} alert title="Выйти из игры?">
			{#snippet description()}Партия уже идёт. Если выйти, текущая игра будет потеряна.{/snippet}
			{#snippet actions()}
				<Button variant="outline" onclick={() => (confirmExit = false)}>
					<X />
					Отмена
				</Button>
				<Button onclick={toMenu}>
					<LogOut />
					Выйти
				</Button>
			{/snippet}
		</Dialog>

		<!-- New game confirmation during a game. -->
		<Dialog open={confirmNewGame} onclose={() => (confirmNewGame = false)} alert title="Начать новую игру?">
			{#snippet description()}Партия уже идёт. Если начать заново, текущая игра будет потеряна.{/snippet}
			{#snippet actions()}
				<Button variant="outline" onclick={() => (confirmNewGame = false)}>
					<X />
					Отмена
				</Button>
				<Button
					onclick={() => {
						confirmNewGame = false
						newGame()
					}}
				>
					<RefreshCw />
					Начать заново
				</Button>
			{/snippet}
		</Dialog>

		<!-- Confirmation for ending the turn without a single guess (guards against a stray tap). -->
		<Dialog
			open={confirmEmptyPass}
			onclose={() => (confirmEmptyPass = false)}
			alert
			title="Завершить ход без догадок?"
		>
			{#snippet description()}Вы не открыли ни одного слова. Точно завершить ход?{/snippet}
			{#snippet actions()}
				<!-- "Cancel" is the main button (CTA): the safe outcome if the dialog was opened by accident. -->
				<Button onclick={() => (confirmEmptyPass = false)}>
					<X />
					Отмена
				</Button>
				<Button
					variant="outline"
					onclick={() => {
						confirmEmptyPass = false
						endTurn()
					}}
				>
					<Check />
					Завершить ход
				</Button>
			{/snippet}
		</Dialog>

		<!-- Victory overlay. -->
		<Dialog
			open={winOpen}
			onclose={() => {}}
			dismissible={false}
			centered
			title="{TEAM_NOM[winner ?? 'red']} победили"
		>
			{#snippet lead()}
				<div class="board__trophy board__trophy--{winner ?? 'red'}"><WordToken size={26} /></div>
			{/snippet}
			{#snippet description()}
				{assassinHit
					? `${TEAM_NOM[winner === 'red' ? 'blue' : 'red']} попались на ассасина`
					: 'Все свои слова найдены'}
			{/snippet}
			<div class="board__win-actions">
				{#if mode !== 'guest'}
					<Button size="lg" ripple block onclick={newGame}>Новая игра</Button>
				{/if}
				<Button variant="outline" block onclick={() => goToStats()}>Статистика</Button>
				<Button variant="outline" block onclick={toMenu}>В меню</Button>
			</div>
		</Dialog>
	</Screen>
{/if}

<style>
	.board {
		&__score {
			display: flex;
			gap: 0.625rem;
		}

		&__grid {
			display: grid;
			grid-template-columns: repeat(5, minmax(0, 1fr));
			gap: 7px;
		}

		/* Button in the team color: repaint it via the primary variables. */
		&__footer {
			display: flex;

			&--red {
				--primary: var(--team-red);
				--primary-foreground: var(--team-red-foreground);
			}

			&--blue {
				--primary: var(--team-blue);
				--primary-foreground: var(--team-blue-foreground);
			}
		}

		&__lock {
			display: inline-block;
			width: 1ch;
			font-variant-numeric: tabular-nums;
			text-align: center;
		}

		&__trophy {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 4rem;
			height: 4rem;
			border-radius: var(--radius-2xl);

			&--red {
				color: var(--team-red-foreground);
				background: var(--team-red);
			}

			&--blue {
				color: var(--team-blue-foreground);
				background: var(--team-blue);
			}
		}

		&__win-actions {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			width: 100%;
			max-width: 20rem;
		}
	}
</style>

<script lang="ts">
	import Crown from '@lucide/svelte/icons/crown'
	import Eye from '@lucide/svelte/icons/eye'

	import Button from '#frontend/components/ui/button.svelte'
	import Dialog from '#frontend/components/ui/dialog.svelte'
	import type { Team } from '#frontend/game/index.ts'
	import { handoffReasonAtom, modeAtom, revealLockedAtom, viewAtom, viewRoleAtom } from '#frontend/state/session.ts'

	const TEAM_GEN: Record<Team, string> = { red: 'красных', blue: 'синих' }

	const open = $derived(
		$modeAtom === 'local' && $viewAtom?.phase === 'clue' && $viewRoleAtom === 'operative' && !$revealLockedAtom,
	)
	const team = $derived($viewAtom?.currentTeam ?? 'red')
	const reason = $derived($handoffReasonAtom)
</script>

<!--
	Phone handoff gate to the spymaster (hot-seat only). Shows up when it's the spymaster's turn
	(clue phase in the operative view) and blocks the board until the spymaster confirms they have the phone --
	only then does the spymaster view with the key open. Closed by its single button.
-->
<Dialog {open} onclose={() => {}} dismissible={false} centered title="Ход капитана">
	{#snippet lead()}
		{#if reason}
			<div class="pass-phone__reason">
				<p class="pass-phone__reason-caption">
					{reason.type === 'neutral' ? 'Вы открыли общее слово' : 'Вы открыли слово соперников'}
				</p>
				<span class="pass-phone__reason-word pass-phone__reason-word--{reason.type}">{reason.word}</span>
			</div>
		{/if}
		<div class="pass-phone__icon pass-phone__icon--{team}"><Crown size={30} /></div>
	{/snippet}
	{#snippet description()}Передайте телефон капитану {TEAM_GEN[team]}{/snippet}
	<div class="pass-phone__action pass-phone__action--{team}">
		<Button size="lg" block onclick={() => viewRoleAtom.set('spymaster')}>
			<Eye />
			Показать поле
		</Button>
	</div>
</Dialog>

<style>
	.pass-phone {
		&__reason {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}

		&__reason-caption {
			font-size: 0.875rem;
			color: var(--muted-foreground);
		}

		&__reason-word {
			font-size: 1.125rem;
			font-weight: 700;

			&--red {
				color: var(--team-red);
			}

			&--blue {
				color: var(--team-blue);
			}
		}

		&__icon {
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

		/* Button in the team color: repaint it via its own primary variables. */
		&__action {
			width: 100%;
			max-width: 20rem;

			&--red {
				--primary: var(--team-red);
				--primary-foreground: var(--team-red-foreground);
			}

			&--blue {
				--primary: var(--team-blue);
				--primary-foreground: var(--team-blue-foreground);
			}
		}
	}
</style>

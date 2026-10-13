<script lang="ts">
	import Crown from '@lucide/svelte/icons/crown'
	import Target from '@lucide/svelte/icons/target'

	import type { Role, Team } from '#frontend/game/index.ts'
	import { myNameAtom } from '#frontend/state/net.ts'
	import { modeAtom, myRoleAtom, myTeamAtom, viewAtom } from '#frontend/state/session.ts'

	const ROLE_LABEL: Record<Role, string> = { spymaster: 'Капитан', operative: 'Игрок' }
	const ROLE_ICON = { spymaster: Crown, operative: Target }

	const local = $derived($modeAtom === 'local')
	const team = $derived<Team>(local ? ($viewAtom?.currentTeam ?? 'red') : $myTeamAtom)
	const role = $derived<Role>(local ? ($viewAtom?.phase === 'clue' ? 'spymaster' : 'operative') : $myRoleAtom)
	const Icon = $derived(ROLE_ICON[role])
	// The name exists only in network modes (entered when connecting); hot-seat has none.
	const name = $derived(local ? '' : $myNameAtom.trim())
</script>

<!--
	Role badge in the board header: role icon in the team tint chip + role name in the team color.
	Locally (hot-seat) shows the active player of the turn (spymaster in the clue phase, operative otherwise);
	online -- your own fixed role and the name given when connecting.
-->
{#if $viewAtom}
	<div class="player-badge player-badge--{team}">
		<span class="player-badge__icon"><Icon size={20} /></span>
		{#if name}
			<span class="player-badge__named">
				<span class="player-badge__name">{name}</span>
				<span class="player-badge__role-caption">{ROLE_LABEL[role]}</span>
			</span>
		{:else}
			<span class="player-badge__name">{ROLE_LABEL[role]}</span>
		{/if}
	</div>
{/if}

<style>
	.player-badge {
		--team: var(--team-red);
		--team-tint: var(--team-red-tint);
		--team-tint-fg: var(--team-red-tint-foreground);

		display: flex;
		flex: 1;
		gap: 0.5rem;
		align-items: center;
		min-width: 0;

		&--blue {
			--team: var(--team-blue);
			--team-tint: var(--team-blue-tint);
			--team-tint-fg: var(--team-blue-tint-foreground);
		}

		/* Soft chip fill under the icon -- like the "Spymaster's turn" prompt in clue-bar. */
		&__icon {
			display: flex;
			flex-shrink: 0;
			align-items: center;
			justify-content: center;
			width: 2.25rem;
			height: 2.25rem;
			border-radius: var(--radius-xl);
			color: var(--team-tint-fg);
			background: var(--team-tint);
		}

		&__named {
			display: flex;
			flex-direction: column;
			min-width: 0;
			line-height: 1.25;
		}

		&__name {
			overflow: hidden;
			min-width: 0;
			font-size: 1rem;
			font-weight: 700;
			color: var(--team);
			text-overflow: ellipsis;
			letter-spacing: -0.025em;
			white-space: nowrap;
		}

		&__role-caption {
			font-size: 10px;
			font-weight: 600;
			color: var(--muted-foreground);
			text-transform: uppercase;
			letter-spacing: 0.025em;
		}
	}
</style>

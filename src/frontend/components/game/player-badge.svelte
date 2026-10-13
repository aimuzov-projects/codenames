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
	// Имя есть только в сетевых режимах (вводится при подключении); в hot-seat -- нет.
	const name = $derived(local ? '' : $myNameAtom.trim())
</script>

<!--
	Бейдж роли в хедере доски: иконка роли в тинт-чипе команды + название роли в цвете команды.
	Локально (hot-seat) показывает активного игрока хода (капитан в фазе clue, иначе игрок);
	в сети -- собственную закреплённую роль и имя, указанное при подключении.
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

		/* Мягкая заливка чипа под иконку -- как у приглашения «Ход капитана» в clue-bar. */
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

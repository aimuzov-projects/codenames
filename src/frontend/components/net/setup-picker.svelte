<script lang="ts">
	import Crown from '@lucide/svelte/icons/crown'
	import Dices from '@lucide/svelte/icons/dices'
	import Flag from '@lucide/svelte/icons/flag'
	import Target from '@lucide/svelte/icons/target'
	import type { Component } from 'svelte'

	import Button from '#frontend/components/ui/button.svelte'
	import type { Role, Team } from '#frontend/game/index.ts'

	type Props = {
		team: Team
		role: Role
		/** Disable the spymaster option (the chosen team already has a spymaster). */
		spymasterDisabled?: boolean
		onchange: (team: Team, role: Role) => void
		/** Random team and role pick. The button shows only when this is set. */
		onrandom?: () => void
	}

	let { team, role, spymasterDisabled = false, onchange, onrandom }: Props = $props()

	type Segment = {
		value: string
		label: string
		icon: Component
		/** Color of the "thumb" and the contrasting label when the segment is active. */
		tone: 'red' | 'blue' | 'primary'
		disabled?: boolean
	}

	const teams: Segment[] = [
		{ value: 'red', label: 'Красные', icon: Flag, tone: 'red' },
		{ value: 'blue', label: 'Синие', icon: Flag, tone: 'blue' },
	]

	const roles = $derived<Segment[]>([
		{ value: 'operative', label: 'Игрок', icon: Target, tone: 'primary' },
		{ value: 'spymaster', label: 'Капитан', icon: Crown, tone: 'primary', disabled: spymasterDisabled },
	])
</script>

<!--
	A joined segmented control with a "thumb" that slides to the selected segment. The thumb
	is absolutely positioned and shifted via translateX by index.
-->
{#snippet segmented(label: string, value: string, options: Segment[], select: (value: string) => void)}
	{@const index = options.findIndex((o) => o.value === value)}
	<div class="setup-picker__track" role="radiogroup" aria-label={label}>
		<span
			class="setup-picker__thumb setup-picker__thumb--{options[index]?.tone}"
			aria-hidden="true"
			style:width="calc((100% - 0.5rem) / {options.length})"
			style:transform="translateX({index * 100}%)"
		></span>
		{#each options as option (option.value)}
			<button
				type="button"
				role="radio"
				class="setup-picker__option"
				class:setup-picker__option--active={option.value === value}
				class:setup-picker__option--red={option.value === value && option.tone === 'red'}
				class:setup-picker__option--blue={option.value === value && option.tone === 'blue'}
				aria-checked={option.value === value}
				disabled={option.disabled}
				onclick={() => select(option.value)}
			>
				<option.icon />
				{option.label}
			</button>
		{/each}
	</div>
{/snippet}

<!-- Team and role (spymaster/operative) pick via segmented controls with a thumb. -->
<div class="setup-picker">
	{@render segmented('Команда', team, teams, (t) => onchange(t as Team, role))}
	{@render segmented('Роль', role, roles, (r) => onchange(team, r as Role))}
	{#if onrandom}
		<Button variant="outline" block onclick={onrandom}>
			<Dices />
			Случайно
		</Button>
	{/if}
</div>

<style>
	.setup-picker {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		&__track {
			position: relative;
			display: flex;
			width: 100%;
			padding: 0.25rem;
			border: 1px solid var(--input);
			border-radius: var(--radius-lg);
			background: var(--muted);
		}

		&__thumb {
			pointer-events: none;
			position: absolute;
			inset-block: 0.25rem;
			left: 0.25rem;
			border-radius: var(--radius-md);
			transition:
				transform 200ms ease-out,
				background-color 200ms ease-out;

			@media (--reduced-motion) {
				transition: none;
			}

			&--red {
				background: var(--team-red);
			}

			&--blue {
				background: var(--team-blue);
			}

			&--primary {
				background: var(--primary);
			}
		}

		&__option {
			position: relative;
			z-index: 1;
			display: flex;
			flex: 1;
			gap: 0.375rem;
			align-items: center;
			justify-content: center;
			height: 2.25rem;
			padding: 0;
			border: 0;
			border-radius: var(--radius-md);
			font-size: 0.875rem;
			font-weight: 500;
			color: var(--muted-foreground);
			background: transparent;
			transition: color 150ms;

			&:disabled {
				pointer-events: none;
				opacity: 0.5;
			}

			& :global(.lucide-icon) {
				flex-shrink: 0;
				width: 1rem;
				height: 1rem;
			}

			&--active {
				color: var(--primary-foreground);
			}

			&--red {
				color: var(--team-red-foreground);
			}

			&--blue {
				color: var(--team-blue-foreground);
			}
		}
	}
</style>

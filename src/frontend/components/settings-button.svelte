<script lang="ts">
	import Settings from '@lucide/svelte/icons/settings'

	import Button from '#frontend/components/ui/button.svelte'
	import { hasUnseenChangelogAtom } from '#frontend/state/changelog.ts'
	import { goTo } from '#frontend/state/ui.ts'
</script>

<!-- A dot on the button -- the changelog has unread entries. -->
<span class="settings-button">
	<Button
		variant="outline"
		size="icon"
		ripple
		onclick={() => goTo('settings')}
		aria-label={$hasUnseenChangelogAtom ? 'Настройки (есть новое)' : 'Настройки'}
	>
		<span class="settings-button__icon"><Settings /></span>
	</Button>
	{#if $hasUnseenChangelogAtom}
		<span class="settings-button__dot" aria-hidden="true"></span>
	{/if}
</span>

<style>
	.settings-button {
		position: relative;
		display: inline-flex;

		&__icon {
			display: contents;
			transition: transform 300ms ease-out;

			.settings-button:hover & {
				transform: rotate(45deg);
			}
		}

		&__dot {
			position: absolute;
			top: -0.125rem;
			right: -0.125rem;
			width: 0.625rem;
			height: 0.625rem;
			border-radius: 9999px;
			background: var(--primary);
			box-shadow: 0 0 0 2px var(--background);
		}
	}
</style>

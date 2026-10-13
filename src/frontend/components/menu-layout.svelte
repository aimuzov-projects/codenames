<script lang="ts">
	import type { Snippet } from 'svelte'

	import Logo from '#frontend/components/logo.svelte'
	import { navDirectionAtom } from '#frontend/state/ui.ts'

	let { children }: { children: Snippet } = $props()
</script>

<!--
	Logo above the buttons, vertically centered. The button block has a fixed height for three items,
	so the logo doesn't jump between menus with a different number of buttons. On return only the
	buttons slide in, so the screen needs staticBody.
-->
<div class="menu-layout">
	<Logo />
	<div class="menu-layout__items" class:menu-layout__items--enter-back={$navDirectionAtom === 'back'}>
		{@render children()}
	</div>
</div>

<style>
	.menu-layout {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 2.25rem;
		justify-content: center;

		&__items {
			display: flex;
			flex-direction: column;
			gap: 0.75rem;
			height: 13.5rem;

			&--enter-back {
				animation: screen-in-left 240ms ease-out;

				@media (--reduced-motion) {
					animation: none;
				}
			}
		}
	}
</style>

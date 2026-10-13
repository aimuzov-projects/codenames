<script lang="ts">
	import type { Snippet } from 'svelte'

	import Logo from '#frontend/components/logo.svelte'
	import { navDirectionAtom } from '#frontend/state/ui.ts'

	let { children }: { children: Snippet } = $props()
</script>

<!--
	Логотип над кнопками, по центру по вертикали. Блок кнопок фиксированной высоты под три пункта,
	поэтому логотип не прыгает при переходе между меню с разным числом кнопок. Въезд при возврате
	анимирует только кнопки, экрану нужен staticBody.
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

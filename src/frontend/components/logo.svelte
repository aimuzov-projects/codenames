<script lang="ts">
	import { LOGOS } from '#frontend/components/logo.ts'

	/** Случайный вариант; с `exclude` -- заведомо другой. */
	function pick(exclude?: number): number {
		const candidates = LOGOS.map((_, i) => i).filter((i) => i !== exclude)
		return candidates[Math.floor(Math.random() * candidates.length)]!
	}

	let index = $state(pick())
</script>

<!-- В тёмной теме рисунок инвертируется фильтром: чёрный становится белым. -->
<button type="button" class="logo" onclick={() => (index = pick(index))} aria-label="Сменить логотип">
	<img class="logo__image" src={LOGOS[index]} alt="Codenames" draggable="false" />
</button>

<style>
	.logo {
		display: block;
		margin-inline: auto;
		padding: 0;
		border: 0;
		border-radius: var(--radius-2xl);
		background: none;
		outline: none;
		transition: transform 150ms;

		&:active {
			transform: scale(0.95);
		}

		&:focus-visible {
			box-shadow: 0 0 0 2px var(--ring);
		}

		&__image {
			user-select: none;
			width: 14rem;
			height: auto;

			:global(.dark) & {
				filter: invert(1);
			}
		}
	}
</style>

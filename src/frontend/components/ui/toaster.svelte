<script lang="ts">
	import CircleCheck from '@lucide/svelte/icons/circle-check'
	import LoaderCircle from '@lucide/svelte/icons/loader-circle'
	import OctagonX from '@lucide/svelte/icons/octagon-x'
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert'
	import { fly } from 'svelte/transition'

	import { dismissToast, toastsAtom } from '#frontend/lib/toast.ts'

	const icons = {
		success: CircleCheck,
		error: OctagonX,
		warning: TriangleAlert,
		loading: LoaderCircle,
	}
</script>

<!-- Тосты опущены на уровень хедера, иначе на iOS их прячет чёлка. -->
<section class="toaster" aria-live="polite" aria-label="Уведомления">
	{#each $toastsAtom as toast (toast.id)}
		{@const Icon = icons[toast.type]}
		<button
			type="button"
			class="toaster__toast toaster__toast--{toast.type}"
			transition:fly={{ y: -16, duration: 200 }}
			onclick={() => dismissToast(toast.id)}
		>
			<span class="toaster__icon toaster__icon--{toast.type}" aria-hidden="true">
				<Icon size={toast.type === 'warning' ? 32 : 16} />
			</span>
			<span class="toaster__text">
				<span class="toaster__title">{toast.title}</span>
				{#if toast.description}
					<span class="toaster__description">{toast.description}</span>
				{/if}
			</span>
		</button>
	{/each}
</section>

<style>
	.toaster {
		pointer-events: none;
		position: fixed;
		z-index: 100;
		top: calc(var(--safe-top) + 1rem);
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		width: min(100% - 2rem, 22rem);

		&__toast {
			pointer-events: auto;
			display: flex;
			gap: 0.625rem;
			align-items: center;
			padding: 0.875rem 1rem;
			border: 1px solid var(--border);
			border-radius: var(--radius-lg);
			font-size: 0.8125rem;
			color: var(--popover-foreground);
			text-align: left;
			background: var(--popover);
			box-shadow: 0 4px 12px oklch(0 0 0 / 10%);

			/* Предупреждение о конце хода: крупное и оранжевое, по высоте дотягивается до строки
			   чипов под хедером. */
			&--warning {
				min-height: 6rem;
				border-color: var(--warn-border);
				font-size: 1rem;
				color: var(--warn-text);
				background: var(--warn-bg);
			}
		}

		&__icon {
			flex-shrink: 0;

			&--loading {
				animation: spin 1s linear infinite;
			}
		}

		&__text {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
		}

		&__title {
			font-weight: 500;
		}
	}
</style>

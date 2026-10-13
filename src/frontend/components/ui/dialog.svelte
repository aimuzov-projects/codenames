<script lang="ts">
	import type { Snippet } from 'svelte'

	type Props = {
		open: boolean
		/** Закрытие крестиком системы: Esc, тап по затемнению. */
		onclose: () => void
		title: string
		description?: Snippet
		/** Кнопки внизу; закрывать диалог -- их забота. */
		actions?: Snippet
		/** Закрывается ли по тапу мимо окна. */
		dismissible?: boolean
		/** Подтверждение действия: роль alertdialog, как у прежнего AlertDialog. */
		alert?: boolean
		/** Крупный заголовок по центру -- попапы-события доски (победа, передача хода). */
		centered?: boolean
		/** Содержимое над заголовком (иконка, причина события). */
		lead?: Snippet
		children?: Snippet
	}

	let {
		open,
		onclose,
		title,
		description,
		actions,
		dismissible = true,
		alert = false,
		centered = false,
		lead,
		children,
	}: Props = $props()

	const uid = $props.id()
	let dialog: HTMLDialogElement

	$effect(() => {
		if (open && !dialog.open) dialog.showModal()
		if (!open && dialog.open) dialog.close()
	})

	function backdrop(event: MouseEvent) {
		if (dismissible && event.target === dialog) onclose()
	}
</script>

<!-- Нативный <dialog>: фокус, Esc и затемнение даёт браузер. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialog}
	class="dialog"
	class:dialog--centered={centered}
	role={alert ? 'alertdialog' : undefined}
	aria-labelledby="{uid}-title"
	onclick={backdrop}
	oncancel={(event) => {
		event.preventDefault()
		if (dismissible) onclose()
	}}
>
	<div class="dialog__body">
		{@render lead?.()}
		<div class="dialog__heading">
			<h2 id="{uid}-title" class="dialog__title">{title}</h2>
			{#if description}
				<p class="dialog__description">{@render description()}</p>
			{/if}
		</div>
		{@render children?.()}
		{#if actions}
			<div class="dialog__actions">{@render actions()}</div>
		{/if}
	</div>
</dialog>

<style>
	.dialog {
		width: min(100% - 2rem, 24rem);
		max-width: none;
		padding: 0;
		border: 0;
		border-radius: var(--radius-xl);
		color: var(--popover-foreground);
		background: var(--popover);
		box-shadow: 0 0 0 1px color-mix(in oklch, var(--foreground) 10%, transparent);

		&::backdrop {
			background: var(--overlay);
			backdrop-filter: blur(2px);
		}

		&__body {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			padding: 1rem;
		}

		&__heading {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
		}

		&__title {
			font-size: 1rem;
			font-weight: 500;
			line-height: 1.3;
		}

		&--centered &__body {
			gap: 1rem;
			align-items: center;
			text-align: center;
		}

		&--centered &__heading {
			gap: 0.25rem;
		}

		&--centered &__title {
			font-size: 1.5rem;
		}

		&__description {
			font-size: 0.875rem;
			color: var(--muted-foreground);
		}

		&__actions {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 0.5rem;
			margin-top: 0.75rem;
		}
	}
</style>

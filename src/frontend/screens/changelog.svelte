<script lang="ts">
	import { onMount } from 'svelte'

	import Screen from '#frontend/components/screen.svelte'
	import TopBar from '#frontend/components/top-bar.svelte'
	import Badge from '#frontend/components/ui/badge.svelte'
	import { CHANGELOG } from '#frontend/data/changelog.ts'
	import { markChangelogSeen } from '#frontend/state/changelog.ts'
	import { goBack } from '#frontend/state/ui.ts'

	const formatDate = (iso: string): string =>
		new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

	// Открыли журнал -- гасим индикатор «новое».
	onMount(markChangelogSeen)
</script>

<Screen bottomFade onback={goBack}>
	{#snippet header()}<TopBar title="Что нового" onback={goBack} />{/snippet}
	<div class="changelog">
		{#each CHANGELOG as entry (entry.version)}
			<article class="changelog__entry">
				<header class="changelog__head">
					<div class="changelog__meta">
						<Badge>{entry.version}</Badge>
						<span class="changelog__date">{formatDate(entry.date)}</span>
					</div>
					<h2 class="changelog__title">{entry.title}</h2>
				</header>

				{#each entry.sections as section (section.title)}
					<section class="changelog__section">
						<h3 class="changelog__section-title">{section.title}</h3>
						<ul class="changelog__items">
							{#each section.items as item (item)}
								<li class="changelog__item">{item}</li>
							{/each}
						</ul>
					</section>
				{/each}
			</article>
		{/each}
	</div>
</Screen>

<style>
	.changelog {
		display: flex;
		flex-direction: column;
		gap: 2rem;

		&__entry {
			display: flex;
			flex-direction: column;
			gap: 1rem;
		}

		&__head {
			display: flex;
			flex-direction: column;
			gap: 0.25rem;
		}

		&__meta {
			display: flex;
			gap: 0.5rem;
			align-items: center;
		}

		&__date {
			font-size: 0.75rem;
			color: var(--muted-foreground);
		}

		&__title {
			font-size: 1.25rem;
			font-weight: 700;
			letter-spacing: -0.025em;
		}

		&__section {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
		}

		&__section-title {
			font-size: 0.875rem;
			font-weight: 600;
		}

		&__items {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
		}

		&__item {
			display: flex;
			gap: 0.5rem;
			font-size: 0.875rem;
			line-height: 1.625;
			color: var(--muted-foreground);

			&::before {
				content: '';
				flex-shrink: 0;
				width: 0.25rem;
				height: 0.25rem;
				margin-top: 0.5rem;
				border-radius: 9999px;
				background: color-mix(in oklch, var(--muted-foreground) 50%, transparent);
			}
		}
	}
</style>

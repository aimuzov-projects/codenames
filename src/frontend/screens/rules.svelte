<script lang="ts">
	import Screen from '#frontend/components/screen.svelte'
	import TopBar from '#frontend/components/top-bar.svelte'
	import { goBack } from '#frontend/state/ui.ts'
</script>

{#snippet rule(title: string, text: string)}
	<section class="rules__rule">
		<h2 class="rules__title">{title}</h2>
		<p class="rules__text">{text}</p>
	</section>
{/snippet}

<Screen bottomFade onback={goBack}>
	{#snippet header()}<TopBar title="Правила" onback={goBack} />{/snippet}
	<div class="rules">
		{@render rule(
			'Цель',
			'Две команды — красные и синие — наперегонки открывают свои слова по подсказкам капитана. Побеждает команда, первой открывшая всех своих.',
		)}
		{@render rule(
			'Роли',
			'У каждой команды есть капитан и игроки. Капитан видит цвета всех карт и даёт подсказки. Игроки видят только слова и открывают карты.',
		)}
		{@render rule(
			'Поле',
			'На столе 25 слов. У начинающей команды 9 своих карт, у второй — 8. Ещё 7 нейтральных и 1 «ассасин» — его открывать нельзя.',
		)}
		{@render rule(
			'Ход',
			'Капитан называет одно слово-подсказку и число — сколько карт с ней связано. Игроки открывают карты по очереди: своя карта — можно продолжать (всего до «число + 1» догадок); чужая или нейтральная — ход переходит сопернику.',
		)}
		{@render rule('Ассасин', 'Если открыть карту-ассасина, команда сразу проигрывает.')}
		{@render rule(
			'Победа',
			'Выигрывает команда, открывшая все свои слова первой — или та, чей соперник наткнулся на ассасина.',
		)}
	</div>
</Screen>

<style>
	.rules {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;

		&__rule {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
		}

		&__title {
			font-size: 1rem;
			font-weight: 600;
		}

		&__text {
			font-size: 0.875rem;
			line-height: 1.625;
			color: var(--muted-foreground);
		}
	}
</style>

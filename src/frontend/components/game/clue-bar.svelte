<script lang="ts">
	import Lightbulb from '@lucide/svelte/icons/lightbulb'

	import { openComposer } from '#frontend/components/game/clue-composer.svelte'
	import { modeAtom, myRoleAtom, myTeamAtom, viewAtom, viewRoleAtom } from '#frontend/state/session.ts'
	import { timerSecondsAtom } from '#frontend/state/settings.ts'

	type Props = {
		/** Доля оставшегося времени хода 0..1; null -- отсчёта сейчас нет. */
		timeFrac: number | null
	}

	let { timeFrac }: Props = $props()

	const TEAM_GEN = { red: 'красных', blue: 'синих' } as const

	const view = $derived($viewAtom)
	const team = $derived(view?.currentTeam ?? 'red')
	const over = $derived(view?.phase === 'over')
	// Все слова подсказки открыты -- осталась бонусная попытка (ровно одна).
	const isBonus = $derived((view?.guessesRemaining ?? 0) <= 1)
	// В бонусе показываем подсказку прошлого хода этой команды; на первом ходу её ещё нет --
	// тогда вместо пустоты ставим «…», чтобы блок слова не схлопывался.
	const clueWord = $derived(isBonus ? (view?.prevClueWord[team] ?? '…') : (view?.clue?.word ?? null))
	const isLocal = $derived($modeAtom === 'local')
	// Таймер включён в настройках -- резервируем место под полосу всегда (и до подсказки),
	// чтобы контент не прыгал при переходе clue → guess. Сама полоса рисуется по timeFrac.
	const timerOn = $derived($timerSecondsAtom > 0)
	const inClue = $derived(!over && view?.phase === 'clue')
	// Зритель может дать подсказку (капитан в фазе clue) -- сам ввод открывается из футера.
	const canCompose = $derived(
		inClue && (isLocal ? $viewRoleAtom === 'spymaster' : $myTeamAtom === team && $myRoleAtom === 'spymaster'),
	)
	// Приглашение «Ожидаем подсказки» показываем всю фазу clue в локали (и под гейтом передачи
	// телефона): инструкцию «передайте телефон» несёт сама модалка pass-phone, бар не дублирует её.
	const showInvite = $derived(canCompose || (inClue && isLocal))

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault()
			openComposer()
		}
	}
</script>

<!-- Статус-зона хода: активная подсказка либо ожидание капитана (сам ввод -- в clue-composer). -->
{#if view}
	<!-- svelte-ignore a11y_no_static_element_interactions, a11y_no_noninteractive_tabindex -->
	<div
		class="clue-bar clue-bar--{team}"
		class:clue-bar--timer={timerOn}
		class:clue-bar--over={over}
		class:clue-bar--action={canCompose}
		class:clue-bar--sheen={!view.clue && showInvite}
		role={canCompose ? 'button' : undefined}
		tabindex={canCompose ? 0 : undefined}
		onclick={canCompose ? openComposer : undefined}
		onkeydown={canCompose ? onkeydown : undefined}
	>
		{#if view.clue}
			<!-- Бонусная попытка выглядит как обычная подсказка -- меняются лишь подпись и число. -->
			<div class="clue-bar__text">
				<span class="clue-bar__caption">{isBonus ? 'Бонусное угадывание' : `Подсказка ${TEAM_GEN[team]}`}</span>
				{#if clueWord}<span class="clue-bar__word">{clueWord}</span>{/if}
			</div>
			<span class="clue-bar__chip clue-bar__chip--solid">{isBonus ? view.guessesRemaining : view.clue.count}</span
			>
		{:else if showInvite}
			<!-- Зеркалит вид подсказки: текст слева, чип-иконка справа (где число слов). -->
			<div class="clue-bar__text">
				<span class="clue-bar__caption">Ход капитана {TEAM_GEN[team]}</span>
				<span class="clue-bar__word">Ожидаем подсказки</span>
			</div>
			<span class="clue-bar__chip clue-bar__chip--tint"><Lightbulb size={20} /></span>
		{:else}
			<span class="clue-bar__waiting">Капитан {TEAM_GEN[team]} придумывает подсказку</span>
		{/if}

		<!--
			Таймер хода -- «утекающая» полоса по нижнему краю блока. Рисуем её всегда при включённом
			таймере: вне фазы guess timeFrac === null, и тогда пустой серый трек заполняет зарезервированное
			снизу место, чтобы контент не «висел» выше центра.
		-->
		{#if timerOn}
			<div
				class="clue-bar__timer"
				role="progressbar"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round((timeFrac ?? 0) * 100)}
			>
				<div class="clue-bar__timer-fill" style:width="{(timeFrac ?? 0) * 100}%"></div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.clue-bar {
		--team: var(--team-red);
		--team-fg: var(--team-red-foreground);
		--team-tint: var(--team-red-tint);
		--team-tint-fg: var(--team-red-tint-foreground);

		position: relative;
		overflow: hidden;
		display: flex;
		gap: 0.75rem;
		align-items: center;
		justify-content: space-between;
		height: 70px;
		padding-inline: 1rem;
		border: 1px solid var(--border);
		border-radius: var(--radius-xl);
		background: var(--card);

		&--blue {
			--team: var(--team-blue);
			--team-fg: var(--team-blue-foreground);
			--team-tint: var(--team-blue-tint);
			--team-tint-fg: var(--team-blue-tint-foreground);
		}

		/* Полоса таймера занимает нижние 6px -- резервируем их, чтобы контент остался по центру. */
		&--timer {
			padding-bottom: 6px;
		}

		&--over {
			opacity: 0.5;
		}

		/* Тап по бару-приглашению открывает композер -- как кнопка «Придумать подсказку». */
		&--action {
			cursor: pointer;
			user-select: none;

			&:active {
				opacity: 0.9;
			}
		}

		/* Блик-приглашение: тот же, что у главного CTA, но только пока зовём к ходу. */
		&--sheen::after {
			pointer-events: none;
			content: '';
			position: absolute;
			inset-block: 0;
			left: -45%;
			transform: skewX(-18deg);
			width: 32%;
			background: linear-gradient(
				100deg,
				transparent,
				color-mix(in oklch, currentcolor 22%, transparent),
				transparent
			);
			animation: clue-bar-sheen 3.5s ease-in-out infinite;

			@media (--reduced-motion) {
				display: none;
			}
		}

		&__text {
			display: flex;
			flex-direction: column;
			min-width: 0;
		}

		&__caption {
			font-size: 10px;
			font-weight: 700;
			color: var(--muted-foreground);
			text-transform: uppercase;
			letter-spacing: 0.025em;
		}

		&__word {
			overflow: hidden;
			font-size: 1.5rem;
			font-weight: 600;
			line-height: 1.33;
			text-overflow: ellipsis;
			text-transform: lowercase;
			letter-spacing: 0.025em;
			white-space: nowrap;
		}

		&__chip {
			display: flex;
			flex-shrink: 0;
			align-items: center;
			justify-content: center;
			width: 2.5rem;
			height: 2.5rem;
			border-radius: var(--radius-xl);

			&--solid {
				font-size: 1.25rem;
				font-weight: 700;
				color: var(--team-fg);
				background: var(--team);
			}

			/* Мягкая заливка для иконки-приглашения «придумать подсказку». */
			&--tint {
				color: var(--team-tint-fg);
				background: var(--team-tint);
			}
		}

		&__waiting {
			font-size: 0.875rem;
			font-weight: 500;
			color: var(--muted-foreground);
		}

		&__timer {
			position: absolute;
			inset-inline: 0;
			bottom: 0;
			height: 6px;
			background: color-mix(in oklch, var(--foreground) 10%, transparent);
		}

		&__timer-fill {
			height: 100%;
			background: var(--team);
			transition: width 250ms linear;
		}
	}

	@keyframes clue-bar-sheen {
		0% {
			left: -45%;
		}

		35%,
		100% {
			left: 125%;
		}
	}
</style>

// Тема до загрузки бандла: стартовый лоадер и первый кадр не вспыхивают
// белым в тёмной теме. Ту же логику повторяет applyTheme() в state/theme.ts.
//
// Файлом, а не инлайн-скриптом: Astro не хеширует is:inline скрипты для своей CSP,
// поэтому инлайн-тело блокируется, а файл с того же origin проходит по 'self'.
try {
	const t = localStorage.getItem('codenames.theme')
	const dark = t === 'dark' || ((t === 'system' || !t) && matchMedia('(prefers-color-scheme: dark)').matches)

	if (dark) document.documentElement.classList.add('dark')
} catch {}

import { siteChecks } from '@aimuzov-projects/infra-site-kit/playwright/checks'

// Общие проверки infra-site-kit по sitemap (в нём только главная): страница отвечает 200
// без ошибок в консоли и проходит axe в обеих схемах. Кнопки темы живут на экране настроек,
// а не на отдельной странице, поэтому их проверяет settings.spec.ts, а не кит.
siteChecks({
	// Игра -- полноэкранная PWA, прибитая к visual viewport (на это опирается обработка
	// клавиатуры в base.astro), и зум щипком разорвал бы поле и кнопки.
	// Поэтому viewport запрещает зум намеренно, а правило axe про meta-viewport выключено.
	a11y: { disableRules: ['meta-viewport'] },
})

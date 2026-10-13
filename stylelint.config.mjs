import stylelint from 'stylelint'
import { propertyGroups } from 'stylelint-config-clean-order'
import order from 'stylelint-order'

// BEM only: class names follow block__elem--mod and no tags inside blocks.
const name = '[a-z][a-z0-9]*(?:-[a-z0-9]+)*'
const mod = '[a-z0-9]+(?:-[a-z0-9]+)*'
const bem = new RegExp(`^${name}(?:__${name})?(?:--${mod})?$`)

// The built-in selector-class-pattern doesn't see the &__elem join: it skips a selector without a dot,
// and resolveNestedSelectors was removed in Stylelint 17. We join & with the parent, like postcss-nested.
const ruleName = 'local/bem-class'
const messages = stylelint.utils.ruleMessages(ruleName, {
	rejected: (cls) => `Класс ".${cls}" не по BEM: block__elem--mod`,
})

const resolve = (rule) => {
	let parent = rule.parent
	while (parent && parent.type !== 'rule' && parent.type !== 'root') parent = parent.parent
	if (!parent || parent.type === 'root') return rule.selectors
	return resolve(parent).flatMap((p) =>
		rule.selectors.map((s) => (s.includes('&') ? s.replaceAll('&', p) : `${p} ${s}`)),
	)
}

const bemClass = stylelint.createPlugin(ruleName, (on) => (root, result) => {
	if (!on) return
	root.walkRules((rule) => {
		if (rule.parent?.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return
		const seen = new Set()
		for (const selector of resolve(rule))
			for (const [, cls] of selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
				if (bem.test(cls) || seen.has(cls)) continue
				seen.add(cls)
				stylelint.utils.report({ result, ruleName, node: rule, message: messages.rejected(cls) })
			}
	})
})

export default {
	customSyntax: 'postcss-html',
	plugins: [bemClass, order],
	rules: {
		[ruleName]: true,
		// A block reads top to bottom: its own properties, its responsive rules, then the elements.
		'order/order': ['custom-properties', 'declarations', { type: 'at-rule', name: 'media' }, 'rules'],
		// clean-order groups (position, layout, sizing, text, appearance, animation), but without blank lines between them.
		'order/properties-order': [propertyGroups.map((properties) => ({ properties })), { unspecified: 'bottom' }],
		'selector-max-type': [
			0,
			{ ignoreTypes: ['html', 'body'], message: 'Тег внутри блока: дайте элементу класс block__elem' },
		],
	},
	overrides: [
		{ files: ['**/*.css'], customSyntax: null },
		// Base tag styles live here, they aren't block elements.
		{ files: ['src/frontend/styles/global.css'], rules: { 'selector-max-type': null } },
	],
}

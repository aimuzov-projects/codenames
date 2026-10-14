<script lang="ts">
	import Credit from '@aimuzov-projects/infra-site-kit/credit.svelte'
</script>

<!-- Подпись автора у нижней кромки экранов-меню: menu-layout растягивается и прижимает её к низу. -->
<footer class="footer">
	<Credit repo="https://github.com/aimuzov-projects/codenames" align="center" />
</footer>

<style>
	.footer {
		/* Ссылки подписи из infra-site-kit при наведении подсвечиваются цветом текста. */
		--credit-hover: var(--foreground);

		padding-bottom: 0.25rem;
		font-size: 0.75rem;
		color: var(--muted-foreground);
	}
</style>

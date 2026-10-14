<script lang="ts">
	import Credit from '@aimuzov-projects/infra-site-kit/credit.svelte'
</script>

<!-- Author credit at the bottom edge of menu screens: menu-layout stretches and pushes it down. -->
<footer class="footer">
	<Credit repo="https://github.com/aimuzov-projects/codenames" align="center" />
</footer>

<style>
	.footer {
		/* The credit links from infra-site-kit light up to the text color on hover. */
		--credit-hover: var(--foreground);

		padding-bottom: 0.25rem;
		font-size: 0.75rem;
		color: var(--muted-foreground);
	}
</style>

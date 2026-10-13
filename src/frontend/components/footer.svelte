<script lang="ts">
	import Heart from '@lucide/svelte/icons/heart'
</script>

<!-- Author credit at the bottom edge of menu screens: menu-layout stretches and pushes it down. -->
<footer class="footer">
	<a class="footer__link" href="https://t.me/aimuzov" target="_blank" rel="noreferrer">
		made with
		<span class="footer__heart" aria-hidden="true"><Heart size={14} /></span>
		by aimuzov
	</a>
</footer>

<style>
	.footer {
		padding-bottom: 0.25rem;
		text-align: center;

		&__link {
			display: inline-flex;
			gap: 0.25rem;
			align-items: center;
			font-size: 0.75rem;
			color: var(--muted-foreground);
			text-decoration: none;
			transition: color 150ms;

			&:hover {
				color: var(--foreground);
			}
		}

		&__heart {
			display: flex;
			color: oklch(0.637 0.237 25.331);

			& :global(.lucide-icon) {
				fill: currentcolor;
			}
		}
	}
</style>

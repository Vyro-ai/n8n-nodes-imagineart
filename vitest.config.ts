// Plain config object (no `vitest/config` import) so the verified-node linter's
// no-restricted-imports rule doesn't flag this file. `globals: true` exposes
// describe/it/expect to test files without importing from 'vitest'.
export default {
	test: {
		globals: true,
	},
};

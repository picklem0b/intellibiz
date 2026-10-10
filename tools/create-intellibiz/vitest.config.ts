import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['src/__tests__/**/*.test.ts'],
		// File-system tests write into a temp directory, so run them serially.
		fileParallelism: false
	}
});

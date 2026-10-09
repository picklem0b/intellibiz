import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	test: {
		include: ['src/__tests__/**/*.test.ts']
	},
	resolve: {
		alias: {
			'@intellibiz/core': path.resolve(import.meta.dirname, '../core/src/index.ts')
		}
	}
});

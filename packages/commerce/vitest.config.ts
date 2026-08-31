import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	test: {
		include: ['src/__tests__/**/*.test.ts']
	},
	resolve: {
		alias: {
			'@intellibiz/core': path.resolve(__dirname, '../core/src/index.ts'),
			'@intellibiz/finance': path.resolve(__dirname, '../finance/src/index.ts')
		}
	}
});

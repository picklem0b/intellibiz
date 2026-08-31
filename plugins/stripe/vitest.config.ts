import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@intellibiz/core': resolve(__dirname, '../../packages/core/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
});

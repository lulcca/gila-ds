import { configDefaults, defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    coverage: {
      exclude: [
        'src/**/index.ts',
        'src/**/__tests__/**',
        'src/**/*.stories.ts',
        'src/**/*.d.ts',
      ],
      include: ['src/**/*.{ts,vue}'],
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      thresholds: {
        branches: 75,
        functions: 75,
        lines: 75,
        statements: 75,
      },
    },
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'storybook-static/**'],
    globals: false,
  },
});

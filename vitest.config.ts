import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Server modules guard themselves with `server-only`; tests run them directly in Node.
      'server-only': path.resolve(__dirname, 'node_modules/server-only/empty.js')
    }
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    // Integration files share one Postgres test database.
    fileParallelism: false
  }
})

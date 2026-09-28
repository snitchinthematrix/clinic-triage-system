import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['node_modules', 'dist'],
    env: {
      GEMINI_API_KEY: 'test-gemini-key',
    },
  },
})

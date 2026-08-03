import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // A komponenstesztek `.test.tsx`-ek, és fájlon belüli
    // `@vitest-environment happy-dom` docblockkal kérnek DOM-ot.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['src/**/*.integration.test.ts'],
  },
});

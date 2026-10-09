import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Vitest läser inte tsconfig-paths, så samma två alias som Metro och tsc
 * använder sätts om här. `@vadkul/kontrakt` pekar på den inbakade kopian i
 * kontrakt/ (se scripts/sync-kontrakt.mjs) - inte på node_modules.
 */
export default defineConfig({
    resolve: {
        alias: {
            '@vadkul/kontrakt': fileURLToPath(new URL('./kontrakt/index.ts', import.meta.url)),
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
});

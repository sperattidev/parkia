import { defineConfig } from 'vitest/config';

// La inyección de dependencias de NestJS necesita la metadata de decoradores
// (`design:paramtypes`); el transformador oxc de Vite la emite con estas opciones.
const oxc = { decorator: { legacy: true, emitDecoratorMetadata: true } } as const;

export default defineConfig({
  oxc,
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/db/migrar.ts', 'src/db/sembrar.ts', 'src/db/crear-personal.ts'],
    },
    projects: [
      {
        oxc,
        test: { name: 'unit', include: ['test/unit/**/*.test.ts'] },
      },
      {
        oxc,
        test: {
          name: 'integracion',
          include: ['test/integracion/**/*.test.ts'],
          globalSetup: ['test/integracion/setup-global.ts'],
          setupFiles: ['test/integracion/entorno.ts'],
          testTimeout: 30_000,
          hookTimeout: 120_000,
          fileParallelism: false,
        },
      },
    ],
  },
});

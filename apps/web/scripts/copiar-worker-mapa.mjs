// Copia el web worker de MapLibre a public/vendor: en su build ESM, MapLibre lo
// carga desde una URL propia que el bundler no emite. Corre antes de dev y build.
import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const origen = join(
  dirname(require.resolve('maplibre-gl/package.json')),
  'dist',
  'maplibre-gl-worker.mjs',
);
const destino = new URL('../public/vendor/', import.meta.url);

await mkdir(destino, { recursive: true });
await copyFile(origen, new URL('maplibre-gl-worker.mjs', destino));

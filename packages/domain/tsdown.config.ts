import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  dts: true,
  sourcemap: true,
  clean: true,
  // index.js + index.d.ts, como declara package.json.
  fixedExtension: false,
});

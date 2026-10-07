import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/esquema.ts',
  out: './drizzle',
  casing: 'snake_case',
  extensionsFilters: ['postgis'],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://parkia:parkia@localhost:5433/parkia',
  },
  strict: true,
  verbose: true,
});

import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL!;
const urlObj = new URL(databaseUrl);
urlObj.searchParams.delete('ssl');
urlObj.searchParams.delete('sslmode');

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    },
  },
});

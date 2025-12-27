import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL!;
const urlObj = new URL(databaseUrl);

urlObj.searchParams.delete('ssl');
urlObj.searchParams.delete('sslmode');

const sanitizedLog = urlObj.toString().replace(/:([^:@]+)@/, ':****@');
console.log(`[Drizzle Config] Using sanitized URL: ${sanitizedLog}`);

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    host: urlObj.hostname,
    port: Number(urlObj.port),
    user: urlObj.username,
    password: urlObj.password,
    database: urlObj.pathname.slice(1),
    ssl: {
      rejectUnauthorized: false
    },
  },
});

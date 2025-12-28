import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DATABASE_URL!;
const urlObj = new URL(databaseUrl);

const isLocal = urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1';

if (!isLocal) {
  urlObj.searchParams.set('sslmode', 'no-verify');
}


const sanitizedLog = urlObj.toString().replace(/:([^:@]+)@/, ':****@');
console.log(`[Drizzle Config] Using sanitized URL: ${sanitizedLog}`);

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: urlObj.toString(),
  },
});

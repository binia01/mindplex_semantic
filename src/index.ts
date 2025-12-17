import { Hono } from 'hono'
import { createMiddleware } from "hono/factory";
import { drizzle } from 'drizzle-orm/node-postgres'

import articles from '$src/routes/articles'
import search from '$src/routes/search'
import usersRoute from '$src/routes/users'
import * as schema from '$src/db/schema'
import ingest from '$src/routes/ingest'

import { AppContext } from '$src/types'

const app = new Hono<AppContext>()

const db = drizzle(process.env.DATABASE_URL!, { schema })
const dbMiddleware = createMiddleware(async (c, next) => {
  c.set('db', db);
  c.set('schema', schema)
  await next();
});

app.use(dbMiddleware)

app.route('/ingest', ingest)
app.route('/articles', articles)
app.route('/search', search)
app.route('/users', usersRoute)

app.get('/', (c) => {
  return c.text('Hello Preview search!')
})

app.get('/health', async (c) => {
  const db = c.get('db');
  const result = await db.execute('select 1');

  if (result && result.rows[0]['?column?'] === 1) {
    return c.json({ status: "ok" })
  } else {
    c.status(500)
    return c.json({ status: "error" })
  }
})

app.get('/extensions', async (c) => {
  const db = c.get('db')
  // SELECT * FROM pg_extension;
  const result = await db.execute('SELECT * FROM pg_extension;');
  return c.json({ extensions: result.rows });
});

app.get('/setup', async (c) => {
  // install pgvector extension
  const db = c.get('db');

  // {"extensions":[{"oid":13564,"extname":"plpgsql","extowner":10,"extnamespace":11,"extrelocatable":false,"extversion":"1.0","extconfig":null,"extcondition":null},{"oid":24841,"extname":"vector","extowner":10,"extnamespace":2200,"extrelocatable":true,"extversion":"0.8.1","extconfig":null,"extcondition":null},{"oid":25169,"extname":"pg_trgm","extowner":10,"extnamespace":2200,"extrelocatable":true,"extversion":"1.6","extconfig":null,"extcondition":null},{"oid":25381,"extname":"fuzzystrmatch","extowner":10,"extnamespace":2200,"extrelocatable":true,"extversion":"1.2","extconfig":null,"extcondition":null}]}
  try {
    await db.execute('CREATE EXTENSION IF NOT EXISTS vector;');
    await db.execute('CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;');
    await db.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm;');

    return c.json({ message: 'Database extensions installed successfully' });
  } catch (error) {
    return c.json({ error: 'Failed to install database extensions' }, 500);
  }
})
export default app

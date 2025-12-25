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
  return c.json({ message: 'This service is not meant to be accessed directly. Use the API endpoints instead.' })
})

app.get('/health', async (c) => {
  try {
    const db = c.get('db');
    const result = await db.execute('select 1');

    if (result && result.rows[0]['?column?'] === 1) {
      return c.json({ status: "ok" })
    } else {
      c.status(500)
      return c.json({ status: "error" })
    }

  } catch (error) {
    console.error(error)
    return c.json({ error: 'Failed to check database health' }, 500);
  }
})

app.get('/get-extensions', async (c) => {
  try {
    const db = c.get('db')
    const result = await db.execute('SELECT * FROM pg_extension;');
    return c.json({ extensions: result.rows });
  } catch (error) {
    console.log(error)
    return c.json({ error: 'Failed to get database extensions' }, 500);
  }
});

app.get('/bootstrap-extensions', async (c) => {

  try {
    const db = c.get('db');
    await db.execute('CREATE EXTENSION IF NOT EXISTS vector;');
    await db.execute('CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;');
    await db.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm;');

    return c.json({ message: 'Database extensions installed successfully' });
  } catch (error) {
    console.log(error)
    return c.json({ error: 'Failed to install database extensions' }, 500);
  }
})
export default app

import { Hono } from 'hono'
import { createMiddleware } from "hono/factory";
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from "pg";
import { Scalar } from '@scalar/hono-api-reference'


import articles from '$src/routes/articles'
import search from '$src/routes/search'
import usersRoute from '$src/routes/users'
import * as schema from '$src/db/schema'
import ingest from '$src/routes/ingest'

import { openApiDoc } from './openapi'
import { AppContext } from '$src/types'
import { AppError } from '$src/lib/errors'

const app = new Hono<AppContext>()
const urlObj = new URL(process.env.DATABASE_URL || '');
const isLocal = urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1';


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : {
    rejectUnauthorized: false
  }
});

const db = drizzle({ schema, client: pool })

const dbMiddleware = createMiddleware(async (c, next) => {
  c.set('db', db);
  c.set('schema', schema)
  await next();
});

app.use(dbMiddleware)

app.get('/doc', (c) => c.json(openApiDoc))
app.get('/ui', Scalar({ url: '/doc' }))

app.route('/v1/ingest', ingest)
app.route('/v1/articles', articles)
app.route('/v1/search', search)
app.route('/v1/users', usersRoute)

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
    const msg = JSON.stringify(error)
    return c.json({ error: 'Failed to check database health ' + msg }, 500);
  }
})

app.onError((err, c) => {
  if (err instanceof AppError) {
    return c.json({
      success: false,
      error: err.message,
      details: err.details
    }, err.statusCode as any);
  }

  console.error("Unhandled Exception:", err);
  return c.json({
    success: false,
    error: 'Internal Server Error'
  }, 500);
});

export default app

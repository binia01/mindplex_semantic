import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import { ALLOWED_USER_UPDATE_FIELDS, ExternalIdParamsSchema, FORBIDDEN_USER_COLUMNS, GetUserQuerySchema, SearchQuerySchema, UpdateUserSchema } from './schema'
import { AppContext } from '$src/types'
import { vValidator } from '@hono/valibot-validator';
import { buildFieldSelection, sanitizeUpdates } from '$src/utils';

const users = new Hono<AppContext>()

export const getSearchScoreSql = (query: string) => sql`
  (
    word_similarity(${query}, users.search_name)
    + (CASE WHEN users.first_name ILIKE ${query} THEN 2.0 ELSE 0 END) -- Tier 1: Exact Name (+2.0)
    + (CASE WHEN users.first_name ILIKE ${query} || '%' THEN 1.2 ELSE 0 END) -- Tier 2: Name Start (+1.2)
    + (CASE WHEN users.username ILIKE ${query} || '%' THEN 0.8 ELSE 0 END) -- Tier 3: Username Start (+0.8)
    + (CASE WHEN users.email ILIKE ${query} || '%' THEN 0.5 ELSE 0 END) -- Tier 4: Email Start (+0.5)
    - (LENGTH(users.first_name) - LENGTH(${query})) * 0.01 -- Tie-breaker: Length penalty (-0.01 per char diff)
  )
`;

users.get('/search', vValidator('query', SearchQuerySchema), async (c) => {
    const { limit, offset, q: searchQuery } = c.req.valid('query');

    const db = c.get('db')
    const { users } = c.get('schema')
    const { fields } = c.req.valid('query')

    if (!searchQuery) {
        return c.json({ users: [] })
    }

    const selection = buildFieldSelection(
        users,
        fields,
        FORBIDDEN_USER_COLUMNS,
        {
            id: users.id,
            score: getSearchScoreSql(searchQuery).as('relevance_score')
        }
    )

    const threshold = searchQuery.length < 5 ? 0.39 : 0.3;

    const result = await db.select(selection)
        .from(users)
        .where(sql`
        (${users.firstName} ILIKE ${searchQuery} || '%') 
        OR (${users.username} ILIKE ${searchQuery} || '%') 
        OR (${users.email} ILIKE ${searchQuery} || '%')
        OR (word_similarity(${searchQuery}, ${users.searchName}) > ${threshold})
    `)
        .orderBy(sql`relevance_score DESC`)
        .limit(limit)
        .offset(offset);

    return c.json({
        users: result,
        meta: {
            query: searchQuery,
            count: result.length,
            limit,
            offset
        }
    })
})

users.get('/:id', vValidator('param', ExternalIdParamsSchema), vValidator('query', GetUserQuerySchema), async (c) => {
    const { id: externalId } = c.req.valid('param')

    const db = c.get('db')
    const { users } = c.get('schema')

    const { fields } = c.req.valid('query')

    const selection = buildFieldSelection(
        users,
        fields,
        FORBIDDEN_USER_COLUMNS,
        { id: users.id }
    )

    const [result] = await db.select(selection)
        .from(users)
        .where(eq(users.externalId, externalId))

    if (!result) {
        return c.json({ error: 'User not found' }, 404)
    }

    return c.json(result)
})

users.patch('/:id', vValidator('param', ExternalIdParamsSchema), vValidator('json', UpdateUserSchema), async (c) => {
    const { id: externalId } = c.req.valid('param')
    const updates = c.req.valid('json')

    const db = c.get('db')
    const { users } = c.get('schema')

    const [existing] = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.externalId, externalId))

    if (!existing) {
        return c.json({ error: 'User not found' }, 404)
    }

    const sanitizedUpdates = sanitizeUpdates(updates, ALLOWED_USER_UPDATE_FIELDS)

    if (Object.keys(sanitizedUpdates).length === 0) {
        return c.json({ error: 'No valid fields to update' }, 400)
    }

    const [updated] = await db.update(users)
        .set(sanitizedUpdates)
        .where(eq(users.externalId, externalId))
        .returning()

    return c.json({ message: 'User updated successfully', user: updated })
})

users.delete('/:id', vValidator('param', ExternalIdParamsSchema), async (c) => {
    const { id: externalId } = c.req.valid('param')
    const db = c.get('db')
    const { users } = c.get('schema')

    const [existing] = await db.select({ id: users.id })
        .from(users)
        .where(eq(users.externalId, externalId))

    if (!existing) {
        return c.json({ error: 'User not found' }, 404)
    }

    await db.delete(users)
        .where(eq(users.externalId, externalId))

    return c.json({ message: 'User deleted successfully', externalId })
})

export default users
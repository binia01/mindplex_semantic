import { Hono } from 'hono'
import { sql, eq } from 'drizzle-orm'

import { AppContext } from '$src/types'

const users = new Hono<AppContext>()

users.get('/', async (c) => {
    const limit = Number(c.req.query('limit')) || 10
    const offset = Number(c.req.query('offset')) || 0
    const searchQuery = c.req.query('q') || ''

    const db = c.get('db')
    const schema = c.get('schema')

    if (!searchQuery) {
        return c.json({ users: [] })
    }

    const candidatesSq = db.$with('candidates_sq').as(
        db.select({
            id: schema.users.id,
            indexScore: sql<number>`word_similarity(${searchQuery}, ${schema.users.searchName})`.as('index_score')
        })
            .from(schema.users)
            .where(sql`word_similarity(${searchQuery}, ${schema.users.searchName}) > 0.1`)
            .orderBy(sql`index_score DESC`)
            .limit(100)
    )

    const similarUsers = await db.with(candidatesSq).select({
        id: schema.users.externalId,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        username: schema.users.username,
        email: schema.users.email,
        score: sql<number>`
            CASE 
                WHEN LOWER(${schema.users.firstName}) LIKE LOWER(${searchQuery}) || '%' THEN 1.0
                WHEN LOWER(${schema.users.lastName}) LIKE LOWER(${searchQuery}) || '%' THEN 1.0
                WHEN LOWER(${schema.users.username}) LIKE LOWER(${searchQuery}) || '%' THEN 1.0
                ELSE 
                    (candidates_sq.index_score * 0.6) +
                    ((1.0 - LEAST(
                        levenshtein(LOWER(${schema.users.firstName}), LOWER(${searchQuery})),
                        levenshtein(LOWER(${schema.users.lastName}), LOWER(${searchQuery})),
                        levenshtein(LOWER(${schema.users.username}), LOWER(${searchQuery}))
                    )::float / GREATEST(1, 
                        LENGTH(${searchQuery}), 
                        LENGTH(${schema.users.firstName}),
                        LENGTH(${schema.users.lastName}),
                        LENGTH(${schema.users.username})
                    )) * 0.4)
            END
        `.as('final_score')
    })
        .from(candidatesSq)
        .innerJoin(schema.users, eq(schema.users.id, candidatesSq.id))
        .orderBy(sql`final_score DESC`)
        .limit(limit)
        .offset(offset)

    return c.json({ users: similarUsers, query: searchQuery })
})

export default users
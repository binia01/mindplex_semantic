import { Hono } from 'hono'
import { sql, eq, gt, desc } from 'drizzle-orm'
import { ALLOWED_UPDATE_FIELDS, ExternalIdParamsSchema, GetArticleQuerySchema, SearchQuerySchema, UpdateArticleSchema } from './schema'

import type { AppContext } from '$src/types'
import { vValidator } from '@hono/valibot-validator'
import { buildFieldSelection, sanitizeUpdates } from '$src/utils'
import { FORBIDDEN_COLUMNS } from './schema'
import { Embedding } from '$src/lib/Embedding'
import { unionAll } from 'drizzle-orm/pg-core'

const articles = new Hono<AppContext>()

export const getHybridScoreSql = (
    embeddingColumn: any,
    searchVectorColumn: any,
    queryEmbedding: number[],
    textQuery: string
) => {
    const vectorScore = sql`1 - (${embeddingColumn} <=> ${JSON.stringify(queryEmbedding)})`
    const textScore = sql`ts_rank_cd(${searchVectorColumn}, websearch_to_tsquery('english', ${textQuery}))`
    const normalizedTextScore = sql`LEAST(${textScore}, 1.0)`
    return sql`(${vectorScore} * 0.7) + (${normalizedTextScore} * 0.3)`
}


articles.get('/search', vValidator('query', SearchQuerySchema), async (c) => {
    const db = c.get('db')
    const { articles, articleChunks } = c.get('schema')
    const query = c.req.valid('query')
    const { q: searchQuery, limit, offset, fields } = query

    if (!searchQuery) return c.json({ articles: [] })

    const embeddingService = new Embedding()
    const queryEmbedding = await embeddingService.getEmbeddings(searchQuery)

    const articleScore = getHybridScoreSql(
        articles.embedding,
        articles.searchVector,
        queryEmbedding,
        searchQuery
    )

    const chunkScore = getHybridScoreSql(
        articleChunks.embedding,
        articleChunks.searchVector,
        queryEmbedding,
        searchQuery
    )

    const articleMatches = db.select({
        articleId: articles.id,
        score: articleScore.as('score')
    })
        .from(articles)
        .where(gt(articleScore, 0.25))

    const chunkMatches = db.select({
        articleId: articleChunks.articleId,
        score: chunkScore.as('score')
    })
        .from(articleChunks)
        .where(gt(chunkScore, 0.25))

    const allMatches = unionAll(articleMatches, chunkMatches).as('all_matches')

    const distinctMatches = db.select({
        id: allMatches.articleId,
        finalScore: sql`MAX(${allMatches.score})`.as('final_score')
    })
        .from(allMatches)
        .groupBy(allMatches.articleId)
        .orderBy(desc(sql`final_score`))
        .limit(limit)
        .offset(offset)
        .as('distinct_matches')

    const selection = buildFieldSelection(
        articles,
        fields,
        FORBIDDEN_COLUMNS,
        { id: articles.id, score: distinctMatches.finalScore }
    )

    const results = await db.select(selection)
        .from(distinctMatches)
        .innerJoin(articles, eq(articles.id, distinctMatches.id))
        .orderBy(desc(distinctMatches.finalScore))

    return c.json({
        articles: results,
        meta: {
            query: searchQuery,
            count: results.length,
            limit,
            offset
        }
    })
})


articles.get('/:id', vValidator('param', ExternalIdParamsSchema), vValidator('query', GetArticleQuerySchema), async (c) => {
    const { id: externalId } = c.req.valid('param')

    const db = c.get('db')
    const { articles, articleAuthors, users } = c.get('schema')

    const fields = c.req.valid('query').fields

    const selection = buildFieldSelection(
        articles,
        fields,
        FORBIDDEN_COLUMNS,
        { id: articles.id }
    )

    const [result] = await db.select(selection)
        .from(articles)
        .leftJoin(articleAuthors, eq(articles.id, articleAuthors.articleId))
        .leftJoin(users, eq(articleAuthors.userId, users.id))
        .where(eq(articles.externalId, externalId))

    if (!result) {
        return c.json({ error: 'Article not found' }, 404)
    }

    return c.json(result)
})

articles.patch('/:id', vValidator('param', ExternalIdParamsSchema), vValidator('json', UpdateArticleSchema), async (c) => {
    const { id: externalId } = c.req.valid('param')
    const updates = c.req.valid('json')

    const db = c.get('db')
    const { articles } = c.get('schema')

    const [existing] = await db.select({ id: articles.id })
        .from(articles)
        .where(eq(articles.externalId, externalId))

    if (!existing) {
        return c.json({ error: 'Article not found' }, 404)
    }
    const sanitizedUpdates = sanitizeUpdates(updates, ALLOWED_UPDATE_FIELDS);

    if (Object.keys(sanitizedUpdates).length === 0) {
        return c.json({ error: 'No valid fields to update' }, 400);
    }

    const [updated] = await db.update(articles)
        .set(sanitizedUpdates)
        .where(eq(articles.externalId, externalId))
        .returning()

    return c.json({ message: 'Article updated successfully', article: updated })
})

articles.delete('/:id', vValidator('param', ExternalIdParamsSchema), async (c) => {
    const { id: externalId } = c.req.valid('param')
    const db = c.get('db')
    const { articles } = c.get('schema')


    const [existing] = await db.select({ id: articles.id })
        .from(articles)
        .where(eq(articles.externalId, externalId))

    if (!existing) {
        return c.json({ error: 'Article not found' }, 404)
    }

    await db.delete(articles)
        .where(eq(articles.externalId, externalId))

    return c.json({ message: 'Article deleted successfully', externalId })
})


export default articles
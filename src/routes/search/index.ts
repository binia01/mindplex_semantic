import { Hono } from 'hono'
import { AppContext } from '$src/types'
import { vValidator } from '@hono/valibot-validator'
import { FORBIDDEN_COLUMNS, SearchQuerySchema } from './schema'
import { sql, eq, gt, desc, getTableColumns } from 'drizzle-orm'
import { Embedding } from '$src/lib/Embedding'
import { unionAll } from 'drizzle-orm/pg-core'
import { buildFieldSelection } from '$src/utils'

const search = new Hono<AppContext>()

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

search.get('/', vValidator('query', SearchQuerySchema), async (c) => {
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

    const results = await db.select({
        id: articles.id,
        selection
    })
        .from(distinctMatches)
        .innerJoin(articles, eq(articles.id, distinctMatches.id))
        .orderBy(desc(distinctMatches.finalScore))

    return c.json({
        articles: results,
        meta: { query: searchQuery, count: results.length }
    })
})

export default search
import { Hono } from 'hono'
import type { Context } from 'hono'
import { Embedding } from '$src/lib/Embedding'
import type { AppContext } from '$src/types'
import type { AvailableTone } from '$src/db/schema'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { vValidator } from '@hono/valibot-validator'
import {
    FORBIDDEN_COLUMNS,
    SummaryCollectionQuerySchema,
    SummaryArticleParamsSchema,
    SummaryFieldsQuerySchema,
    SummaryToneParamsSchema,
    UpsertSummarySchema,
} from './schema'
import { buildFieldSelection } from '$src/utils'

const summaries = new Hono<AppContext>()
export const summaryCollection = new Hono<AppContext>()

type SummaryRecord = {
    articleExternalId: number
    tone: AvailableTone
    summary?: string
    createdAt?: Date | null
    updatedAt?: Date | null
}

class SummaryEmbeddingError extends Error {}

const buildSummarySelection = (
    fields: string | undefined,
    summaryTable: AppContext['Variables']['schema']['summaries'],
    articleTable: AppContext['Variables']['schema']['articles']
) => buildFieldSelection(
    summaryTable,
    fields,
    FORBIDDEN_COLUMNS,
    {
        articleExternalId: articleTable.externalId,
        tone: summaryTable.tone
    }
)

async function findArticleByExternalId(c: Context<AppContext>, externalId: number) {
    const db = c.get('db')
    const schema = c.get('schema')

    return db.query.articles.findFirst({
        where: eq(schema.articles.externalId, externalId),
        columns: {
            id: true,
            externalId: true
        }
    })
}

async function buildSummaryEmbedding(tone: AvailableTone, summary: string) {
    if (tone !== 'formal') {
        return null
    }

    try {
        const embeddingService = new Embedding()
        return await embeddingService.getEmbeddings(summary)
    } catch (error) {
        console.error('Summary embedding failed:', error)
        throw new SummaryEmbeddingError('Embedding service failed')
    }
}

async function upsertSummary(
    c: Context<AppContext>,
    article: { id: number, externalId: number },
    tone: AvailableTone,
    summaryText: string
) {
    const db = c.get('db')
    const schema = c.get('schema')

    const existing = await db.query.summaries.findFirst({
        where: and(
            eq(schema.summaries.articleId, article.id),
            eq(schema.summaries.tone, tone)
        ),
        columns: {
            id: true
        }
    })

    const embedding = await buildSummaryEmbedding(tone, summaryText)

    const [saved] = await db.insert(schema.summaries)
        .values({
            articleId: article.id,
            tone,
            summary: summaryText,
            embedding
        })
        .onConflictDoUpdate({
            target: [schema.summaries.articleId, schema.summaries.tone],
            set: {
                summary: summaryText,
                embedding,
                updatedAt: new Date()
            }
        })
        .returning({
            tone: schema.summaries.tone,
            summary: schema.summaries.summary,
            createdAt: schema.summaries.createdAt,
            updatedAt: schema.summaries.updatedAt
        })

    return {
        created: !existing,
        summary: {
            articleExternalId: article.externalId,
            ...saved
        } satisfies SummaryRecord
    }
}

summaryCollection.get('/', vValidator('query', SummaryCollectionQuerySchema), async (c) => {
    const query = c.req.valid('query')
    const limit = Number(query.limit)
    const page = Number(query.page)
    const offset = (page - 1) * limit
    const db = c.get('db')
    const { summaries: summaryTable, articles: articleTable } = c.get('schema')
    const selection = buildSummarySelection(query.fields, summaryTable, articleTable)
    const toneFilter = query.tone ? eq(summaryTable.tone, query.tone) : undefined

    const rows = await db
        .select(selection)
        .from(summaryTable)
        .innerJoin(articleTable, eq(summaryTable.articleId, articleTable.id))
        .where(toneFilter)
        .orderBy(desc(summaryTable.updatedAt), desc(articleTable.externalId), asc(summaryTable.tone))
        .limit(limit)
        .offset(offset)

    const [{ total }] = await db
        .select({
            total: sql<number>`count(*)::int`
        })
        .from(summaryTable)
        .innerJoin(articleTable, eq(summaryTable.articleId, articleTable.id))
        .where(toneFilter)

    return c.json({
        summaries: rows,
        meta: {
            page,
            limit,
            count: rows.length,
            total
        }
    })
})

summaries.get('/', vValidator('param', SummaryArticleParamsSchema), vValidator('query', SummaryFieldsQuerySchema), async (c) => {
    const { id: externalId } = c.req.valid('param')
    const { fields } = c.req.valid('query')
    const article = await findArticleByExternalId(c, externalId)

    if (!article) {
        return c.json({ error: 'Article not found' }, 404)
    }

    const db = c.get('db')
    const { summaries: summaryTable, articles: articleTable } = c.get('schema')
    const selection = buildSummarySelection(fields, summaryTable, articleTable)

    const rows = await db
        .select(selection)
        .from(summaryTable)
        .innerJoin(articleTable, eq(summaryTable.articleId, articleTable.id))
        .where(eq(summaryTable.articleId, article.id))
        .orderBy(asc(summaryTable.tone))

    return c.json({ summaries: rows })
})

summaries.get('/:tone', vValidator('param', SummaryToneParamsSchema), vValidator('query', SummaryFieldsQuerySchema), async (c) => {
    const { id: externalId, tone } = c.req.valid('param')
    const { fields } = c.req.valid('query')
    const article = await findArticleByExternalId(c, externalId)

    if (!article) {
        return c.json({ error: 'Article not found' }, 404)
    }

    const db = c.get('db')
    const { summaries: summaryTable, articles: articleTable } = c.get('schema')
    const selection = buildSummarySelection(fields, summaryTable, articleTable)

    const [summary] = await db
        .select(selection)
        .from(summaryTable)
        .innerJoin(articleTable, eq(summaryTable.articleId, articleTable.id))
        .where(and(
            eq(summaryTable.articleId, article.id),
            eq(summaryTable.tone, tone)
        ))
        .limit(1)

    if (!summary) {
        return c.json({ error: 'Summary not found' }, 404)
    }

    return c.json(summary)
})

summaries.put('/:tone', vValidator('param', SummaryToneParamsSchema), vValidator('json', UpsertSummarySchema), async (c) => {
    const { id: externalId, tone } = c.req.valid('param')
    const { summary } = c.req.valid('json')
    const article = await findArticleByExternalId(c, externalId)

    if (!article) {
        return c.json({ error: 'Article not found' }, 404)
    }

    try {
        const result = await upsertSummary(c, article, tone, summary)

        return c.json({
            message: result.created ? 'Summary created successfully' : 'Summary updated successfully',
            summary: result.summary
        }, result.created ? 201 : 200)
    } catch (error) {
        if (error instanceof SummaryEmbeddingError) {
            return c.json({ error: 'Embedding service failed' }, 502)
        }

        console.error('Summary upsert failed:', error)
        return c.json({ error: 'Internal error' }, 500)
    }
})

export default summaries

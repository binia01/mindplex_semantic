import { Hono } from 'hono'
import { Chunk } from '$src/lib/Chunk'
import { Embedding } from '$src/lib/Embedding'
import { AppContext } from '$src/types'
import { toNames } from '$src/utils'
import { eq } from 'drizzle-orm'
import { vValidator } from '@hono/valibot-validator';
import { IngestArticleSchema, IngestUserSchema } from './schema';

const ingest = new Hono<AppContext>()

ingest.post('/articles', vValidator('json', IngestArticleSchema), async (c) => {
    const body = c.req.valid('json');
    const db = c.get('db');
    const schema = c.get('schema')

    const pageContents = body.post

    try {
        const tags = toNames(pageContents.tag)
        const category = toNames(pageContents.category)
        const titleAndTeaser = `${pageContents.post_title} ${pageContents.brief_overview}`

        const existing = await db
            .select({ id: schema.articles.id })
            .from(schema.articles)
            .where(eq(schema.articles.externalId, pageContents.id))
            .limit(1)

        if (existing.length > 0) {
            return c.json({ success: false, error: 'Article already exists' }, 409)
        }

        const embedding = new Embedding()
        const chunk = new Chunk()

        const chunks = chunk.processChunk(pageContents)

        const [titleEmbedding, chunkEmbeddings] = await Promise.all([
            embedding.getEmbeddings(titleAndTeaser),
            embedding.getBatchEmbeddings(chunks)
        ])


        await db.transaction(async (tx) => {
            const article = await tx.insert(schema.articles).values({
                title: pageContents.post_title,
                slug: pageContents.post_name,
                tags: tags.split(','),
                category: category.split(','),
                teaser: pageContents.brief_overview,
                content: pageContents.post_content,
                publishedAt: new Date(pageContents.post_date),
                externalId: pageContents.id,
                embedding: titleEmbedding,
            }).returning()

            const articleId = article[0].id


            await tx.insert(schema.articleChunks).values(
                chunks.map(c => ({
                    articleId,
                    chunkIndex: c.index,
                    rawContent: c.content,
                    chunkToEmbed: `Title: ${c.title}\nAuthor: ${c.author}\nCategory: ${c.category}\nDate: ${c.date}\n\n${c.content}`,
                    embedding: chunkEmbeddings.get(c.index)
                }))
            )
        })
        return c.json({ success: true, chunksCreated: chunks.length })

    } catch (error: any) {
        console.error('Ingest failed:', error)

        if (error.name === 'BedrockError' || error.message?.includes('Bedrock')) {
            return c.json({ success: false, error: 'Embedding service failed' }, 502)
        }
        return c.json({ success: false, error: 'Internal error' }, 500)
    }
})


ingest.post('/users', vValidator('json', IngestUserSchema), async (c) => {
    const userData = c.req.valid('json');
    const db = c.get('db');
    const schema = c.get('schema')

    try {
        const existing = await db
            .select({ id: schema.users.id })
            .from(schema.users)
            .where(eq(schema.users.externalId, userData.id))
            .limit(1)

        if (existing.length > 0) {
            return c.json({ success: false, error: 'User already exists' }, 409)
        }

        await db.insert(schema.users).values({
            externalId: userData.id,
            firstName: userData.firstName,
            lastName: userData.lastName,
            username: userData.username,
            email: userData.email
        })
        return c.json({ success: true, message: 'User created successfully' })
    } catch (error) {
        console.error('User ingest failed:', error)
        return c.json({ success: false, error: 'Internal error' }, 500)
    }
})
export default ingest 
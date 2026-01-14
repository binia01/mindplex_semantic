import { pgTable, serial, text, integer, timestamp, index, unique } from 'drizzle-orm/pg-core'
import { vector, customType } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

const tsvector = customType<{ data: string }>({
    dataType: () => 'tsvector',
});

export const articles = pgTable('articles', {
    id: serial('id').primaryKey(),
    externalId: integer('external_id').unique().notNull(),
    slug: text('slug').notNull(),
    teaser: text('teaser'),
    title: text('title').notNull(),
    category: text('category').array(),
    tags: text('tags').array(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),

    embedding: vector('embedding', { dimensions: 1024 }),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
        sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || 
            setweight(to_tsvector('english', coalesce(teaser, '')), 'B')`
    ),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
    index('articles_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
    index('articles_search_idx').using('gin', table.searchVector)
])

export const articleAuthors = pgTable('article_authors', {
    id: serial('id').primaryKey(),
    articleId: integer('article_id').references(() => articles.id, { onDelete: 'cascade' }).notNull(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull()
}, (table) => [
    unique('article_authors_unique_idx').on(table.articleId, table.userId)
])

export const articleChunks = pgTable('article_chunks', {
    id: serial('id').primaryKey(),
    articleId: integer('article_id').references(() => articles.id, { onDelete: 'cascade' }).notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    rawContent: text('raw_content').notNull(),
    chunkToEmbed: text('chunk_to_embed').notNull(),

    embedding: vector('embedding', { dimensions: 1024 }),

    searchVector: tsvector('search_vector').generatedAlwaysAs(
        sql`to_tsvector('english', chunk_to_embed)`
    ),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
    index('article_chunks_article_id_idx').on(table.articleId),
    index('article_chunks_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
    index('chunks_search_idx').using('gin', table.searchVector)
])

export const users = pgTable('users', {
    id: serial('id').primaryKey(),
    externalId: integer('external_id').unique().notNull(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    username: text('username').notNull(),
    searchName: text('search_name').generatedAlwaysAs(
        sql`lower(first_name || ' ' || last_name || ' ' || username || ' ' || COALESCE(email, ''))`
    ),
    email: text('email'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
}, (table) => [
    index('users_search_name_trgm_idx').using('gin', sql`${table.searchName} gin_trgm_ops`)
])
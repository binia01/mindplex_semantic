import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from "pg";
import * as schema from '$src/db/schema'
import { Chunk } from '$src/lib/Chunk'
import { Embedding } from '$src/lib/Embedding'
import { eq } from 'drizzle-orm'
import { toNames } from '$src/utils'
import * as v from 'valibot';

interface StagingArticle {
    post: {
        id: number | string;
        post_title: string;
        post_name: string;
        post_content: string;
        brief_overview: string;
        author_name: string;
        post_date: string;
        tag?: { name: string } | { name: string }[] | [];
        category?: { name: string } | { name: string }[] | [];
        other_authors?: any[];
        co_authors?: any[];
        post_editors?: any[];
    };
}

// Support both old format and new staging API format
interface StagingApiArticle {
    id: number | string;
    post_title?: string;
    title?: string;
    slug?: string;
    post_name?: string;
    overview?: string;
    brief_overview?: string;
    content?: string | object[];
    post_content?: string;
    published_at?: string;
    publish_timestamp?: string;
    post_date?: string;
    author_display_name?: string;
    author_name?: string;
    author_username?: string;
    categories?: any[];
    category?: any[];
    tags?: any[];
    tag?: any[];
    [key: string]: any;
}

const IngestArticleSchema = v.object({
    id: v.union([
        v.number(),
        v.pipe(v.string(), v.transform(Number))
    ]),
    post_title: v.optional(v.string()),
    title: v.optional(v.string()),
    slug: v.optional(v.string()),
    post_name: v.optional(v.string()),
    overview: v.optional(v.string()),
    brief_overview: v.optional(v.string()),
    content: v.optional(v.union([
        v.string(),
        v.array(v.any())
    ])),
    post_content: v.optional(v.string()),
    published_at: v.optional(v.string()),
    publish_timestamp: v.optional(v.union([v.string(), v.number()])),
    post_date: v.optional(v.string()),
    author_display_name: v.optional(v.string()),
    author_name: v.optional(v.string()),
    author_username: v.optional(v.string()),
    categories: v.optional(v.any()),
    category: v.optional(v.any()),
    tags: v.optional(v.any()),
    tag: v.optional(v.any())
});

class ArticleSeeder {
    private db: ReturnType<typeof drizzle>
    private stagingApiUrl: string
    private stagingApiKey?: string
    private seedCount: number = 25
    private embedding: Embedding | null = null
    private chunk: Chunk
    private useEmbeddings: boolean = false

    constructor() {
        this.stagingApiUrl = process.env.STAGING_API_URL || '';
        this.stagingApiKey = process.env.STAGING_API_KEY;
        this.seedCount = parseInt(process.env.SEED_COUNT || '25', 10);

        if (!this.stagingApiUrl) {
            throw new Error('STAGING_API_URL environment variable is required');
        }

        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) {
            throw new Error('DATABASE_URL environment variable is required');
        }

        const urlObj = new URL(databaseUrl);
        const isLocal = urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1';

        const pool = new Pool({
            connectionString: databaseUrl,
            ssl: isLocal ? false : {
                rejectUnauthorized: false
            }
        });

        this.db = drizzle({ schema, client: pool });
        
        // Check if embeddings are available
        const hasEmbeddingKeys = process.env.AWS_BEDROCK_ACCESS_KEY && process.env.AWS_BEDROCK_SECRET_KEY;
        if (hasEmbeddingKeys) {
            this.embedding = new Embedding();
            this.useEmbeddings = true;
        } else {
            console.warn('AWS Bedrock credentials not found. Seeding without embeddings.');
            this.useEmbeddings = false;
        }
        
        this.chunk = new Chunk();
    }

    async fetchStagingArticles(): Promise<StagingArticle[]> {
        try {
            console.log(`Fetching articles from staging server...`);
            console.log(`URL: ${this.stagingApiUrl}`);
            console.log(`Count: ${this.seedCount}`);

            let url = this.stagingApiUrl;
            
            if (!url.endsWith('/articles')) {
                url = url.endsWith('/') ? url + 'articles' : url + '/articles';
            }

            const params = new URLSearchParams({
                limit: this.seedCount.toString(),
                offset: '0'
            });

            const finalUrl = `${url}?${params.toString()}`;

            const headers: HeadersInit = {
                'Content-Type': 'application/json'
            };

            if (this.stagingApiKey) {
                headers['Authorization'] = `Bearer ${this.stagingApiKey}`;
            }

            const response = await fetch(finalUrl, { headers });

            if (!response.ok) {
                throw new Error(
                    `Staging API returned ${response.status}: ${response.statusText}`
                );
            }

            const data = await response.json();

            let articles: StagingArticle[] = [];

            if (Array.isArray(data)) {
                articles = data;
            } else if (data.data && Array.isArray(data.data)) {
                articles = data.data;
            } else if (data.articles && Array.isArray(data.articles)) {
                articles = data.articles;
            } else if (data.posts && Array.isArray(data.posts)) {
                articles = data.posts;
            } else if (data.post && Array.isArray(data.post)) {
                articles = data.post;
            } else {
                throw new Error(
                    'Unexpected staging API response format. Expected array or object with data/articles/posts/post'
                );
            }

            console.log(`✓ Fetched ${articles.length} articles from staging`);
            return articles;

        } catch (error) {
            if (error instanceof Error) {
                console.error(`Failed to fetch staging articles: ${error.message}`);
            } else {
                console.error(`Failed to fetch staging articles:`, error);
            }
            throw error;
        }
    }

    private validateArticle(data: unknown): v.InferOutput<typeof IngestArticleSchema> {
        try {
            // Handle both wrapped (post: {...}) and unwrapped formats
            const articleData = (data as any)?.post || data;
            return v.parse(IngestArticleSchema, articleData);
        } catch (error) {
            if (error instanceof v.ValiError) {
                throw new Error(
                    `Article validation failed: ${error.message}`
                );
            }
            throw error;
        }
    }

    private normalizeArticleData(data: v.InferOutput<typeof IngestArticleSchema>) {
        // Extract the actual content, supporting both formats
        const title = data.post_title || data.title || '';
        const slug = data.post_name || data.slug || '';
        
        // Handle content that might be array or string
        let content = data.post_content || '';
        if (data.content) {
            if (Array.isArray(data.content)) {
                // Join array elements, handling both string and object types
                content = data.content
                    .map((item: any) => {
                        if (typeof item === 'string') return item;
                        if (item?.text) return item.text;
                        if (item?.content) return item.content;
                        return JSON.stringify(item);
                    })
                    .join('\n\n');
            } else {
                content = data.content || content;
            }
        }
        
        const teaser = data.brief_overview || data.overview || '';
        const date = data.post_date || data.published_at || new Date().toISOString();
        const authorName = data.author_name || data.author_display_name || data.author_username || 'Unknown';
        
        // Handle tags and categories which might be objects or arrays
        const tags = toNames(data.tag || data.tags);
        const category = toNames(data.category || data.categories);
        
        return {
            id: data.id,
            title,
            slug,
            content,
            teaser,
            date,
            authorName,
            tags: tags.split(',').filter(Boolean),
            category: category.split(',').filter(Boolean)
        };
    }

    
    async ingestArticle(articleData: StagingArticle | StagingApiArticle): Promise<{
        success: boolean;
        externalId: number;
        message?: string;
        error?: string;
    }> {
        try {
            const validatedData = this.validateArticle(articleData);
            const normalized = this.normalizeArticleData(validatedData);
            
            const titleAndTeaser = `${normalized.title} ${normalized.teaser}`;

            const existing = await this.db
                .select({ id: schema.articles.id })
                .from(schema.articles)
                .where(eq(schema.articles.externalId, normalized.id as number))
                .limit(1);

            if (existing.length > 0) {
                return {
                    success: false,
                    externalId: normalized.id as number,
                    error: 'Article already exists'
                };
            }

            // Create PostData structure for chunking
            const postData = {
                id: normalized.id as number,
                post_title: normalized.title,
                post_name: normalized.slug,
                post_content: normalized.content,
                post_date: normalized.date,
                brief_overview: normalized.teaser,
                author_name: normalized.authorName,
                tag: normalized.tags.length > 0 ? { name: normalized.tags[0] } : [],
                category: normalized.category.length > 0 ? { name: normalized.category[0] } : [],
                other_authors: [],
                co_authors: [],
                post_editors: []
            };

            const chunks = this.chunk.processChunk(postData);

            if (chunks.length === 0) {
                return {
                    success: false,
                    externalId: normalized.id as number,
                    error: 'No chunks generated from article content'
                };
            }

            let titleEmbedding: number[] | null = null;
            let chunkEmbeddings: Map<number, number[]> = new Map();

            if (this.useEmbeddings && this.embedding) {
                const [embedTitle, embedChunks] = await Promise.all([
                    this.embedding.getEmbeddings(titleAndTeaser),
                    this.embedding.getBatchEmbeddings(chunks)
                ]);
                titleEmbedding = embedTitle;
                chunkEmbeddings = embedChunks;
            }

            await this.db.transaction(async (tx) => {
                const article = await tx.insert(schema.articles).values({
                    title: normalized.title,
                    slug: normalized.slug,
                    tags: normalized.tags,
                    category: normalized.category,
                    teaser: normalized.teaser,
                    content: normalized.content,
                    publishedAt: new Date(normalized.date),
                    externalId: normalized.id as number,
                    embedding: titleEmbedding,
                }).returning();

                const articleId = article[0].id;

                await tx.insert(schema.articleChunks).values(
                    chunks.map((c) => ({
                        articleId,
                        chunkIndex: c.index,
                        rawContent: c.content,
                        chunkToEmbed: `Title: ${c.title}\nAuthor: ${c.author}\nCategory: ${c.category}\nDate: ${c.date}\n\n${c.content}`,
                        embedding: chunkEmbeddings.get(c.index) || null
                    }))
                );
            });

            return {
                success: true,
                externalId: normalized.id as number,
                message: `Article ingested with ${chunks.length} chunks`
            };

        } catch (error) {
            if (error instanceof Error) {
                console.error(`   Error processing article: ${error.message}`);
                return {
                    success: false,
                    externalId: (articleData as any)?.id || (articleData as any)?.post?.id || 0,
                    error: error.message
                };
            }
            return {
                success: false,
                externalId: (articleData as any)?.id || (articleData as any)?.post?.id || 0,
                error: 'Unknown error occurred'
            };
        }
    }

    async seed(): Promise<void> {
        console.log('Starting article seeding process...\n');
        
        try {
            const stagingArticles = await this.fetchStagingArticles();

            if (stagingArticles.length === 0) {
                console.warn('No articles fetched from staging server');
                return;
            }

            console.log(`\n Ingesting ${stagingArticles.length} articles...\n`);

            let successful = 0;
            let failed = 0;
            let skipped = 0;

            for (let i = 0; i < stagingArticles.length; i++) {
                const article = stagingArticles[i];
                const progress = `[${i + 1}/${stagingArticles.length}]`;

                try {
                    const result = await this.ingestArticle(article);

                    if (result.success) {
                        console.log(`${progress} Ingested article #${result.externalId}`);
                        console.log(`   ${result.message}`);
                        successful++;
                    } else if (result.error === 'Article already exists') {
                        console.log(`${progress} Article #${result.externalId} already exists (skipped)`);
                        skipped++;
                    } else {
                        console.log(`${progress} Failed to ingest article #${result.externalId}`);
                        console.log(`   Error: ${result.error}`);
                        failed++;
                    }
                } catch (error) {
                    if (error instanceof Error) {
                        console.log(`${progress} ✗ Error: ${error.message}`);
                    }
                    failed++;
                }
            }

            console.log('\n' + '='.repeat(50));
            console.log('Seeding Summary:');
            console.log(`Successfully ingested: ${successful}`);
            console.log(`Skipped (already exist): ${skipped}`);
            console.log(`Failed: ${failed}`);
            console.log('='.repeat(50) + '\n');

            if (successful > 0) {
                console.log('Seeding completed successfully!');
            } else {
                console.log('No articles were ingested');
            }

        } catch (error) {
            console.error('Seeding failed:', error);
            process.exit(1);
        }
    }
}

async function main() {
    try {
        const seeder = new ArticleSeeder();
        await seeder.seed();
        process.exit(0);
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

main();

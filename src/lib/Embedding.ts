
import { ContentChunk } from '$src/types'
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import redis from '$src/lib/redis';
import { destr } from 'destr';

export class Embedding {
    private client: BedrockRuntimeClient
    private modelId = "amazon.titan-embed-text-v2:0"
    private accessKeyId = process.env.AWS_BEDROCK_ACCESS_KEY!
    private secretAccessKey = process.env.AWS_BEDROCK_SECRET_KEY!
    private region = process.env.AWS_REGION || "us-east-1"
    private MODEL_VERSION = 'v1';
    private BATCH_SIZE = 5;

    constructor() {
        this.client = new BedrockRuntimeClient({
            region: this.region,
            credentials: {
                accessKeyId: this.accessKeyId,
                secretAccessKey: this.secretAccessKey
            }
        });
    }
    private getCacheKey(text: string): string {
        const normalized = text.trim().toLowerCase();
        const textHash = Bun.hash(normalized).toString();

        return `emb:${this.MODEL_VERSION}:${textHash}`;
    }

    async getEmbeddings(text: string) {

        const cacheKey = this.getCacheKey(text);
        try {
            const cached = await redis.get(cacheKey);
            const parsed = destr<number[]>(cached);

            if (Array.isArray(parsed)) return parsed;

        } catch (err) {
            console.error('Redis cache read failed:', err);
        }

        const response = await this.client.send(new InvokeModelCommand({
            modelId: this.modelId,
            body: JSON.stringify({ inputText: text })
        }));

        const result = destr<{ embedding: number[] }>(
            new TextDecoder().decode(response.body)
        );

        if (!result?.embedding || !Array.isArray(result.embedding)) {
            throw new Error(`Bedrock returned invalid format`);
        }

        redis.set(cacheKey, JSON.stringify(result.embedding))
            .catch(err => console.error('Redis write failed:', err));

        return result.embedding;
    }

    async getBatchEmbeddings(chunks: ContentChunk[]): Promise<Map<number, number[]>> {
        const results = new Map<number, number[]>()
        for (let i = 0; i < chunks.length; i += this.BATCH_SIZE) {
            const batch = chunks.slice(i, i + this.BATCH_SIZE);

            await Promise.all(batch.map(async (chunk) => {
                const textToEmbed = `Title: ${chunk.title}\nAuthor: ${chunk.author}\nCategory: ${chunk.category}\nDate: ${chunk.date}\n\n${chunk.content}`;
                try {
                    const embedding = await this.getEmbeddings(textToEmbed);
                    results.set(chunk.index, embedding);
                } catch (e) {
                    console.error(`Failed to embed chunk ${chunk.index}`, e);
                }
            }));
        }

        return results;
    }
}
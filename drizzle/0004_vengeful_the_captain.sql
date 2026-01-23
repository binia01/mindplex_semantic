ALTER TABLE "article_chunks" RENAME COLUMN "embedded_content" TO "chunk_to_embed";--> statement-breakpoint
ALTER TABLE "article_chunks" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', chunk_to_embed)) STORED;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '')), 'A') || 
            setweight(to_tsvector('english', coalesce(teaser, '')), 'B')) STORED;--> statement-breakpoint
CREATE INDEX "chunks_search_idx" ON "article_chunks" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "articles_search_idx" ON "articles" USING gin ("search_vector");
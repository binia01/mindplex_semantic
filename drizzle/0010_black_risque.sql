ALTER TABLE "summaries" ADD COLUMN "embedding" vector(1024);--> statement-breakpoint
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_article_id_tone_idx" UNIQUE("article_id","tone");
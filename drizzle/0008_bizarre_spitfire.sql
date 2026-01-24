ALTER TABLE "articles" drop column "search_vector";--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce(title, '')), 'A') || 
        setweight(to_tsvector('english', coalesce(teaser, '')), 'B')) STORED;--> statement-breakpoint
ALTER TABLE "article_chunks" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;
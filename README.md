# Mindplex Semantic

Mindplex Semantic is the search and indexing service behind article discovery, fuzzy user lookup, chunk retrieval, and tone-specific article summaries.

## Stack

- Bun + Hono for the API
- PostgreSQL 16 with `pgvector` and `pg_trgm`
- Drizzle ORM for schema and migrations
- Redis for embedding cache
- AWS Bedrock Titan v2 embeddings

## API conventions

- All public endpoints live under `/v1`.
- Resource lookups use external IDs in the path, for example `/v1/articles/:id`.
- `fields` can be used on read endpoints to limit the returned columns.
- `GET /v1/summaries` returns all summaries with pagination.
- Article summaries are article-scoped resources:
  - `GET /v1/articles/:id/summaries`
  - `GET /v1/articles/:id/summaries/:tone`
  - `PUT /v1/articles/:id/summaries/:tone`

See [docs/api.md](docs/api.md) for the endpoint reference.

## Local setup

1. Install dependencies:

```bash
bun install
```

2. Start PostgreSQL and Redis:

```bash
docker compose -f Docker-compose.yml up -d db redis
```

3. Set environment variables in `.env`:

```bash
DATABASE_URL=postgres://mindplex:mindplex@localhost:5432/semantic
REDIS_URL=redis://localhost:6379
AWS_BEDROCK_ACCESS_KEY=...
AWS_BEDROCK_SECRET_KEY=...
AWS_REGION=us-east-1
```

4. Bootstrap the database and extensions:

```bash
bun run db:setup
```

5. Apply migrations:

```bash
bun run db:dev-migrate
```

6. Run the API:

```bash
bun run dev
```

## Useful endpoints

- `GET /health` for the health check
- `GET /doc` for the raw OpenAPI document
- `GET /ui` for the interactive API reference

## Data flows

- `POST /v1/ingest/articles` stores article metadata, generates embeddings, and writes searchable chunks.
- `POST /v1/ingest/users` stores users for fuzzy lookup.
- `PUT /v1/articles/:id/summaries/:tone` stores or replaces a summary for a given article and tone.

Only the `formal` summary tone generates and stores an embedding today.

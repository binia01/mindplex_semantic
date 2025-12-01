# Mindplex Semantic

Search and AI infrastructure for Mindplex powering vector search, related articles, fuzzy user lookup, and conversational AI over published content.

## Features

- **Article Search** - Vector similarity search across article content
- **Related Articles** - Find similar articles using embedding similarity
- **User Search** - Fuzzy search with typo tolerance (pg_trgm)
- **RAG Chat** - Chat with article content (retrieval augmented generation)

## Architecture

```mermaid

flowchart TB
    subgraph UserSearch["User Search (pg_trgm)"]
        UQ[/"User types: 'ben mezrik'"/]
        UQ --> TRGM["Break into trigrams"]
        TRGM --> TGRAMS["{ ben, en , n m, mez, ezr, zri, rik }"]
        TGRAMS --> COMPARE["Compare against stored trigrams"]
        COMPARE --> USCORE["Score by overlap %"]
        USCORE --> URES[/"Ben Mezrich (92% match)"/]
    end

    subgraph ContentSearch["Article Search (pgvector)"]
        AQ[/"User asks: 'What did Ben write about AI?'"/]
        AQ --> EMBED["Embed query via OpenAI"]
        EMBED --> QVEC["[0.23, -0.45, 0.87, ...]"]
        QVEC --> VCOMPARE["Calculate distance to all chunk vectors"]
        VCOMPARE --> VSCORE["Rank by cosine similarity"]
        VSCORE --> VRES[/"Top 5 relevant chunks"/]
    end

    subgraph Database["PostgreSQL"]
        USERS[(users table)]
        CHUNKS[(article_chunks table)]
        
        USERS --> |"search_name + GIN index"| TRGM_IDX["pg_trgm index"]
        CHUNKS --> |"embedding column"| VEC_IDX["pgvector HNSW index"]
    end

    COMPARE --> TRGM_IDX
    VCOMPARE --> VEC_IDX

    subgraph DataFlow["Data Ingestion"]
        MAIN["Main Backend"]
        HONO["Hono Embedding Service"]
        
        MAIN -->|"POST /embed\n{article + metadata}"| HONO
        HONO -->|"1. Chunk article"| CHUNK["Split into ~500 token chunks"]
        CHUNK -->|"2. Prepend metadata"| ENRICH["Add title, author, date to each chunk"]
        ENRICH -->|"3. Embed"| OPENAI["OpenAI text-embedding-3-small"]
        OPENAI -->|"4. Store"| CHUNKS
    end

    style UserSearch fill:#e8f5e9
    style ContentSearch fill:#e3f2fd
    style Database fill:#fff3e0
    style DataFlow fill:#fce4ec
```

## Tech Stack

- **Runtime** - Bun
- **Framework** - Hono
- **Database** - PostgreSQL 16
- **ORM** - Drizzle
- **Vector Search** - pgvector
- **Fuzzy Search** - pg_trgm
- **Embeddings** - OpenAI text-embedding-3-small

## Setup

```bash
# Install dependencies
bun install

# Copy env
cp .env.example .env
# Add your OPENAI_API_KEY

# Start database
docker compose up db -d

# Create extensions
docker exec mindplex_semantic-db-1 psql -U mindplex -d semantic -c "CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pg_trgm;"

# Run migrations
bunx drizzle-kit push

# Start dev server
bun run dev
```

## API Endpoints

### Articles

| Method | Path | Description |
|--------|------|-------------|
| POST | `/articles` | Create article + embed + chunk |
| PUT | `/articles/:id` | Update article + re-embed |
| DELETE | `/articles/:id` | Delete article + chunks |
| GET | `/articles/:id/related` | Get related articles |

### Search

| Method | Path | Description |
|--------|------|-------------|
| POST | `/search` | Vector search across chunks |
| POST | `/search/articles` | Search article-level embeddings |

### Users

| Method | Path | Description |
|--------|------|-------------|
| POST | `/users` | Create user |
| PUT | `/users/:id` | Update user |
| DELETE | `/users/:id` | Delete user |
| GET | `/users/search?q=` | Fuzzy search users |

### Chat

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat` | RAG chat with article |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |

## Database Schema

```
articles
├── id
├── external_id
├── slug
├── title
├── teaser
├── category
├── tags[]
├── published_at
├── embedding (vector 1536) ── for related articles
└── created_at

article_authors
├── id
├── article_id → articles
└── user_id → users

article_chunks
├── id
├── article_id → articles
├── chunk_index
├── raw_content
├── embedded_content
├── embedding (vector 1536) ── for search/RAG
└── created_at

users
├── id
├── external_id
├── first_name
├── last_name
├── username
├── search_name (indexed with pg_trgm)
└── created_at
```

## How It Works

### Article Embedding

1. Article received with title, teaser, content
2. Title + teaser → embedded → stored on `articles.embedding` (for related)
3. Content → chunked (~500 tokens) → each chunk embedded → stored in `article_chunks`

```
DATABASE_URL=postgres://mindplex:mindplex@localhost:5432/semantic
OPENAI_API_KEY=sk-...
```

## Docker

```bash
# Start everything
docker compose up

# Start only db
docker compose up db -d

# Run studio
bunx drizzle-kit studio
```

## Future: Event Bus Integration

Currently uses direct HTTP calls. Will integrate RabbitMQ for:

- `article.published` → embed + store
- `article.updated` → re-embed
- `article.deleted` → remove chunks
- `user.created` → sync user
- `user.updated` → update search_name

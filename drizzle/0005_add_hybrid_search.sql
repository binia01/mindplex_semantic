-- Custom SQL migration file, put your code below! --
CREATE EXTENSION IF NOT EXISTS vector;
-- Define the search function
CREATE OR REPLACE FUNCTION hybrid_search(
        query_text TEXT,
        query_embedding VECTOR(1024),
        match_count INT,
        full_text_weight FLOAT DEFAULT 1.0,
        semantic_weight FLOAT DEFAULT 1.0
    ) RETURNS TABLE (
        id INT,
        article_id INT,
        raw_content TEXT,
        similarity FLOAT
    ) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY WITH vector_search AS (
        SELECT ac.id,
            ROW_NUMBER() OVER (
                ORDER BY ac.embedding <=> query_embedding
            ) as rank_ix
        FROM article_chunks ac
        ORDER BY ac.embedding <=> query_embedding
        LIMIT match_count * 3
    ), keyword_search AS (
        SELECT ac.id,
            ROW_NUMBER() OVER (
                ORDER BY ts_rank_cd(
                        ac.search_vector,
                        websearch_to_tsquery('english', query_text)
                    ) DESC
            ) as rank_ix
        FROM article_chunks ac
        WHERE ac.search_vector @@ websearch_to_tsquery('english', query_text)
        LIMIT match_count * 3
    )
SELECT ac.id,
    ac.article_id,
    ac.raw_content,
    COALESCE(1.0 / (60 + vs.rank_ix), 0.0) * semantic_weight + COALESCE(1.0 / (60 + ks.rank_ix), 0.0) * full_text_weight AS similarity
FROM article_chunks ac
    FULL OUTER JOIN vector_search vs ON ac.id = vs.id
    FULL OUTER JOIN keyword_search ks ON ac.id = ks.id
WHERE vs.id IS NOT NULL
    OR ks.id IS NOT NULL
ORDER BY similarity DESC
LIMIT match_count;
END;
$$;
import * as v from 'valibot';
import { articles } from '$src/db/schema';
import { createFieldsSchema } from '$src/utils';

export const FORBIDDEN_COLUMNS = new Set(['embedding', 'searchVector', 'id']);
export const ALLOWED_UPDATE_FIELDS = new Set(['title', 'teaser', 'content', 'category', 'tags', 'slug'])
const DEFAULT_LIMIT = "10";
const DEFAULT_PAGE = "1";
const MAX_LIMIT = 100;

export const SearchQuerySchema = v.object({
    q: v.optional(v.string()),
    limit: v.optional(
        v.pipe(
            v.string(),
            v.transform(Number),
            v.integer(),
            v.minValue(1),
            v.maxValue(MAX_LIMIT)
        ),
        DEFAULT_LIMIT
    ),
    page: v.optional(
        v.pipe(
            v.string(),
            v.transform(Number),
            v.integer(),
        ),
        DEFAULT_PAGE
    ),
    fields: createFieldsSchema(articles, FORBIDDEN_COLUMNS),
});

export const ExternalIdParamsSchema = v.object({
    id: v.pipe(
        v.string(),
        v.transform(Number),
        v.integer(),
        v.minValue(1)
    )
});

export const GetArticleQuerySchema = v.object({
    fields: createFieldsSchema(articles, FORBIDDEN_COLUMNS),
});

export const UpdateArticleSchema = v.object({
    title: v.optional(v.string()),
    teaser: v.optional(v.string()),
    content: v.optional(v.string()),
    category: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
});

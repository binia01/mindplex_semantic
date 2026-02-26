import * as v from 'valibot';
import { articles } from '$src/db/schema';
import { createFieldsSchema } from '$src/utils';
import { PaginationLimitSchema, PaginationPageSchema, IdParamSchema } from '$src/lib/validators';
import { articleChunks } from '$src/db/schema';

export const FORBIDDEN_COLUMNS = new Set(['embedding', 'searchVector', 'id']);
export const ALLOWED_UPDATE_FIELDS = new Set(['title', 'teaser', 'content', 'category', 'tags', 'slug'])

export const SearchQuerySchema = v.object({
    q: v.optional(v.string()),
    limit: PaginationLimitSchema,
    page: PaginationPageSchema,
    fields: createFieldsSchema(articles, FORBIDDEN_COLUMNS),
});

export const ExternalIdParamsSchema = v.object({
    id: IdParamSchema
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

export const RelatedArticlesQuerySchema = v.object({
    limit: PaginationLimitSchema,
    fields: createFieldsSchema(articles, FORBIDDEN_COLUMNS),
});

export const GetChunksQuerySchema = v.object({
    fields: createFieldsSchema(articleChunks, new Set([])),
});
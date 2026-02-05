import * as v from 'valibot';
import { createFieldsSchema } from '$src/utils';
import { articles } from '$src/db/schema';
import { PaginationLimitSchema, PaginationPageSchema } from '$src/lib/validators'

export const FORBIDDEN_COLUMNS = new Set(['embedding', 'searchVector']);

export const SearchQuerySchema = v.object({
    q: v.optional(v.string()),
    limit: PaginationLimitSchema,
    page: PaginationPageSchema,
    fields: createFieldsSchema(articles, FORBIDDEN_COLUMNS),
});

export type SearchQuery = v.InferOutput<typeof SearchQuerySchema>;
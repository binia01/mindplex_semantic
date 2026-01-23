import * as v from 'valibot';
import { getTableColumns } from 'drizzle-orm';
import { articles } from '$src/db/schema';

const DEFAULT_LIMIT = "10";
const DEFAULT_OFFSET = "0";
const MAX_LIMIT = 100;

const allColumns = getTableColumns(articles);
const validColumnNames = Object.keys(allColumns);
const FORBIDDEN = new Set(['embedding', 'searchVector']);

const ALLOWED_SET = new Set(validColumnNames.filter(name => !FORBIDDEN.has(name)));

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
    offset: v.optional(
        v.pipe(
            v.string(),
            v.transform(Number),
            v.integer(),
            v.minValue(0)
        ),
        DEFAULT_OFFSET
    ),
    fields: v.optional(
        v.pipe(
            v.string(),
            v.check((input) => {
                if (!input) return true;
                const requested = input.split(',').map(s => s.trim());
                return requested.every(field => ALLOWED_SET.has(field));
            }, `Invalid field(s). Allowed: ${Array.from(ALLOWED_SET).join(', ')}`)
        )
    )
});

export type SearchQuery = v.InferOutput<typeof SearchQuerySchema>;
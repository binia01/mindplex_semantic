import * as v from 'valibot';

export const PAGINATION_RULES = {
    DEFAULT_LIMIT: "10",
    DEFAULT_PAGE: "1",
    MAX_LIMIT: 100,
} as const;

export const PaginationLimitSchema = v.optional(
    v.pipe(
        v.string(),
        v.transform(Number),
        v.integer(),
        v.minValue(1),
        v.maxValue(PAGINATION_RULES.MAX_LIMIT)
    ),
    PAGINATION_RULES.DEFAULT_LIMIT
);

export const PaginationPageSchema = v.optional(
    v.pipe(
        v.string(),
        v.transform(Number),
        v.integer(),
    ),
    PAGINATION_RULES.DEFAULT_PAGE
);

export const IdParamSchema = v.pipe(
    v.string(),
    v.transform(Number),
    v.integer(),
    v.minValue(1)
);
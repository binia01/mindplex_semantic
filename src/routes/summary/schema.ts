import * as v from 'valibot'
import { summaries, availableTones } from '$src/db/schema'
import { createFieldsSchema } from '$src/utils'
import { IdParamSchema, PaginationLimitSchema, PaginationPageSchema } from '$src/lib/validators'

export const FORBIDDEN_COLUMNS = new Set(['embedding', 'id', 'articleId'])

export const ToneSchema = v.picklist(availableTones)

export const SummaryArticleParamsSchema = v.object({
    id: IdParamSchema
})

export const SummaryToneParamsSchema = v.object({
    id: IdParamSchema,
    tone: ToneSchema
})

export const SummaryFieldsQuerySchema = v.object({
    fields: createFieldsSchema(summaries, FORBIDDEN_COLUMNS)
})

export const SummaryCollectionQuerySchema = v.object({
    tone: v.optional(ToneSchema),
    limit: PaginationLimitSchema,
    page: PaginationPageSchema,
    fields: createFieldsSchema(summaries, FORBIDDEN_COLUMNS)
})

export const UpsertSummarySchema = v.object({
    summary: v.string()
})

import * as v from 'valibot'
import { users } from '$src/db/schema'
import { createFieldsSchema } from '$src/utils'
import { PaginationLimitSchema, PaginationPageSchema, IdParamSchema } from '$src/lib/validators'

export const FORBIDDEN_USER_COLUMNS = new Set(['searchName'])

export const ALLOWED_USER_UPDATE_FIELDS = new Set(['firstName', 'lastName', 'username', 'email'])

export const ExternalIdParamsSchema = v.object({
    id: IdParamSchema
})

export const SearchQuerySchema = v.object({
    q: v.optional(v.string()),
    limit: PaginationLimitSchema,
    page: PaginationPageSchema,
    fields: createFieldsSchema(users, FORBIDDEN_USER_COLUMNS),
})

export const GetUserQuerySchema = v.object({
    fields: createFieldsSchema(users, FORBIDDEN_USER_COLUMNS),
})

export const UpdateUserSchema = v.object({
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    username: v.optional(v.string()),
    email: v.optional(v.pipe(v.string(), v.email())),
})

export type SearchQuery = v.InferOutput<typeof SearchQuerySchema>
export type GetUserQuery = v.InferOutput<typeof GetUserQuerySchema>
export type UpdateUser = v.InferOutput<typeof UpdateUserSchema>
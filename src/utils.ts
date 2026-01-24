import { getTableColumns } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as v from 'valibot';

/**
 * Converts an input to a comma-separated string of names.
 * 
 * @param input - The input to convert. Can be a string, array of strings, or object with a `name` property.
 * @returns A comma-separated string of names.
 * 
 * @example
 * ```typescript
 * const names = toNames(['John', 'Jane']); // 'John,Jane'
 * const name = toNames({ name: 'John' }); // 'John'
 * const empty = toNames(null); // ''
 * ```
 */

export function toNames(input: { name: string } | { name: string }[]) {
    if (!input) return '';

    return Array.isArray(input)
        ? input.map(item => item?.name ?? item).join(',')
        : input.name ?? input;
}

/**
 * Creates a Valibot schema for validating comma-separated field names from a table.
 * 
 * @template T - The Drizzle table type
 * @param table - The Drizzle table schema to extract columns from
 * @param forbiddenFields - Set of column names that should not be allowed (e.g., sensitive fields)
 * @returns A Valibot optional string schema that validates field names
 * 
 * @example
 * ```typescript
 * import { articles } from './schema';
 * 
 * const FORBIDDEN = new Set(['embedding', 'searchVector', 'password']);
 * 
 * const QuerySchema = v.object({
 *   fields: createFieldsSchema(articles, FORBIDDEN)
 * });
 * 
 * // Valid: ?fields=title,content
 * // Invalid: ?fields=title,embedding (embedding is forbidden)
 * ```
 */
export function createFieldsSchema<T extends PgTable>(
    table: T,
    forbiddenFields: Set<string>
) {
    const allColumns = getTableColumns(table);
    const validColumnNames = Object.keys(allColumns);
    const allowedSet = new Set(validColumnNames.filter(name => !forbiddenFields.has(name)));

    return v.optional(
        v.pipe(
            v.string(),
            v.check((input) => {
                if (!input) return true;
                const requested = input.split(',').map(s => s.trim());
                return requested.every(field => allowedSet.has(field));
            }, `Invalid field(s). Allowed: ${Array.from(allowedSet).join(', ')}`)
        )
    );
}



/**
 * Builds a Drizzle select object based on requested fields.
 * 
 * **Behavior:**
 * - If `fields` is provided: Returns only the specified fields (+ baseSelection)
 * - If `fields` is undefined/empty: Returns ALL columns except forbidden ones (+ baseSelection)
 * 
 * @template T - The Drizzle table type
 * @param table - The Drizzle table schema to extract columns from
 * @param fields - Comma-separated list of field names (e.g., "title,content,publishedAt")
 * @param forbiddenFields - Set of column names to exclude (default: empty set)
 * @param baseSelection - Additional fields to always include (e.g., { id: table.id, score: sql`...` })
 * @returns Object suitable for Drizzle's `.select()` method
 * 
 * @example
 * ```typescript
 * import { articles } from './schema';
 * 
 * const FORBIDDEN = new Set(['embedding', 'searchVector']);
 * 
 * // Example 1: User requests specific fields
 * const selection1 = buildFieldSelection(
 *   articles,
 *   "title,content", // Only these fields
 *   FORBIDDEN,
 *   { id: articles.id } // Always include id
 * );
 * // Result: { id: articles.id, title: articles.title, content: articles.content }
 * 
 * // Example 2: No fields specified - returns all except forbidden
 * const selection2 = buildFieldSelection(
 *   articles,
 *   undefined, // No fields param
 *   FORBIDDEN
 * );
 * // Result: { title: articles.title, content: articles.content, slug: articles.slug, ... }
 * // (everything except 'embedding' and 'searchVector')
 * 
 * // Example 3: Use in a route
 * const fields = c.req.valid('query').fields;
 * const selection = buildFieldSelection(articles, fields, FORBIDDEN);
 * const results = await db.select(selection).from(articles);
 * ```
 */
export function buildFieldSelection<T extends PgTable>(
    table: T,
    fields?: string,
    forbiddenFields: Set<string> = new Set(),
    baseSelection: Record<string, any> = {}
): Record<string, any> {
    const selection = { ...baseSelection };
    const allColumns = getTableColumns(table);

    if (fields) {
        fields.split(',').forEach(field => {
            const fieldName = field.trim();
            if (fieldName in allColumns) {
                selection[fieldName] = allColumns[fieldName as keyof typeof allColumns];
            }
        });
    } else {
        Object.keys(allColumns).forEach(key => {
            if (!forbiddenFields.has(key)) {
                selection[key] = allColumns[key as keyof typeof allColumns];
            }
        });
    }

    return selection;
}



/**
 * Returns an array of allowed column names for a table (excluding forbidden ones).
 * 
 * Useful for generating API documentation or error messages.
 * 
 * @template T - The Drizzle table type
 * @param table - The Drizzle table schema
 * @param forbiddenFields - Set of column names to exclude
 * @returns Array of allowed column names
 * 
 * @example
 * ```typescript
 * import { articles } from './schema';
 * 
 * const FORBIDDEN = new Set(['embedding', 'searchVector']);
 * const allowed = getAllowedFields(articles, FORBIDDEN);
 * 
 * console.log(allowed);
 * // ['id', 'title', 'content', 'slug', 'publishedAt', ...]
 * 
 * // Use in API docs
 * return c.json({
 *   message: 'Invalid field',
 *   allowedFields: allowed
 * }, 400);
 * ```
 */
export function getAllowedFields<T extends PgTable>(
    table: T,
    forbiddenFields: Set<string>
): string[] {
    const allColumns = getTableColumns(table);
    return Object.keys(allColumns).filter(name => !forbiddenFields.has(name));
}



/**
 * Sanitizes an update object to only include allowed fields.
 * Prevents accidental or malicious updates to protected fields like id, timestamps, etc.
 * 
 * @param updates - The raw update object from the request
 * @param allowedFields - Set of field names that are safe to update
 * @returns Sanitized object containing only allowed fields
 * 
 * @example
 * ```typescript
 * const ALLOWED = new Set(['title', 'content', 'tags']);
 * const rawUpdates = { title: 'New', id: 999, embedding: [...] };
 * 
 * const safe = sanitizeUpdates(rawUpdates, ALLOWED);
 * // Result: { title: 'New' } 
 * // (id and embedding are stripped out)
 * 
 * // Use in route
 * const updates = c.req.valid('json');
 * const sanitized = sanitizeUpdates(updates, ALLOWED);
 * 
 * if (Object.keys(sanitized).length === 0) {
 *   return c.json({ error: 'No valid fields to update' }, 400);
 * }
 * 
 * await db.update(table).set(sanitized).where(...);
 * ```
 */
export function sanitizeUpdates<T extends Record<string, any>>(
    updates: T,
    allowedFields: Set<string>
): Partial<T> {
    return Object.keys(updates)
        .filter(key => allowedFields.has(key))
        .reduce((obj, key) => {
            obj[key as keyof T] = updates[key];
            return obj;
        }, {} as Partial<T>);
}
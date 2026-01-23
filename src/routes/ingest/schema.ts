import * as v from 'valibot';

const NameObjectSchema = v.object({ name: v.string() });
const ObjectOrEmptyArray = v.union([
    NameObjectSchema,
    v.tuple([])
]);

export const IngestArticleSchema = v.object({
    post: v.object({
        id: v.union([
            v.number(),
            v.pipe(v.string(), v.transform(Number))
        ]),
        post_title: v.string(),
        post_name: v.string(),
        post_content: v.string(),
        brief_overview: v.string(),
        author_name: v.string(),
        post_date: v.string(),
        tag: v.optional(ObjectOrEmptyArray, []),
        category: v.optional(ObjectOrEmptyArray, []),
        other_authors: v.optional(v.tuple([]), []),
        co_authors: v.optional(v.tuple([]), []),
        post_editors: v.optional(v.tuple([]), []),
    })
});

export const IngestUserSchema = v.object({
    id: v.number(),
    firstName: v.string(),
    lastName: v.string(),
    username: v.string(),
    email: v.string(),
});

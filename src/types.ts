import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./db/schema";

export type AppContext = {
    Variables: {
        db: NodePgDatabase<typeof schema>
        schema: typeof schema
    };
};


export interface ParsedNode {
    tag: string
    text: string
    classes?: string[]
}

export interface ContentChunk {
    title: string
    author: string
    date: string
    category: string
    index: number
    content: string
}

export interface PostData {
    ID: number,
    post_author: string,
    post_date: string,
    post_date_gmt: string,
    post_content: string
    about_the_author: {
        author_role: string,
        author_bio: string
    }[],
    brief_overview: string,
    tag: {
        term_id: number,
        name: string,
        slug: string,
        term_group: number,
        term_taxonomy_id: number,
        taxonomy: string,
        description: string,
        parent: number,
        count: number,
        filter: string
    } | [],
    category: {
        term_id: number,
        name: string,
        slug: string,
        term_group: number,
        term_taxonomy_id: number,
        taxonomy: string,
        description: string,
        parent: number,
        count: number,
        filter: string,
        cat_ID: number,
        category_count: number,
        category_description: string,
        cat_name: string,
        category_nicename: string,
        category_parent: number
    } | [],
    post_title: string,
    post_excerpt: string,
    post_status: string,
    comment_status: string,
    ping_status: string,
    post_password: string,
    post_name: string,
    to_ping: string,
    pinged: string,
    post_modified: string,
    post_modified_gmt: string,
    post_content_filtered: string,
    post_parent: number,
    guid: string,
    menu_order: number,
    post_type: string,
    post_mime_type: string,
    comment_count: string,
    filter: string,
    origin_resource: string
}

export interface UserData {
    id: number,
    firstName: string,
    lastName: string,
    username: string,
    email: string,
    searchName?: string,
}

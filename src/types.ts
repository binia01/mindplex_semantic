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
    post_date: string,
    post_content: string
    brief_overview: string,
    tag: {
        name: string,
    } | [],
    category: {
        name: string,
    } | [],
    post_title: string,
    post_name: string,
    other_authors: [],
    co_authors: [],
    post_editors: [],
    author_name: string,
}

export interface UserData {
    id: number,
    firstName: string,
    lastName: string,
    username: string,
    email: string,
    searchName?: string,
}

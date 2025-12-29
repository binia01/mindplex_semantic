export const openApiDoc = {
    openapi: '3.0.0',
    info: {
        title: 'Mindplex Semantic API',
        version: '1.0.0',
        description: 'API for managing articles and users with semantic search and ingestion capabilities for mindplex applications.',
    },
    components: {
        schemas: {
            PostData: {
                type: 'object',
                properties: {
                    id: { type: 'number' },
                    post_date: { type: 'string', format: 'date-time' },
                    post_content: { type: 'string' },
                    brief_overview: { type: 'string' },
                    post_title: { type: 'string' },
                    post_name: { type: 'string' },
                    author_name: { type: 'string' },
                    tag: {
                        type: 'object',
                        properties: { name: { type: 'string' } }
                    },
                    category: {
                        type: 'object',
                        properties: { name: { type: 'string' } }
                    }
                },
                required: ['id', 'post_title']
            },
            UserData: {
                type: 'object',
                properties: {
                    id: { type: 'number' },
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                    username: { type: 'string' },
                    email: { type: 'string' }
                },
                required: ['id', 'email', 'username']
            }
        }
    },
    paths: {
        '/health': {
            get: {
                summary: 'System Health Check',
                tags: ['System'],
                responses: {
                    '200': { description: 'Database is healthy' },
                    '500': { description: 'Database connection failed' }
                }
            }
        },
        '/users': {
            get: {
                summary: 'Search Users',
                description: 'Fuzzy search users by name, username, or email.',
                tags: ['Users'],
                parameters: [
                    { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search query' },
                    { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
                    { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } }
                ],
                responses: {
                    '200': { description: 'List of users' }
                }
            }
        },
        '/ingest/articles': {
            post: {
                summary: 'Ingest Article',
                description: 'Process an article, generate embeddings, and store in DB.',
                tags: ['Ingest'],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    post: { $ref: '#/components/schemas/PostData' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    '200': { description: 'Ingest successful' },
                    '409': { description: 'Article already exists' },
                    '502': { description: 'Embedding service failed' }
                }
            }
        },
        '/ingest/users': {
            post: {
                summary: 'Ingest User',
                tags: ['Ingest'],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/UserData' }
                        }
                    }
                },
                responses: {
                    '200': { description: 'User created' },
                    '409': { description: 'User already exists' }
                }
            }
        }
    }
}
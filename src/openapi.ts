export const openApiDoc = {
    openapi: '3.0.3',
    info: {
        title: 'Semantic Search API',
        description: `A semantic search API for articles and users with hybrid search capabilities.

**Features:**
- Hybrid semantic search for articles (vector + full-text)
- Fuzzy text search for users
- Field selection for optimized responses
- RESTful CRUD operations`,
        version: '1.0.0',
        contact: {
            name: 'API Support',
            email: 'support@example.com'
        }
    },
    servers: [
        {
            url: 'http://localhost:3000/v1',
            description: 'Development server'
        },
        {
            url: 'https://api.example.com/v1',
            description: 'Production server'
        }
    ],
    tags: [
        {
            name: 'Articles',
            description: 'Article search and management'
        },
        {
            name: 'Users',
            description: 'User search and management'
        },
        {
            name: 'Ingest',
            description: 'Data ingestion with processing (embeddings, chunking)'
        }
    ],
    paths: {
        '/articles': {
            get: {
                tags: ['Articles'],
                summary: 'Search articles',
                description: `Hybrid semantic search combining vector embeddings and full-text search.
Returns articles ranked by relevance score (70% vector, 30% text).

**Search requires a query parameter \`q\`**.`,
                operationId: 'searchArticles',
                parameters: [
                    {
                        name: 'q',
                        in: 'query',
                        required: true,
                        description: 'Search query (semantic + full-text)',
                        schema: {
                            type: 'string',
                            example: 'machine learning best practices'
                        }
                    },
                    {
                        name: 'limit',
                        in: 'query',
                        description: 'Maximum number of results',
                        schema: {
                            type: 'integer',
                            minimum: 1,
                            maximum: 100,
                            default: 10
                        }
                    },
                    {
                        name: 'offset',
                        in: 'query',
                        description: 'Number of results to skip (pagination)',
                        schema: {
                            type: 'integer',
                            minimum: 0,
                            default: 0
                        }
                    },
                    {
                        name: 'fields',
                        in: 'query',
                        description: 'Comma-separated list of fields to return',
                        schema: {
                            type: 'string',
                            example: 'title,teaser,publishedAt'
                        }
                    }
                ],
                responses: {
                    '200': {
                        description: 'Successful search',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        articles: {
                                            type: 'array',
                                            items: {
                                                $ref: '#/components/schemas/ArticleSearchResult'
                                            }
                                        },
                                        meta: {
                                            type: 'object',
                                            properties: {
                                                query: { type: 'string' },
                                                count: { type: 'integer' }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    '400': {
                        $ref: '#/components/responses/BadRequest'
                    }
                }
            }
        },
        '/articles/{id}': {
            get: {
                tags: ['Articles'],
                summary: 'Get article by ID',
                description: 'Retrieve a single article by its external ID',
                operationId: 'getArticle',
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'Article external ID',
                        schema: {
                            type: 'integer',
                            minimum: 1
                        }
                    },
                    {
                        name: 'fields',
                        in: 'query',
                        description: 'Comma-separated list of fields to return',
                        schema: {
                            type: 'string',
                            example: 'title,content,category'
                        }
                    }
                ],
                responses: {
                    '200': {
                        description: 'Article found',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Article'
                                }
                            }
                        }
                    },
                    '404': {
                        $ref: '#/components/responses/NotFound'
                    }
                }
            },
            patch: {
                tags: ['Articles'],
                summary: 'Update article',
                description: 'Update article metadata (does not re-generate embeddings). Only specified fields will be updated.',
                operationId: 'updateArticle',
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'Article external ID',
                        schema: {
                            type: 'integer'
                        }
                    }
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/UpdateArticle'
                            }
                        }
                    }
                },
                responses: {
                    '200': {
                        description: 'Article updated successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string' },
                                        article: {
                                            $ref: '#/components/schemas/Article'
                                        }
                                    }
                                }
                            }
                        }
                    },
                    '400': {
                        $ref: '#/components/responses/BadRequest'
                    },
                    '404': {
                        $ref: '#/components/responses/NotFound'
                    }
                }
            },
            delete: {
                tags: ['Articles'],
                summary: 'Delete article',
                description: 'Permanently delete an article and its chunks',
                operationId: 'deleteArticle',
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'Article external ID',
                        schema: {
                            type: 'integer'
                        }
                    }
                ],
                responses: {
                    '200': {
                        description: 'Article deleted successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string' },
                                        externalId: { type: 'integer' }
                                    }
                                }
                            }
                        }
                    },
                    '404': {
                        $ref: '#/components/responses/NotFound'
                    }
                }
            }
        },
        '/users': {
            get: {
                tags: ['Users'],
                summary: 'Search users',
                description: `Fuzzy text search for users using trigram similarity.
Searches across first name, last name, username, and email.

**Search requires a query parameter \`q\`**.`,
                operationId: 'searchUsers',
                parameters: [
                    {
                        name: 'q',
                        in: 'query',
                        required: true,
                        description: 'Search query',
                        schema: {
                            type: 'string',
                            example: 'john doe'
                        }
                    },
                    {
                        name: 'limit',
                        in: 'query',
                        description: 'Maximum number of results',
                        schema: {
                            type: 'integer',
                            minimum: 1,
                            maximum: 100,
                            default: 10
                        }
                    },
                    {
                        name: 'offset',
                        in: 'query',
                        description: 'Number of results to skip (pagination)',
                        schema: {
                            type: 'integer',
                            minimum: 0,
                            default: 0
                        }
                    },
                    {
                        name: 'fields',
                        in: 'query',
                        description: 'Comma-separated list of fields to return',
                        schema: {
                            type: 'string',
                            example: 'firstName,lastName,username'
                        }
                    }
                ],
                responses: {
                    '200': {
                        description: 'Successful search',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        users: {
                                            type: 'array',
                                            items: {
                                                $ref: '#/components/schemas/UserSearchResult'
                                            }
                                        },
                                        meta: {
                                            type: 'object',
                                            properties: {
                                                query: { type: 'string' },
                                                count: { type: 'integer' }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    '400': {
                        $ref: '#/components/responses/BadRequest'
                    }
                }
            }
        },
        '/users/{id}': {
            get: {
                tags: ['Users'],
                summary: 'Get user by ID',
                description: 'Retrieve a single user by their external ID',
                operationId: 'getUser',
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'User external ID',
                        schema: {
                            type: 'integer',
                            minimum: 1
                        }
                    },
                    {
                        name: 'fields',
                        in: 'query',
                        description: 'Comma-separated list of fields to return',
                        schema: {
                            type: 'string',
                            example: 'firstName,lastName,email'
                        }
                    }
                ],
                responses: {
                    '200': {
                        description: 'User found',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/User'
                                }
                            }
                        }
                    },
                    '404': {
                        $ref: '#/components/responses/NotFound'
                    }
                }
            },
            patch: {
                tags: ['Users'],
                summary: 'Update user',
                description: 'Update user information. Only specified fields will be updated.',
                operationId: 'updateUser',
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'User external ID',
                        schema: {
                            type: 'integer'
                        }
                    }
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/UpdateUser'
                            }
                        }
                    }
                },
                responses: {
                    '200': {
                        description: 'User updated successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string' },
                                        user: {
                                            $ref: '#/components/schemas/User'
                                        }
                                    }
                                }
                            }
                        }
                    },
                    '400': {
                        $ref: '#/components/responses/BadRequest'
                    },
                    '404': {
                        $ref: '#/components/responses/NotFound'
                    }
                }
            },
            delete: {
                tags: ['Users'],
                summary: 'Delete user',
                description: 'Permanently delete a user',
                operationId: 'deleteUser',
                parameters: [
                    {
                        name: 'id',
                        in: 'path',
                        required: true,
                        description: 'User external ID',
                        schema: {
                            type: 'integer'
                        }
                    }
                ],
                responses: {
                    '200': {
                        description: 'User deleted successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        message: { type: 'string' },
                                        externalId: { type: 'integer' }
                                    }
                                }
                            }
                        }
                    },
                    '404': {
                        $ref: '#/components/responses/NotFound'
                    }
                }
            }
        },
        '/ingest/articles': {
            post: {
                tags: ['Ingest'],
                summary: 'Ingest article with processing',
                description: `Create a new article with full processing:
- Generate embeddings for title and teaser
- Chunk content into searchable segments
- Generate embeddings for each chunk
- Create full-text search vectors

This is a heavy operation and may take several seconds.`,
                operationId: 'ingestArticle',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/IngestArticle'
                            }
                        }
                    }
                },
                responses: {
                    '200': {
                        description: 'Article ingested successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        chunksCreated: { type: 'integer' }
                                    }
                                }
                            }
                        }
                    },
                    '409': {
                        description: 'Article already exists',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        error: { type: 'string' }
                                    }
                                }
                            }
                        }
                    },
                    '500': {
                        $ref: '#/components/responses/InternalError'
                    },
                    '502': {
                        description: 'Embedding service failed',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        error: { type: 'string' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/ingest/users': {
            post: {
                tags: ['Ingest'],
                summary: 'Ingest user',
                description: 'Create a new user with search index generation',
                operationId: 'ingestUser',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/IngestUser'
                            }
                        }
                    }
                },
                responses: {
                    '200': {
                        description: 'User ingested successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string' }
                                    }
                                }
                            }
                        }
                    },
                    '409': {
                        description: 'User already exists',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        error: { type: 'string' }
                                    }
                                }
                            }
                        }
                    },
                    '500': {
                        $ref: '#/components/responses/InternalError'
                    }
                }
            }
        }
    },
    components: {
        schemas: {
            Article: {
                type: 'object',
                properties: {
                    id: {
                        type: 'integer',
                        description: 'Internal database ID'
                    },
                    externalId: {
                        type: 'integer',
                        description: 'External system ID'
                    },
                    slug: {
                        type: 'string',
                        description: 'URL-friendly identifier'
                    },
                    title: {
                        type: 'string'
                    },
                    teaser: {
                        type: 'string',
                        description: 'Brief overview/excerpt'
                    },
                    content: {
                        type: 'string',
                        description: 'Full article content'
                    },
                    category: {
                        type: 'array',
                        items: {
                            type: 'string'
                        }
                    },
                    tags: {
                        type: 'array',
                        items: {
                            type: 'string'
                        }
                    },
                    publishedAt: {
                        type: 'string',
                        format: 'date-time'
                    },
                    createdAt: {
                        type: 'string',
                        format: 'date-time'
                    },
                    updatedAt: {
                        type: 'string',
                        format: 'date-time'
                    }
                }
            },
            ArticleSearchResult: {
                allOf: [
                    { $ref: '#/components/schemas/Article' },
                    {
                        type: 'object',
                        properties: {
                            score: {
                                type: 'number',
                                format: 'float',
                                description: 'Relevance score (0-1)'
                            }
                        }
                    }
                ]
            },
            UpdateArticle: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    teaser: { type: 'string' },
                    content: { type: 'string' },
                    category: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    tags: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    slug: { type: 'string' }
                }
            },
            IngestArticle: {
                type: 'object',
                required: ['post'],
                properties: {
                    post: {
                        type: 'object',
                        required: ['id', 'post_title', 'post_name', 'post_content', 'brief_overview', 'author_name', 'post_date'],
                        properties: {
                            id: {
                                oneOf: [
                                    { type: 'number' },
                                    { type: 'string' }
                                ]
                            },
                            post_title: { type: 'string' },
                            post_name: {
                                type: 'string',
                                description: 'URL slug'
                            },
                            post_content: { type: 'string' },
                            brief_overview: { type: 'string' },
                            author_name: { type: 'string' },
                            post_date: {
                                type: 'string',
                                format: 'date-time'
                            },
                            tag: {
                                oneOf: [
                                    {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string' }
                                        }
                                    },
                                    {
                                        type: 'array',
                                        items: {}
                                    }
                                ]
                            },
                            category: {
                                oneOf: [
                                    {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string' }
                                        }
                                    },
                                    {
                                        type: 'array',
                                        items: {}
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            User: {
                type: 'object',
                properties: {
                    id: {
                        type: 'integer',
                        description: 'Internal database ID'
                    },
                    externalId: {
                        type: 'integer',
                        description: 'External system ID'
                    },
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                    username: { type: 'string' },
                    email: {
                        type: 'string',
                        format: 'email'
                    },
                    createdAt: {
                        type: 'string',
                        format: 'date-time'
                    },
                    updatedAt: {
                        type: 'string',
                        format: 'date-time'
                    }
                }
            },
            UserSearchResult: {
                allOf: [
                    { $ref: '#/components/schemas/User' },
                    {
                        type: 'object',
                        properties: {
                            score: {
                                type: 'number',
                                format: 'float',
                                description: 'Relevance score'
                            }
                        }
                    }
                ]
            },
            UpdateUser: {
                type: 'object',
                properties: {
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                    username: { type: 'string' },
                    email: {
                        type: 'string',
                        format: 'email'
                    }
                }
            },
            IngestUser: {
                type: 'object',
                required: ['id', 'firstName', 'lastName', 'username', 'email'],
                properties: {
                    id: { type: 'integer' },
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                    username: { type: 'string' },
                    email: {
                        type: 'string',
                        format: 'email'
                    }
                }
            },
            Error: {
                type: 'object',
                properties: {
                    error: {
                        type: 'string',
                        description: 'Error message'
                    }
                }
            }
        },
        responses: {
            BadRequest: {
                description: 'Bad request',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/Error'
                        },
                        examples: {
                            missingQuery: {
                                value: {
                                    error: 'Search query is required'
                                }
                            },
                            noValidFields: {
                                value: {
                                    error: 'No valid fields to update'
                                }
                            }
                        }
                    }
                }
            },
            NotFound: {
                description: 'Resource not found',
                content: {
                    'application/json': {
                        schema: {
                            $ref: '#/components/schemas/Error'
                        },
                        examples: {
                            articleNotFound: {
                                value: {
                                    error: 'Article not found'
                                }
                            },
                            userNotFound: {
                                value: {
                                    error: 'User not found'
                                }
                            }
                        }
                    }
                }
            },
            InternalError: {
                description: 'Internal server error',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                success: { type: 'boolean' },
                                error: { type: 'string' }
                            }
                        }
                    }
                }
            }
        }
    }
}
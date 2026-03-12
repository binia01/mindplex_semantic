export class AppError extends Error {
    constructor(
        public statusCode: number,
        public message: string,
        public details?: any
    ) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class EmbeddingError extends AppError {
    constructor(message: string = 'Failed to generate embedding', details?: any) {
        super(500, message, details);
    }
}

export class NotFoundError extends AppError {
    constructor(message: string = 'Resource not found', details?: any) {
        super(404, message, details);
    }
}

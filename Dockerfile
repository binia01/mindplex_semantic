FROM oven/bun:1.3 AS base
WORKDIR /app
COPY package.json bun.lockb* ./

FROM base AS development
RUN bun install --frozen-lockfile
COPY . .
CMD ["bun", "run", "dev"]

FROM base AS production
ENV NODE_ENV=production

RUN bun install --frozen-lockfile --production
COPY . .
USER bun
CMD ["bun", "src/index.ts"]

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
COPY package.json pnpm-lock.yaml patches/ ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
COPY package.json pnpm-lock.yaml patches/ ./
RUN pnpm install --frozen-lockfile
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/shared ./shared
COPY --from=build /app/server ./server
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["pnpm", "start"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

FROM node:22-alpine AS migrate
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
COPY package.json pnpm-lock.yaml patches/ ./
RUN pnpm install --frozen-lockfile
COPY drizzle ./drizzle
COPY drizzle.config.ts ./drizzle.config.ts
COPY shared ./shared
COPY server ./server
CMD ["pnpm", "exec", "drizzle-kit", "migrate"]

FROM runtime AS final
# The runtime stage is the default application image.

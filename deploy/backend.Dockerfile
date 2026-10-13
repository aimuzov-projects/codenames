# Online rooms relay: Node runs TypeScript by itself, no build needed.
# Build context is the repo root: the relay protocol is shared with the game and lives in src/shared.

FROM node:26.11.1-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
# dependencies has only ws: Astro, Svelte and the linters live in devDependencies.
# Without --ignore-scripts npm ci would call prepare, and there's no husky in the image.
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error
COPY src/shared ./src/shared
COPY src/backend ./src/backend
USER node
EXPOSE 8787
CMD ["node", "src/backend/server.ts"]

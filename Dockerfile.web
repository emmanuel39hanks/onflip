# Flip landing — plain `next start` (serves public/ natively).
FROM node:22-slim
WORKDIR /app
RUN corepack enable
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ .
RUN ls -la public/logos || echo "!!! NO public/logos IN IMAGE !!!"
RUN pnpm build
ENV NODE_ENV=production
CMD ["sh", "-c", "node_modules/.bin/next start -H 0.0.0.0 -p ${PORT:-3020}"]

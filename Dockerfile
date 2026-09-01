FROM node:24-slim

WORKDIR /app

RUN npm install -g pnpm@10

COPY . .

RUN pnpm install --no-frozen-lockfile

RUN pnpm run typecheck:libs

RUN BASE_PATH=/dashboard/ VITE_API_BASE_URL="" pnpm --filter @workspace/dashboard run build

RUN pnpm --filter @workspace/api-server run build

EXPOSE 8080

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
# build: dashboard serving enabled

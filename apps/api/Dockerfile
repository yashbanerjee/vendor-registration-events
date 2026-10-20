FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @vmp/shared && npm run prisma:generate -w @vmp/api && npm run build -w @vmp/api
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]

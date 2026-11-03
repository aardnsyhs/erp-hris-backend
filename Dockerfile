FROM node:24-bookworm-slim AS build
ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --include=dev

COPY . .

# Prisma 7 needs DATABASE_URL to load prisma.config.ts.
# This placeholder is only used during client generation.
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" npx prisma generate

RUN npm run build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

# Preserve the Prisma Client generated in the build stage.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["npm", "run", "start:prod"]

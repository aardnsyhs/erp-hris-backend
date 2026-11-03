FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --include=dev

COPY . .

# Prisma 7 requires DATABASE_URL to load prisma.config.ts.
# This placeholder is used only during image build; no DB connection is made.
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public" npx prisma generate

RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start:prod"]

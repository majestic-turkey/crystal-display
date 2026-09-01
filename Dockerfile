FROM node:22-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
RUN npx playwright install --only-shell --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app/data
COPY --from=build /app/dist ./dist
COPY public ./public

EXPOSE 7000
CMD ["node", "dist/index.js"]

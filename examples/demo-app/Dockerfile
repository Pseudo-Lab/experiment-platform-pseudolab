# Dev stage (used by docker-compose.dev.yml; source is mounted at runtime)
FROM node:22-bookworm-slim AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install

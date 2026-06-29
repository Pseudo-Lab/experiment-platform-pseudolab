# Docker Multi-stage build for React (Vite)

# 1. Dev stage (used by docker-compose.dev.yml; source is mounted at runtime)
FROM node:22-bookworm-slim AS dev
WORKDIR /app
COPY package*.json ./
RUN npm config set registry https://registry.npmjs.org/ \
 && npm ci --retry 2

# 2. Build stage (used by production CI; context is repo root)
# Use the builder's native platform for the Vite build so multi-arch image
# publishes do not need to emulate Node.js just to produce static assets.
ARG BUILDPLATFORM
FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS build
WORKDIR /app

RUN npm config set registry https://registry.npmjs.org/

# 2-1. Build SDK first (frontend depends on @pseudo-lab/experibase-sdk via file:../packages/sdk)
COPY packages/sdk/package*.json ./packages/sdk/
RUN cd ./packages/sdk && npm ci --retry 2
COPY packages/sdk/ ./packages/sdk/
RUN cd ./packages/sdk && npm run build

# 2-2. Install and build frontend
COPY frontend/package*.json ./frontend/
RUN cd ./frontend && npm ci --retry 2
COPY frontend/ ./frontend/
RUN cd ./frontend && npm run build

# 2. Production stage (Nginx)
FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html

# Default nginx config for SPA (Single Page Application) routing
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

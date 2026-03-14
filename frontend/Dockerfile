# Docker Multi-stage build for React (Vite)
# 1. Build stage
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files and build
COPY . .
RUN npm run build

# 2. Production stage (Nginx)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

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

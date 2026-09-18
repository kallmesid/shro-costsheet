# Multi-stage build for Shro Cost Sheet Application
# Compatible with Docker and Podman (rootless & rootful)

# --- Stage 1: Build Frontend and Bundle Backend ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm install

# Copy source code
COPY . .

# Build Vite client and bundle server.ts to dist/server.cjs with esbuild
RUN npm run build

# --- Stage 2: Production Runtime ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install curl for container healthcheck
RUN apk add --no-cache curl

# Copy dependency manifests and install production-only dependencies
COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts

# Copy built production assets from builder
COPY --from=builder /app/dist ./dist

# Create storage directories for embedded DB and uploaded files
RUN mkdir -p /app/data /app/uploads && chmod -R 777 /app/data /app/uploads

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "dist/server.cjs"]

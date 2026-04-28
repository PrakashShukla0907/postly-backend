# ============================================
# Multi-stage build for optimized image
# ============================================

# Stage 1: Dependencies
FROM node:18-alpine AS dependencies
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --only=production

# Stage 2: Build
FROM node:18-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build 2>/dev/null || true

# Stage 3: Production
FROM node:18-alpine
RUN apk add --no-cache openssl

# Security: Run as non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /app

# Copy dependencies from stage 1
COPY --chown=nodejs:nodejs --from=dependencies /app/node_modules ./node_modules

# Copy application code
COPY --chown=nodejs:nodejs . .

# Create necessary directories
RUN mkdir -p /app/logs && chown nodejs:nodejs /app/logs

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
CMD ["npm", "start"]

# ============================================
# Build instructions
# ============================================
# Build:
#   docker build -t postly:latest .
#
# Run:
#   docker run -p 3000:3000 \
#     -e DATABASE_URL="postgresql://user:pass@db:5432/postly" \
#     -e REDIS_URL="redis://redis:6379" \
#     postly:latest
#
# Using docker-compose (recommended):
#   docker-compose up -d

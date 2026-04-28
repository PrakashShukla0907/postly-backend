# ============================================
# Single-stage production build for Railway
# ============================================
FROM node:18-alpine

# Install OpenSSL (required by Prisma on Alpine)
RUN apk add --no-cache openssl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files and prisma schema first
COPY package*.json ./
COPY prisma ./prisma

# Install production dependencies (runs postinstall → prisma generate as root)
RUN npm ci --omit=dev

# Copy the rest of the application
COPY --chown=nodejs:nodejs . .

# Fix ownership of generated prisma client
RUN chown -R nodejs:nodejs /app/node_modules /app/logs 2>/dev/null || \
    (mkdir -p /app/logs && chown -R nodejs:nodejs /app/node_modules /app/logs)

# Switch to non-root user
USER nodejs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["npm", "start"]

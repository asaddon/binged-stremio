# Stage 1: Build dependencies
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=optional
COPY . .

# Stage 2: Production image
FROM node:18-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --omit=optional
COPY --from=builder /app ./

EXPOSE 7000
CMD ["node", "index.js"]

# Optional healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
  CMD wget -qO- http://localhost:7000/ || exit 1

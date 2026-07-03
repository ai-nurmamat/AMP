FROM node:18-slim

WORKDIR /app

# Copy package files and install
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy source and build
COPY tsconfig.json tsconfig.mcp.json ./
COPY src/ ./src/
COPY mcp/ ./mcp/
RUN npm run build

# Copy any other needed files
COPY demo.js ./

EXPOSE 3000
CMD ["node", "dist/mcp/index.js"]

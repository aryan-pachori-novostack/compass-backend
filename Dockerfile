FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma Client and build
RUN ./node_modules/.bin/prisma generate && npm run build

# Create uploads and logs directories
RUN mkdir -p uploads logs

EXPOSE 3000

CMD ["node", "dist/index.js"]


FROM node:22-alpine
RUN apk add --no-cache openssl

EXPOSE 3000
WORKDIR /app

COPY package.json package-lock.json ./
COPY extensions ./extensions
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build && npm prune --omit=dev && npm cache clean --force

ENV NODE_ENV=production
# Applies database migrations, then starts the server.
CMD ["npm", "run", "docker-start"]

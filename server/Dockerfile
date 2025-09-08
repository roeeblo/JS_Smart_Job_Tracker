# server/Dockerfile
FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "index.js"]

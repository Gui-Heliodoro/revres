FROM node:22-alpine
WORKDIR /app/sse-server/code
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["node", "sse-server.js"]

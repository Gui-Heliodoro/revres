FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install -g npm@latest && \
    npm ci --production
COPY . .
EXPOSE 3001
CMD ["node", "see-server.js"]

FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./
RUN npm install

COPY server/src ./src
COPY db ./db

EXPOSE 3000

CMD ["npm", "start"]

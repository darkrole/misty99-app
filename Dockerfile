FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY server.js ./
COPY index.html ./
COPY register.html ./
COPY style.css ./

EXPOSE 8080

CMD ["node", "server.js"]

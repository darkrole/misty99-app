FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY backend ./backend
COPY frontend ./frontend
ENV NODE_ENV=production
EXPOSE 8080
CMD ["npm", "start"]

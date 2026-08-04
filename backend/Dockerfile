FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev
RUN node -e "require('multer'); require('busboy')"

COPY . .

RUN mkdir -p uploads/exams

EXPOSE 3001

CMD ["npm", "start"]

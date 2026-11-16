# Front da Fila do Síndico, só para desenvolvimento (usado pelo docker-compose.yml).
# Em produção o front é estático e vai para a Vercel, sem container.

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Front da Fila do Síndico.
# Alvos:
#   dev  → servidor do Vite com hot reload (usado pelo docker-compose.yml)
#   prod → arquivos estáticos servidos pelo nginx

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- desenvolvimento ----------
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ---------- build de produção ----------
FROM deps AS build
# As variáveis VITE_* são embutidas no JavaScript no momento do build.
# A anon key é pública por design; a segurança dos dados vem do RLS.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
COPY . .
RUN npm run build

# ---------- produção ----------
FROM nginx:stable-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80

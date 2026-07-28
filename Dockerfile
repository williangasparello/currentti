# ---------- Build do frontend (Vite) ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Em produção o front chama a API na MESMA origem (/api), servida pelo próprio Node.
ENV VITE_API_URL=/api
RUN npm run build

# ---------- Runtime (Node serve site + API) ----------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787
# Banco em volume persistente (fora da imagem)
ENV DB_PATH=/data/data.json
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
RUN mkdir -p /data
EXPOSE 8787
CMD ["node", "server/index.js"]

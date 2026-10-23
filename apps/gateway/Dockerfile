FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/gateway/package.json apps/gateway/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
RUN npm run build -w @passayge/web && npm run build -w @passayge/gateway

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production WEB_DIST=/app/web
COPY --from=build /src/apps/gateway/dist/server.mjs ./server.mjs
COPY --from=build /src/apps/web/dist ./web
USER node
EXPOSE 8080
CMD ["node", "server.mjs"]

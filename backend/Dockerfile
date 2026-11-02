FROM node:22.23.0-bookworm-slim AS ejecucion
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
WORKDIR /app
COPY backend/package*.json ./backend/
RUN npm --prefix backend ci --omit=dev && npm cache clean --force
COPY backend/src ./backend/src
COPY shared ./shared
COPY scripts/crear-admin.mjs ./scripts/crear-admin.mjs
USER node
EXPOSE 3001
CMD ["node", "backend/src/server.js"]

FROM ejecucion AS pruebas
COPY backend/test ./backend/test
COPY backend/scripts ./backend/scripts
COPY frontend/src/api.js ./frontend/src/api.js
COPY docs/openapi.json ./docs/openapi.json
COPY scripts/entorno.mjs ./scripts/entorno.mjs
CMD ["node", "--test", "backend/test/*.test.js"]

FROM ejecucion AS final

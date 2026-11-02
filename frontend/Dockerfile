FROM node:22.23.0-bookworm-slim AS compilacion
WORKDIR /app
COPY frontend/package*.json ./frontend/
RUN npm --prefix frontend ci
COPY frontend ./frontend
COPY shared ./shared
RUN npm --prefix frontend run build

FROM nginx:1.28.0-alpine AS ejecucion
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=compilacion /app/frontend/dist /usr/share/nginx/html
EXPOSE 80

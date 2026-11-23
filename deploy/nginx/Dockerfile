FROM node:22-alpine AS frontend

WORKDIR /src
COPY coar-alerta-frontend/package.json coar-alerta-frontend/package-lock.json ./
RUN npm ci --ignore-scripts
COPY coar-alerta-frontend/ ./
ARG VITE_API_URL=https://localhost/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:1.27-alpine

RUN apk add --no-cache openssl libcap

COPY deploy/nginx/docker.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx/snippets/ /etc/nginx/snippets/
COPY deploy/nginx/entrypoint.sh /docker-entrypoint.d/99-satre-certs.sh
COPY --from=frontend /src/dist /var/www/frontend

RUN chmod +x /docker-entrypoint.d/99-satre-certs.sh \
    && mkdir -p /var/www/backend/public /etc/nginx/certs /var/cache/nginx /run \
    && setcap cap_net_bind_service=+ep /usr/sbin/nginx \
    && sed -i 's/^user /# user /' /etc/nginx/nginx.conf \
    && chown -R nginx:nginx /var/www /etc/nginx /var/cache/nginx /run /docker-entrypoint.d

USER nginx

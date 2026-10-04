#!/bin/sh
set -eu

cd /var/www/backend

mkdir -p \
  storage/framework/cache/data \
  storage/framework/sessions \
  storage/framework/views \
  storage/logs \
  storage/app/public \
  bootstrap/cache

if [ ! -f vendor/autoload.php ]; then
  composer install --no-interaction --prefer-dist
fi

if [ "$(id -u)" = "0" ]; then
  chown -R www-data:www-data storage bootstrap/cache || true
fi

if [ "${AUTO_MIGRATE:-false}" = "true" ]; then
  php artisan migrate --force --no-interaction
fi

if [ "$(id -u)" = "0" ] && [ "${1:-}" != "php-fpm" ]; then
  exec runuser -u www-data -- "$@"
fi

exec "$@"

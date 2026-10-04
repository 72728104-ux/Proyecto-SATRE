FROM composer:2 AS composer

FROM php:8.2-fpm-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends git unzip libzip-dev libicu-dev \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql bcmath intl zip opcache pcntl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer /usr/bin/composer /usr/bin/composer

COPY deploy/php/php.ini /usr/local/etc/php/conf.d/satre.ini
COPY deploy/php/www.conf /usr/local/etc/php-fpm.d/zz-satre.conf
COPY deploy/php/entrypoint.sh /usr/local/bin/satre-entrypoint
RUN chmod +x /usr/local/bin/satre-entrypoint

WORKDIR /var/www/backend

COPY satre-backend/composer.json satre-backend/composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

COPY satre-backend ./
RUN composer dump-autoload --optimize --no-dev \
    && mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs storage/app/public bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache

ENTRYPOINT ["satre-entrypoint"]
CMD ["php-fpm", "-F"]

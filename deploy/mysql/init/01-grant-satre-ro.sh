#!/bin/bash
# SATRE §3.2 — usuario de solo lectura para Python. Se ejecuta una vez al crear el volumen MySQL.
set -euo pipefail

mysql -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL
CREATE USER IF NOT EXISTS 'satre_ro'@'%' IDENTIFIED BY '${SATRE_RO_PASSWORD}';
ALTER USER 'satre_ro'@'%' IDENTIFIED BY '${SATRE_RO_PASSWORD}';

GRANT SELECT ON \`${MYSQL_DATABASE}\`.attendances TO 'satre_ro'@'%';
GRANT SELECT ON \`${MYSQL_DATABASE}\`.grades TO 'satre_ro'@'%';
GRANT SELECT ON \`${MYSQL_DATABASE}\`.incidents TO 'satre_ro'@'%';
GRANT SELECT ON \`${MYSQL_DATABASE}\`.residential_presences TO 'satre_ro'@'%';
GRANT SELECT ON \`${MYSQL_DATABASE}\`.students TO 'satre_ro'@'%';
GRANT SELECT ON \`${MYSQL_DATABASE}\`.enrollments TO 'satre_ro'@'%';
GRANT SELECT ON \`${MYSQL_DATABASE}\`.courses TO 'satre_ro'@'%';
GRANT SELECT ON \`${MYSQL_DATABASE}\`.classrooms TO 'satre_ro'@'%';
GRANT SELECT ON \`${MYSQL_DATABASE}\`.academic_periods TO 'satre_ro'@'%';

FLUSH PRIVILEGES;
SQL

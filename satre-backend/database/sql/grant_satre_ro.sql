-- SATRE §3.2 — usuarios MySQL (ejecutar como administrador del servidor, no como root en la app).
-- Reemplazar las contraseñas por las de .env. Nunca usar root como usuario de Laravel ni de Python.

CREATE USER IF NOT EXISTS 'satre_app'@'%' IDENTIFIED BY 'CHANGE_ME_APP';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP
    ON satre_coar.* TO 'satre_app'@'%';

CREATE USER IF NOT EXISTS 'satre_ro'@'%' IDENTIFIED BY 'CHANGE_ME_RO';
GRANT SELECT ON satre_coar.attendances TO 'satre_ro'@'%';
GRANT SELECT ON satre_coar.grades TO 'satre_ro'@'%';
GRANT SELECT ON satre_coar.incidents TO 'satre_ro'@'%';
GRANT SELECT ON satre_coar.residential_presences TO 'satre_ro'@'%';
GRANT SELECT ON satre_coar.students TO 'satre_ro'@'%';
GRANT SELECT ON satre_coar.enrollments TO 'satre_ro'@'%';
GRANT SELECT ON satre_coar.courses TO 'satre_ro'@'%';
GRANT SELECT ON satre_coar.classrooms TO 'satre_ro'@'%';
GRANT SELECT ON satre_coar.academic_periods TO 'satre_ro'@'%';

FLUSH PRIVILEGES;

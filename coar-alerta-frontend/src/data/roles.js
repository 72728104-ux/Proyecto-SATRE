export const ROLES = {
  ADMIN: 'admin',
  TUTOR: 'tutor',
  RESIDENCIA: 'residencia',
  ESTUDIANTE: 'estudiante',
  APODERADO: 'apoderado',
}

export const ROLE_LABELS = {
  admin: 'Administrador COAR',
  tutor: 'Docente / Tutor',
  residencia: 'Monitor de Residencia',
  estudiante: 'Estudiante',
  apoderado: 'Apoderado',
}

export const ROLE_HOME = {
  admin: '/admin',
  tutor: '/tutor',
  residencia: '/residencia',
  estudiante: '/estudiante',
  apoderado: '/apoderado',
}

export const API_ROLE_TO_UI = {
  admin: ROLES.ADMIN,
  teacher: ROLES.TUTOR,
  monitor: ROLES.RESIDENCIA,
  student: ROLES.ESTUDIANTE,
  guardian: ROLES.APODERADO,
}

export const CHANGE_PASSWORD_PATH = '/cambiar-contrasena'
export const FORGOT_PASSWORD_PATH = '/recuperar-contrasena'
export const RESET_PASSWORD_PATH = '/reset-password'

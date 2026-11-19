import { describe, expect, it } from 'vitest'
import {
  API_ROLE_TO_UI,
  CHANGE_PASSWORD_PATH,
  FORGOT_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
  ROLES,
  ROLE_HOME,
  ROLE_LABELS,
} from './roles'

describe('roles', () => {
  it('define una etiqueta y una ruta de inicio para cada rol de UI', () => {
    Object.values(ROLES).forEach((role) => {
      expect(ROLE_LABELS[role]).toBeTruthy()
      expect(ROLE_HOME[role]).toMatch(/^\//)
    })
  })

  it('traduce los roles de la API a roles de la UI', () => {
    expect(API_ROLE_TO_UI).toEqual({
      admin: ROLES.ADMIN,
      teacher: ROLES.TUTOR,
      monitor: ROLES.RESIDENCIA,
      student: ROLES.ESTUDIANTE,
      guardian: ROLES.APODERADO,
    })
  })

  it('expone las rutas de gestión de contraseña', () => {
    expect(CHANGE_PASSWORD_PATH).toBe('/cambiar-contrasena')
    expect(FORGOT_PASSWORD_PATH).toBe('/recuperar-contrasena')
    expect(RESET_PASSWORD_PATH).toBe('/reset-password')
  })
})

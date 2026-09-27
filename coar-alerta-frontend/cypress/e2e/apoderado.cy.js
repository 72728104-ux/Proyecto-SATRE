const user = {
  id: 11,
  name: 'Héctor Chávez',
  email: 'apoderado@coar.edu.pe',
  role: { slug: 'guardian', name: 'Apoderado' },
  must_change_password: false,
  students: [{ id: 3, student_code: 'EST-0003', name: 'Valeria Chávez', classroom: '5to A' }],
}

const summary = {
  data: {
    student: { id: 3, student_code: 'EST-0003', name: 'Valeria Chávez', classroom: '5to A' },
    academic_period: { id: 1, name: '2026-I' },
    courses: [{ id: 5, code: 'MAT-AA', name: 'Matemáticas AA' }],
    grades: {
      average: 5.2,
      scale: { min: 1, max: 7, passing: 4 },
      failing_courses: 0,
      by_course: [{ course_id: 5, course_name: 'Matemáticas AA', average: 5.2, passing: true, count: 2, criteria: { A: 6, B: 4, C: null, D: null } }],
    },
    attendance: { total: 10, by_status: { present: 8, late: 1, absent_unjustified: 1 }, rate: 0.9 },
    residence: { total: 4, by_status: { present: 3, absent: 1 }, rate: 0.75 },
    alerts: { open: 0, items: [] },
  },
}

const page = (data) => ({ data, meta: { current_page: 1, last_page: 1, total: data.length, from: 1, to: data.length, per_page: 15 } })

function loginAsGuardian() {
  cy.intercept('GET', '**/api/health', { status: 'ok' })
  cy.intercept('POST', '**/api/auth/login', { token: 'test-token', expires_at: null, user, must_change_password: false })
  cy.intercept('GET', '**/api/auth/me', { user })
  cy.intercept('GET', '**/api/me/summary*', summary).as('summary')
  cy.visit('/login')
  cy.get('[data-cy="email"]').clear().type(user.email)
  cy.get('[data-cy="password"]').clear().type('secreto-demo')
  cy.get('[data-cy="submit-login"]').click()
  cy.wait('@summary')
}

describe('Rol Apoderado', () => {
  it('muestra el resumen con promedio IB y asistencia de aula y residencia', () => {
    cy.viewport('iphone-se2')
    loginAsGuardian()
    cy.url().should('match', /\/apoderado$/)
    cy.get('[data-cy="dashboard-apoderado"]').should('be.visible')
    cy.contains('Valeria Chávez').should('be.visible')
    cy.contains('5.2').should('be.visible')
    cy.contains('90%').should('be.visible')
    cy.contains('75%').should('be.visible')
    cy.contains('Asistencias e inasistencias en aula').should('be.visible')
    cy.contains('Asistencias e inasistencias en residencia').should('be.visible')
  })

  it('autoriza un permiso pendiente y muestra error 422 por campo', () => {
    const pending = {
      id: 8,
      student_id: 3,
      student_name: 'Valeria Chávez',
      type: 'salida',
      reason: 'Cita médica en Huancayo',
      starts_at: '2026-04-18T08:00:00Z',
      ends_at: '2026-04-18T18:00:00Z',
      status: 'pending_guardian',
    }
    cy.intercept('GET', '**/api/permissions*', page([pending])).as('permissions')
    cy.intercept('PATCH', '**/api/permissions/8/guardian', {
      statusCode: 422,
      body: { message: 'Revisa los datos.', errors: { status: ['La solicitud no puede cambiar desde el estado pending_guardian.'] } },
    }).as('respond')
    loginAsGuardian()
    cy.visit('/apoderado/permisos')
    cy.wait('@permissions')
    cy.contains('Cita médica en Huancayo').should('be.visible')
    cy.get('[data-cy="autorizar-permiso"]').click()
    cy.get('[data-cy="confirm-accept"]').click()
    cy.wait('@respond')
    cy.contains('La solicitud no puede cambiar desde el estado pending_guardian.').should('be.visible')
  })

  it('lista incidencias de convivencia sin detalle confidencial', () => {
    cy.intercept('GET', '**/api/incidents*', page([
      { id: 4, student_id: 3, student_name: 'Valeria Chávez', incident_at: '2026-04-15T21:30:00Z', category: 'convivencia', severity: 'leve', status: 'open' },
    ])).as('incidents')
    loginAsGuardian()
    cy.visit('/apoderado/incidencias')
    cy.wait('@incidents')
    cy.contains('h1', 'Reporte de incidencias').should('be.visible')
    cy.contains('td', 'Valeria Chávez').should('be.visible')
    cy.contains('td', 'Convivencia').should('be.visible')
    cy.contains('Detalle confidencial').should('not.exist')
  })
})

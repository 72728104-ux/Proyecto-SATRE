const user = { id: 9, name: 'Lucía Quispe', email: 'estudiante@coar.edu.pe', role: { slug: 'student', name: 'Estudiante' }, must_change_password: false }

const summary = {
  data: {
    student: { id: 3, student_code: 'EST-0003', name: 'Lucía Quispe', classroom: '5to A' },
    academic_period: { id: 1, name: '2026-I' },
    courses: [{ id: 5, code: 'MAT-AA', name: 'Matemáticas AA' }],
    grades: {
      average: 4.5,
      scale: { min: 1, max: 7, passing: 4 },
      failing_courses: 0,
      by_course: [{ course_id: 5, course_name: 'Matemáticas AA', average: 4.5, passing: true, count: 2, criteria: { A: 6, B: 3, C: null, D: null } }],
    },
    attendance: { total: 10, by_status: { present: 9, absent: 1 }, rate: 0.9 },
    alerts: { open: 1, items: [{ id: 1, type: 'risk', severity: 'MEDIO', title: 'Riesgo medio', status: 'open', created_at: '2026-04-15T10:00:00Z' }] },
  },
}

const page = (data) => ({ data, meta: { current_page: 1, last_page: 1, total: data.length, from: 1, to: data.length, per_page: 15 } })

function loginAsStudent() {
  cy.intercept('GET', '**/api/health', { status: 'ok' })
  cy.intercept('POST', '**/api/auth/login', { token: 'test-token', expires_at: null, user, must_change_password: false })
  cy.intercept('GET', '**/api/auth/me', { user })
  cy.intercept('GET', '**/api/me/summary', summary).as('summary')
  cy.visit('/login')
  cy.get('[data-cy="email"]').clear().type(user.email)
  cy.get('[data-cy="password"]').clear().type('secreto-demo')
  cy.get('[data-cy="submit-login"]').click()
  cy.wait('@summary')
}

describe('Rol Estudiante', () => {
  it('muestra el resumen con promedio, asistencia y alertas en móvil', () => {
    cy.viewport('iphone-se2')
    loginAsStudent()
    cy.url().should('match', /\/estudiante$/)
    cy.contains('Mi resumen').should('be.visible')
    cy.contains('4.5').should('be.visible')
    cy.contains('90%').should('be.visible')
    cy.contains('Riesgo medio').should('be.visible')
  })

  it('lista calificaciones con desglose por criterio', () => {
    cy.intercept('GET', '**/api/grades*', page([
      { id: 1, evaluation_name: 'Prueba 1', course_name: 'Matemáticas AA', criterion: 'A', evaluation_date: '2026-04-10', score: 6, max_score: 7 },
    ])).as('grades')
    loginAsStudent()
    cy.visit('/estudiante/calificaciones')
    cy.wait('@grades')
    cy.contains('Crit. B').next().should('contain', '3.0')
    cy.contains('Prueba 1').should('be.visible')
  })

  it('crea un permiso y muestra errores 422 por campo', () => {
    cy.intercept('GET', '**/api/permissions*', page([])).as('permissions')
    cy.intercept('POST', '**/api/permissions', {
      statusCode: 422,
      body: { message: 'Revisa los datos.', errors: { ends_at: ['El retorno debe ser posterior a la salida.'] } },
    }).as('create')
    loginAsStudent()
    cy.visit('/estudiante/permisos')
    cy.wait('@permissions')
    cy.contains('No tienes solicitudes de permiso.').should('be.visible')
    cy.contains('button', 'Nueva solicitud').click()
    cy.get('textarea[name="reason"]').type('Cita médica')
    cy.get('input[name="starts_at"]').type('2026-04-18T08:00')
    cy.get('input[name="ends_at"]').type('2026-04-18T07:00')
    cy.contains('button', 'Enviar solicitud').click()
    cy.wait('@create')
    cy.contains('El retorno debe ser posterior a la salida.').should('be.visible')
  })

  it('conversa con el tutor socrático eligiendo opciones', () => {
    cy.intercept('GET', '**/api/ai-analytics/student/socratic-tutor/sessions*', page([]))
    cy.intercept('POST', '**/api/ai-analytics/student/socratic-tutor', {
      available: true,
      data: {
        session: { id: 7, course_id: 5, course_name: 'Matemáticas AA', topic: 'Funciones lineales', criterion: 'A', status: 'active', step: 'diagnostico', hint_level: 0 },
        reply: { type: 'question', text: '¿Qué gráfica tiene f(x) = 2x + 1?', options: [{ id: 'a', text: 'Una recta' }, { id: 'b', text: 'Una parábola' }] },
        done: false,
      },
    }).as('turn')
    loginAsStudent()
    cy.visit('/estudiante/tutor')
    cy.get('select[name="course_id"]').select('Matemáticas AA')
    cy.get('input[name="topic"]').type('Funciones lineales')
    cy.contains('button', 'Comenzar sesión').click()
    cy.wait('@turn').its('request.body').should('deep.equal', { course_id: 5, topic: 'Funciones lineales' })
    cy.contains('¿Qué gráfica tiene f(x) = 2x + 1?').should('be.visible')
    cy.contains('button', 'Una recta').click()
    cy.wait('@turn').its('request.body').should('deep.equal', { session_id: 7, option_id: 'a' })
  })
})

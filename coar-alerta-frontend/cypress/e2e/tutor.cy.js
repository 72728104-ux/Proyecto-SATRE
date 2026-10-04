const user = {
  id: 2,
  name: 'Luis Mendoza Aliaga',
  email: 'tutor@coar.edu.pe',
  role: { slug: 'teacher', name: 'Docente' },
  must_change_password: false,
}

const courses = {
  data: [
    {
      id: 5,
      code: 'MAT-AA',
      name: 'Matemáticas AA',
      classroom: { id: 1, name: '5to A', grade_level: '5to' },
    },
  ],
}

const session = {
  data: {
    course_id: 5,
    course_name: 'Matemáticas AA',
    classroom: { id: 1, name: '5to A' },
    attendance_date: '2026-10-02',
    students: [
      {
        student_id: 3,
        student_code: 'EST-0003',
        first_name: 'Valeria',
        last_name: 'Chávez Poma',
        status: null,
        notes: null,
      },
    ],
  },
}

const risk = {
  available: true,
  data: {
    student_id: 3,
    risk_level: 'ALTO',
    risk_score: 72.4,
    data_coverage: 0.9,
    insufficient_data: false,
    needs_human_review: true,
    recommendation: 'Entrevista inmediata: inasistencias y promedio bajo 4.',
    factors: [
      { key: 'unexcused_absence', label: 'Inasistencias injustificadas', value: 0.22, contribution: 25.0 },
      { key: 'grade_level', label: 'Promedio IB', value: 3.2, contribution: 18.5 },
    ],
  },
}

const page = (data) => ({
  data,
  meta: { current_page: 1, last_page: 1, total: data.length, from: data.length ? 1 : 0, to: data.length, per_page: 15 },
})

function teacherApi() {
  cy.intercept('GET', '**/api/health', { status: 'ok' })
  cy.intercept('POST', '**/api/auth/login', { token: 'test-token', expires_at: null, user, must_change_password: false })
  cy.intercept('GET', '**/api/auth/me', { user })
  cy.intercept('GET', '**/api/courses', courses).as('courses')
  cy.intercept('GET', '**/api/attendances/session*', session).as('session')
  cy.intercept('GET', '**/api/ai-analytics/students/*/risk*', risk).as('risk')
  cy.intercept('GET', '**/api/reports/classrooms/*/export*', {
    statusCode: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': 'attachment; filename="reporte-aula-1.pdf"',
    },
    body: '%PDF-1.4',
  }).as('exportReport')
}

function loginAsTeacher() {
  teacherApi()
  cy.visit('/login')
  cy.get('[data-cy="email"]').clear().type(user.email)
  cy.get('[data-cy="password"]').clear().type('coar2026')
  cy.get('[data-cy="submit-login"]').click()
  cy.wait('@courses')
  cy.wait('@session')
}

describe('Rol Docente', () => {
  it('muestra el dashboard de riesgo del aula con factores explicados', () => {
    cy.viewport('iphone-se2')
    loginAsTeacher()
    cy.wait('@risk')
    cy.url().should('match', /\/tutor$/)
    cy.get('[data-cy="dashboard-tutor"]').should('be.visible')
    cy.contains('Riesgo del aula').should('be.visible')
    cy.get('[data-cy="risk-card"]').should('contain', 'Chávez Poma, Valeria')
    cy.contains('Inasistencias injustificadas').should('be.visible')
    cy.contains('Requiere revisión humana prioritaria.').should('be.visible')
    cy.get('[data-cy="download-report"]').should('be.visible').click()
    cy.wait('@exportReport')
  })

  it('registra asistencia masiva con estados IB', () => {
    teacherApi()
    cy.intercept('POST', '**/api/attendances/session', {
      message: 'Asistencia registrada.',
      data: [{ id: 11, student_id: 3, status: 'absent_unjustified' }],
    }).as('saveSession')
    loginAsTeacher()
    cy.visit('/tutor/asistencia')
    cy.wait('@session')
    cy.get('[data-cy="attendance-form"]').should('be.visible')
    cy.contains('Chávez Poma, Valeria').should('be.visible')
    cy.contains('button', 'Falta injustificada').click()
    cy.get('[data-cy="save-attendance"]').click()
    cy.wait('@saveSession').its('request.body').should('deep.include', {
      course_id: 5,
      records: [{ student_id: 3, status: 'absent_unjustified', notes: null }],
    })
    cy.get('[data-cy="toast-success"]').should('be.visible')
  })

  it('lista notas IB 1–7 y valida el criterio A–D al registrar', () => {
    teacherApi()
    cy.intercept('GET', '**/api/grades*', page([
      {
        id: 1,
        student_id: 3,
        student_name: 'Valeria Chávez Poma',
        course_id: 5,
        course_name: 'Matemáticas AA',
        evaluation_name: 'Prueba 1',
        criterion: 'A',
        evaluation_date: '2026-04-10',
        score: 3,
        max_score: 7,
      },
    ])).as('grades')
    loginAsTeacher()
    cy.visit('/tutor/notas')
    cy.wait('@grades')
    cy.get('[data-cy="notas-ib"]').should('be.visible')
    cy.contains('Prueba 1').should('be.visible')
    cy.contains('3 / 7').should('be.visible')
    cy.contains('button', 'Registrar nota').click()
    cy.contains('button', 'Guardar').click()
    cy.contains('Selecciona un estudiante.').should('be.visible')
    cy.contains('Elige un criterio IB (A–D).').should('be.visible')
  })

  it('atiende una alerta abierta y registra intervención', () => {
    teacherApi()
    cy.intercept('GET', '**/api/alerts*', page([
      {
        id: 9,
        student_id: 3,
        student: { id: 3, name: 'Valeria Chávez Poma' },
        severity: 'ALTO',
        title: 'Riesgo académico alto',
        message: 'Promedio IB bajo 4 e inasistencias injustificadas.',
        status: 'open',
        created_at: '2026-04-15T10:00:00Z',
        interventions: [],
      },
    ])).as('alerts')
    cy.intercept('PATCH', '**/api/alerts/9', {
      id: 9,
      status: 'acknowledged',
      title: 'Riesgo académico alto',
      student: { id: 3, name: 'Valeria Chávez Poma' },
    }).as('ack')
    loginAsTeacher()
    cy.visit('/tutor/alertas')
    cy.wait('@alerts')
    cy.get('[data-cy="alertas-tutor"]').should('be.visible')
    cy.get('[data-cy="alert-card"]').should('contain', 'Riesgo académico alto')
    cy.contains('button', 'Marcar en atención').click()
    cy.wait('@ack').its('request.body').should('deep.equal', { status: 'acknowledged' })
  })
})

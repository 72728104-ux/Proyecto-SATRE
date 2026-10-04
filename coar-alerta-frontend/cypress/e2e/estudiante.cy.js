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
    attendance: { total: 10, by_status: { present: 9, absent_unjustified: 1 }, rate: 0.9 },
    alerts: { open: 1, items: [] },
  },
}

const risk = {
  available: true,
  data: { student_id: 3, risk_level: 'MEDIO', recommendation: 'Monitoreo preventivo: refuerza asistencia y criterio B.', predicted_at: '2026-04-15T10:00:00Z' },
}

const page = (data) => ({ data, meta: { current_page: 1, last_page: 1, total: data.length, from: data.length ? 1 : 0, to: data.length, per_page: 15 } })

function loginAsStudent() {
  cy.intercept('GET', '**/api/health', { status: 'ok' })
  cy.intercept('POST', '**/api/auth/login', { token: 'test-token', expires_at: null, user, must_change_password: false })
  cy.intercept('GET', '**/api/auth/me', { user })
  cy.intercept('GET', '**/api/me/summary*', summary).as('summary')
  cy.intercept('GET', '**/api/ai-analytics/students/*/risk*', risk).as('risk')
  cy.intercept(
    'GET',
    '**/api/alerts*',
    page([{ id: 1, student_id: 3, severity: 'MEDIO', message: 'Intervención preventiva de asistencia.', status: 'open', created_at: '2026-04-15T10:00:00Z' }]),
  ).as('alerts')
  cy.visit('/login')
  cy.get('[data-cy="email"]').clear().type(user.email)
  cy.get('[data-cy="password"]').clear().type('coar2026')
  cy.get('[data-cy="submit-login"]').click()
  cy.wait('@summary')
}

describe('Rol Estudiante', () => {
  it('muestra el resumen con promedio, asistencia, riesgo y historial de alertas en móvil', () => {
    cy.viewport('iphone-se2')
    loginAsStudent()
    cy.wait('@alerts')
    cy.wait('@risk')
    cy.url().should('match', /\/estudiante$/)
    cy.get('[data-cy="dashboard-estudiante"]').should('be.visible')
    cy.contains('4.5').should('be.visible')
    cy.contains('90%').should('be.visible')
    cy.get('[data-cy="mi-riesgo"]').should('contain', 'Monitoreo preventivo')
    cy.get('[data-cy="mi-riesgo"]').should('contain', 'Medio')
    cy.contains('Intervención preventiva de asistencia.').should('be.visible')
  })

  it('lista calificaciones con desglose por criterio', () => {
    cy.intercept('GET', '**/api/grades*', page([
      { id: 1, evaluation_name: 'Prueba 1', course_name: 'Matemáticas AA', criterion: 'A', evaluation_date: '2026-04-10', score: 6, max_score: 7 },
    ])).as('grades')
    loginAsStudent()
    cy.visit('/estudiante/calificaciones')
    cy.wait('@grades')
    cy.get('[data-cy="calificaciones-estudiante"]').should('be.visible')
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
    cy.get('[data-cy="permisos-estudiante"]').should('be.visible')
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
        session: { id: 7, course_id: 5, course_name: 'Matemáticas AA', topic: 'Funciones lineales', criterion: 'A', status: 'active', step: 'diagnostico', create_phase: 'conectar', hint_level: 0 },
        reply: {
          type: 'question',
          text: '¿Qué gráfica tiene f(x) = 2x + 1?',
          create_phase: 'conectar',
          explanation: '¿Qué gráfica tiene f(x) = 2x + 1?',
          reflection: 'Elige la opción y explica por qué.',
          quiz: { question: '¿Qué gráfica tiene f(x) = 2x + 1?', options: [{ id: 'a', text: 'Una recta' }, { id: 'b', text: 'Una parábola' }] },
          diagram_mermaid: 'flowchart TD\n    X[x] --> Y[2x + 1]',
          options: [{ id: 'a', text: 'Una recta' }, { id: 'b', text: 'Una parábola' }],
        },
        done: false,
      },
    }).as('turn')
    loginAsStudent()
    cy.visit('/estudiante/tutor')
    cy.get('[data-cy="ia-tutor"]').should('be.visible')
    cy.get('select[name="course_id"]').select('Matemáticas AA')
    cy.get('input[name="topic"]').type('Funciones lineales')
    cy.contains('button', 'Comenzar sesión').click()
    cy.wait('@turn').its('request.body').should('deep.equal', { course_id: 5, topic: 'Funciones lineales' })
    cy.contains('¿Qué gráfica tiene f(x) = 2x + 1?').should('be.visible')
    cy.get('[data-cy="create-phase-badge"]').should('contain', 'Conexión')
    cy.get('[data-cy="tutor-quiz"]').should('be.visible')
    cy.get('[data-cy="tutor-intents"]').should('contain', 'Pedir pista')
    cy.contains('button', 'Una recta').click()
    cy.wait('@turn').its('request.body').should('deep.equal', { session_id: 7, option_id: 'a' })
  })

  it('pide un diagrama CREATE con el mensaje de intención', () => {
    cy.intercept('GET', '**/api/ai-analytics/student/socratic-tutor/sessions*', page([]))
    cy.intercept('POST', '**/api/ai-analytics/student/socratic-tutor', {
      available: true,
      data: {
        session: { id: 7, course_id: 5, course_name: 'Matemáticas AA', topic: 'Funciones lineales', criterion: 'A', status: 'active', step: 'pista', create_phase: 'explicar', hint_level: 1 },
        reply: {
          type: 'hint',
          text: 'Observa cómo se relacionan Δy y Δx.',
          create_phase: 'explicar',
          explanation: 'Observa cómo se relacionan Δy y Δx.',
          reflection: '¿Qué se divide entre qué?',
          diagram_mermaid: 'flowchart TD\n    A[Δy] --> M[pendiente]\n    B[Δx] --> M',
          options: [],
        },
        done: false,
      },
    }).as('turn')
    loginAsStudent()
    cy.visit('/estudiante/tutor')
    cy.get('select[name="course_id"]').select('Matemáticas AA')
    cy.get('input[name="topic"]').type('Funciones lineales')
    cy.contains('button', 'Comenzar sesión').click()
    cy.wait('@turn')
    cy.get('[data-cy="create-phase-badge"]').should('contain', 'Explicación')
    cy.contains('button', 'Ver diagrama').click()
    cy.wait('@turn').its('request.body').should('deep.equal', {
      session_id: 7,
      message: '[DIAGRAM_MERMAID] Muéstrame un diagrama del concepto',
    })
  })

  it('muestra aviso si el motor del tutor no está disponible', () => {
    cy.intercept('GET', '**/api/ai-analytics/student/socratic-tutor/sessions*', page([]))
    cy.intercept('POST', '**/api/ai-analytics/student/socratic-tutor', { available: false, data: null }).as('turn')
    loginAsStudent()
    cy.visit('/estudiante/tutor')
    cy.get('select[name="course_id"]').select('Matemáticas AA')
    cy.get('input[name="topic"]').type('Funciones lineales')
    cy.contains('button', 'Comenzar sesión').click()
    cy.wait('@turn')
    cy.get('[data-cy="toast-warning"]').should('contain', 'El tutor no está disponible')
  })

  it('tras el quiz ofrece profundizar con el tutor pre-cargando tema y criterio IB', () => {
    const reading = {
      id: 1,
      course_id: 5,
      course_name: 'Matemáticas AA',
      title: 'Fotosíntesis',
      criterion: 'B',
      content: 'Texto del artículo sobre fotosíntesis.',
      url: null,
    }
    cy.intercept('GET', '**/api/readings*', page([reading])).as('readings')
    cy.intercept('GET', '**/api/readings/*/questions*', page([
      { id: 10, prompt: '¿Cuál es la hipótesis?', type: 'multiple_choice', options: ['A', 'B'], my_response: null },
    ])).as('questions')
    cy.intercept('GET', '**/api/readings/*/artifacts*', page([]))
    cy.intercept('GET', '**/api/readings/*/quiz*', page([])).as('quizAttempts')
    cy.intercept('POST', '**/api/readings/*/quiz', {
      data: {
        id: 3,
        reading_material_id: 1,
        score: 100,
        total_questions: 1,
        correct_count: 1,
        completed_at: '2026-04-15T10:00:00Z',
        results: [{ guided_question_id: 10, is_correct: true, feedback: 'Correcto.' }],
      },
    }).as('quiz')
    cy.intercept('GET', '**/api/ai-analytics/student/socratic-tutor/sessions*', page([]))
    cy.intercept('POST', '**/api/ai-analytics/student/socratic-tutor', {
      available: true,
      data: {
        session: { id: 8, course_id: 5, course_name: 'Matemáticas AA', topic: 'Fotosíntesis', criterion: 'B', status: 'active', step: 'diagnostico', create_phase: 'conectar', hint_level: 0 },
        reply: { type: 'question', text: '¿Qué pregunta de investigación propondrías a partir de lo leído?', create_phase: 'conectar', options: [] },
        done: false,
      },
    }).as('turn')

    loginAsStudent()
    cy.visit('/estudiante/lecturas')
    cy.wait('@readings')
    cy.get('[data-cy="lecturas-estudiante"]').should('be.visible')
    cy.contains('button', 'Abrir').click()
    cy.get('[data-cy="lectura-detalle"]').should('be.visible')
    cy.wait('@questions')
    cy.contains('button', '4. Quiz').click()
    cy.get('[data-cy="quiz-lectura"]').should('be.visible')
    cy.contains('label', 'A').click()
    cy.contains('button', 'Enviar quiz').click()
    cy.wait('@quiz')
    cy.get('[data-cy="paso-5-tutor"]').should('contain', 'Profundizar con IA Tutor')
    cy.get('[data-cy="profundizar-ia-tutor"]').click()
    cy.wait('@turn').its('request.body').should('deep.equal', { course_id: 5, topic: 'Fotosíntesis', criterion: 'B' })
    cy.get('[data-cy="ia-tutor"]').should('be.visible')
    cy.contains('¿Qué pregunta de investigación propondrías a partir de lo leído?').should('be.visible')
    cy.contains('Criterio B').should('be.visible')
  })
})

const user = {
  id: 4,
  name: 'Carla Palomino Rojas',
  email: 'residencia@coar.edu.pe',
  role: { slug: 'monitor', name: 'Monitor de Residencia' },
  must_change_password: false,
}

const page = (data) => ({
  data,
  meta: { current_page: 1, last_page: 1, total: data.length, from: data.length ? 1 : 0, to: data.length, per_page: 15 },
})

const residents = page([
  {
    id: 3,
    student_code: 'EST-0003',
    first_name: 'Valeria',
    last_name: 'Chávez Poma',
    name: 'Valeria Chávez Poma',
    classroom: { id: 1, name: '5to A' },
    presence: null,
  },
])

function monitorApi() {
  cy.intercept('GET', '**/api/health', { status: 'ok' })
  cy.intercept('POST', '**/api/auth/login', { token: 'test-token', expires_at: null, user, must_change_password: false })
  cy.intercept('GET', '**/api/auth/me', { user })
  cy.intercept('GET', '**/api/residents*', residents).as('residents')
  cy.intercept('GET', '**/api/presences*', page([])).as('presences')
  cy.intercept('GET', '**/api/incidents*', page([])).as('incidents')
  cy.intercept('GET', '**/api/permissions*', page([])).as('permissions')
  cy.intercept('GET', '**/api/alerts*', page([])).as('alerts')
}

function loginAsMonitor() {
  monitorApi()
  cy.visit('/login')
  cy.get('[data-cy="email"]').clear().type(user.email)
  cy.get('[data-cy="password"]').clear().type('coar2026')
  cy.get('[data-cy="submit-login"]').click()
  cy.url().should('match', /\/residencia/)
}

describe('Rol Monitor', () => {
  it('registra el checklist nocturno masivo en móvil', () => {
    cy.viewport('iphone-se2')
    cy.intercept('POST', '**/api/presences/bulk', {
      message: 'Presencias registradas.',
      data: [{ id: 21, student_id: 3, status: 'absent' }],
    }).as('saveBulk')
    loginAsMonitor()
    cy.visit('/residencia/presencia')
    cy.get('[data-cy="presencia-nocturna"]').should('be.visible')
    cy.contains('Chávez Poma, Valeria').should('be.visible')
    cy.get('[data-cy="presence-row"]').should('have.length', 1)
    cy.get('[data-cy="presence-status-absent"]').click()
    cy.get('[data-cy="save-presences"]').click()
    cy.wait('@saveBulk').its('request.body').should((body) => {
      expect(body.check_type).to.eq('night')
      expect(body.records).to.deep.equal([{ student_id: 3, status: 'absent', notes: null }])
    })
    cy.get('[data-cy="toast-success"]').should('be.visible')
  })

  it('registra una incidencia de conducta y la resuelve', () => {
    const open = {
      id: 7,
      student_id: 3,
      student_name: 'Valeria Chávez Poma',
      incident_at: '2026-04-15T21:30:00Z',
      category: 'conducta',
      severity: 'leve',
      description: 'Salida del pabellón sin aviso.',
      status: 'open',
    }
    loginAsMonitor()
    cy.intercept('GET', '**/api/incidents*', page([open])).as('incidents')
    cy.intercept('POST', '**/api/incidents', { ...open, id: 8 }).as('createIncident')
    cy.intercept('PUT', '**/api/incidents/7', { ...open, status: 'resolved' }).as('resolveIncident')
    cy.visit('/residencia/incidencias')
    cy.wait('@incidents')
    cy.get('[data-cy="incidencias"]').should('be.visible')
    cy.contains('Salida del pabellón sin aviso.').should('be.visible')

    cy.get('[data-cy="nueva-incidencia"]').click()
    cy.get('select[name="student_id"]').find('option[value="3"]').should('exist')
    cy.get('select[name="student_id"]').select('3')
    cy.get('select[name="category"]').select('conducta')
    cy.get('select[name="severity"]').select('leve')
    cy.get('textarea[name="description"]').type('Discusión breve en el pabellón.')
    cy.contains('button', 'Registrar').click()
    cy.wait('@createIncident').its('request.body').should((body) => {
      expect(body.student_id).to.eq(3)
      expect(body.category).to.eq('conducta')
      expect(body.severity).to.eq('leve')
      expect(body.description).to.eq('Discusión breve en el pabellón.')
    })

    cy.get('[data-cy="resolver-incidencia"]').click()
    cy.get('[data-cy="confirm-accept"]').click()
    cy.wait('@resolveIncident').its('request.body').should('deep.equal', { status: 'resolved' })
  })

  it('aprueba un permiso ya autorizado por el apoderado', () => {
    const pending = {
      id: 9,
      student_id: 3,
      student_name: 'Valeria Chávez Poma',
      type: 'salida',
      reason: 'Cita médica en Huancayo',
      starts_at: '2026-04-18T08:00:00Z',
      ends_at: '2026-04-18T18:00:00Z',
      status: 'approved_guardian',
    }
    loginAsMonitor()
    cy.intercept('GET', '**/api/permissions*', page([pending])).as('permissions')
    cy.intercept('PATCH', '**/api/permissions/9/resolve', { ...pending, status: 'approved' }).as('resolve')
    cy.visit('/residencia/permisos')
    cy.wait('@permissions')
    cy.get('[data-cy="permisos-residencia"]').should('be.visible')
    cy.contains('Cita médica en Huancayo').should('be.visible')
    cy.get('[data-cy="aprobar-permiso"]').click()
    cy.get('[data-cy="confirm-accept"]').click()
    cy.wait('@resolve').its('request.body').should('deep.equal', { decision: 'approved' })
    cy.get('[data-cy="toast-success"]').should('be.visible')
  })
})

describe('Navegación SATRE COAR Junín', () => {
  it('renderiza el login y navega al dashboard del tutor', () => {
    const user = {
      id: 2,
      name: 'Luis Mendoza Aliaga',
      email: 'tutor@coar.edu.pe',
      role: { slug: 'teacher', name: 'Docente' },
      must_change_password: false,
    }

    cy.intercept('GET', '**/api/health', { status: 'ok' })
    cy.intercept('POST', '**/api/auth/login', { token: 'test-token', expires_at: null, user, must_change_password: false })
    cy.intercept('GET', '**/api/auth/me', { user })
    cy.intercept('GET', '**/api/courses', { data: [] }).as('courses')

    cy.visit('/login')
    cy.get('[data-cy="login-form"]').should('be.visible')
    cy.contains('Iniciar sesión').should('be.visible')
    cy.contains('Sistema web de alerta temprana').should('be.visible')

    cy.get('[data-cy="email"]').clear().type('tutor@coar.edu.pe')
    cy.get('[data-cy="password"]').clear().type('coar2026')
    cy.get('[data-cy="submit-login"]').click()

    cy.wait('@courses')
    cy.url().should('include', '/tutor')
    cy.get('[data-cy="dashboard-tutor"]').should('be.visible')
    cy.contains('Riesgo del aula').should('be.visible')
  })
})

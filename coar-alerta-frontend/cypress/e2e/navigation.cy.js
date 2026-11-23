describe('Navegación SATRE COAR Junín', () => {
  it('muestra el portal público y navega al login', () => {
    cy.visit('/')
    cy.get('[data-cy="landing"]').should('be.visible')
    cy.contains('Historia institucional').should('be.visible')
    cy.get('[data-cy="hero-banner"]').contains('Acceso a la Plataforma').click()
    cy.url().should('include', '/login')
    cy.get('[data-cy="login-form"]').should('be.visible')
  })

  it('renderiza el login y navega al dashboard del tutor', () => {
    const user = {
      id: 2,
      name: 'Luis Mendoza Aliaga',
      email: 'd45678901@coar.edu.pe',
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

    cy.get('[data-cy="email"]').clear().type('d45678901@coar.edu.pe')
    cy.get('[data-cy="password"]').clear().type('coar2026')
    cy.get('[data-cy="submit-login"]').click()

    cy.wait('@courses')
    cy.url().should('include', '/tutor')
    cy.get('[data-cy="dashboard-tutor"]').should('be.visible')
    cy.contains('Riesgo del aula').should('be.visible')
  })
})

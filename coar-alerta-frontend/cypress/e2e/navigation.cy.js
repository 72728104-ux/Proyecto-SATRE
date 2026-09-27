describe('Navegación SATRE COAR Junín', () => {
  it('renderiza el login y navega al dashboard del tutor', () => {
    cy.visit('/login')
    cy.get('[data-cy="login-form"]').should('be.visible')
    cy.contains('Iniciar sesión').should('be.visible')
    cy.contains('Sistema web de alerta temprana').should('be.visible')

    cy.get('[data-cy="email"]').clear().type('tutor@coar.edu.pe')
    cy.get('[data-cy="password"]').clear().type('coar2026')
    cy.get('[data-cy="submit-login"]').click()

    cy.url().should('include', '/tutor')
    cy.get('[data-cy="dashboard-tutor"]').should('be.visible')
    cy.contains('Dashboard de alerta temprana').should('be.visible')
    cy.contains('Si el estudiante reduce inasistencias en 20%').should('be.visible')
  })
})

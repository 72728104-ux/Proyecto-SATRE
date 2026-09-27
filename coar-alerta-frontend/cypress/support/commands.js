Cypress.Commands.add('loginTutor', () => {
  cy.visit('/login')
  cy.get('[data-cy="email"]').clear().type('tutor@coar.edu.pe')
  cy.get('[data-cy="password"]').clear().type('coar2026')
  cy.get('[data-cy="submit-login"]').click()
})

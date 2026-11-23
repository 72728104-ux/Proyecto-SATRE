import { describe, expect, it } from 'vitest'
import { INSTITUTION, institutionalEmail, isDni } from './institution'

describe('institutionalEmail', () => {
  it('arma el correo institucional a partir del DNI', () => {
    expect(isDni('78901234')).toBe(true)
    expect(isDni('7890123')).toBe(false)
    expect(institutionalEmail('student', '78901234')).toBe(`78901234@${INSTITUTION.mailDomain}`)
    expect(institutionalEmail('teacher', '45678901')).toBe(`d45678901@${INSTITUTION.mailDomain}`)
    expect(institutionalEmail('admin', '10000001')).toBe('')
    expect(institutionalEmail('student', '123')).toBe('')
  })
})

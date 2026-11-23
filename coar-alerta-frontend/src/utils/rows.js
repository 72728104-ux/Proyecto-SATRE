/** `records.3.notes` → { [studentId]: { notes: 'mensaje' } } según el orden en que se enviaron. */
export function rowErrorsFrom(fieldErrors, studentIds) {
  const byStudent = {}
  Object.entries(fieldErrors ?? {}).forEach(([key, message]) => {
    const match = key.match(/^records\.(\d+)\.(\w+)$/)
    const studentId = match ? studentIds[Number(match[1])] : null
    if (studentId) byStudent[studentId] = { ...byStudent[studentId], [match[2]]: message }
  })
  return byStudent
}

import { describe, expect, it } from 'vitest'
import {
  asTutorDiagram,
  asTutorQuiz,
  buildArticleAssistBody,
  buildArticlePublishBody,
  displayStudentText,
  normalizeTutorReply,
  quizFromMessage,
} from './createProtocol.js'

describe('asTutorQuiz / autoevaluacion', () => {
  it('tolera null, undefined y objetos vacíos', () => {
    expect(asTutorQuiz(null)).toBeNull()
    expect(asTutorQuiz(undefined)).toBeNull()
    expect(asTutorQuiz('')).toBeNull()
    expect(asTutorQuiz({})).toBeNull()
    expect(asTutorQuiz({ options: null })).toBeNull()
    expect(asTutorQuiz({ options: [] })).toBeNull()
  })

  it('acepta el alias autoevaluacion con opciones válidas', () => {
    const quiz = asTutorQuiz({
      pregunta: '¿Recta o parábola?',
      options: [{ id: 'a', text: 'Recta' }, { id: null, text: '' }],
    })
    expect(quiz).toEqual({ question: '¿Recta o parábola?', options: [{ id: 'a', text: 'Recta' }] })
  })
})

describe('asTutorDiagram / diagrama', () => {
  it('tolera null, undefined y cadenas vacías', () => {
    expect(asTutorDiagram(null)).toBeNull()
    expect(asTutorDiagram(undefined)).toBeNull()
    expect(asTutorDiagram('')).toBeNull()
    expect(asTutorDiagram('   ')).toBeNull()
    expect(asTutorDiagram({})).toBeNull()
  })

  it('acepta el alias diagrama como string o { mermaid }', () => {
    expect(asTutorDiagram('flowchart TD\n    A-->B')).toBe('flowchart TD\n    A-->B')
    expect(asTutorDiagram({ mermaid: 'graph LR\n    X-->Y' })).toBe('graph LR\n    X-->Y')
  })
})

describe('normalizeTutorReply', () => {
  it('mapea autoevaluacion y diagrama sin lanzar', () => {
    const reply = normalizeTutorReply({
      autoevaluacion: { question: '¿Pendiente?', options: [{ id: 'a', text: 'Δy/Δx' }] },
      diagrama: null,
    })
    expect(reply.quiz?.question).toBe('¿Pendiente?')
    expect(reply.diagram_mermaid).toBeNull()
  })

  it('no lanza si el reply viene vacío o nulo', () => {
    expect(normalizeTutorReply(null).quiz).toBeNull()
    expect(normalizeTutorReply(undefined).diagram_mermaid).toBeNull()
  })
})

describe('quizFromMessage', () => {
  it('lee autoevaluacion con encadenamiento opcional', () => {
    expect(quizFromMessage(null)).toBeNull()
    expect(quizFromMessage({ autoevaluacion: null, quiz: null })).toBeNull()
    expect(
      quizFromMessage({
        autoevaluacion: { question: 'Q', options: [{ id: 'a', text: 'Sí' }] },
      })?.question,
    ).toBe('Q')
  })
})

describe('artículo C.R.E.A.T.E.', () => {
  it('arma el mensaje de co-escritura y publicación', () => {
    const draft = { title: 'Pendiente', body: 'Mide Δy/Δx.', phase: 'explicar' }
    expect(buildArticleAssistBody(7, { tag: '[ARTICLE_COWRITE]' }, draft).message).toContain('[ARTICLE_COWRITE]')
    expect(buildArticlePublishBody(7, draft)).toEqual({
      session_id: 7,
      message: '[ARTICLE_PUBLISH]\nFase: explicar\nTítulo: Pendiente\n---\nMide Δy/Δx.',
    })
    expect(displayStudentText('[ARTICLE_PUBLISH]\nTítulo: X')).toBe('Publicar artículo')
  })

  it('conserva el type article en el reply', () => {
    expect(normalizeTutorReply({ type: 'article', explanation: 'Sugerencia' }).type).toBe('article')
  })
})

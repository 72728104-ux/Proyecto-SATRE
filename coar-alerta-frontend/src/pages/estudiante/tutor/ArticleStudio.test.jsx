import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ArticleStudio from './ArticleStudio.jsx'

describe('ArticleStudio', () => {
  afterEach(() => cleanup())

  it('publica el borrador con el mensaje C.R.E.A.T.E.', () => {
    const onPublish = vi.fn()
    render(
      <ArticleStudio
        session={{ id: 7, topic: 'Funciones lineales', create_phase: 'explicar' }}
        suggestion=""
        loading={false}
        errors={{}}
        onAssist={vi.fn()}
        onPublish={onPublish}
      />,
    )

    expect(screen.getByRole('heading', { name: /redactar y publicar artículo/i })).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/título/i), { target: { value: 'Pendiente cotidiana' } })
    fireEvent.change(screen.getByLabelText(/borrador colaborativo/i), {
      target: { value: 'La pendiente describe el cambio de y respecto de x.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /publicar artículo/i }))

    expect(onPublish).toHaveBeenCalledTimes(1)
    const [body] = onPublish.mock.calls[0]
    expect(body.session_id).toBe(7)
    expect(body.message).toContain('[ARTICLE_PUBLISH]')
    expect(body.message).toContain('Pendiente cotidiana')
  })
})

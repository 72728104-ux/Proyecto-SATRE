import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronLeft, ChevronRight, Menu, X } from 'lucide-react'
import CoarLogo from '../components/CoarLogo'
import {
  HERO_SLIDES,
  HISTORY,
  INDICATORS,
  INSTITUTION,
  MISSION,
  NEWS,
  VALUES,
  VISION,
} from '../data/institution'

const NAV = [
  { href: '#historia', label: 'Historia' },
  { href: '#mision', label: 'Misión' },
  { href: '#noticias', label: 'Noticias' },
  { href: '#indicadores', label: 'Indicadores' },
]

function AccessButton({ className, 'data-cy': dataCy = 'acceso-plataforma' }) {
  return (
    <Link
      to="/login"
      data-cy={dataCy}
      className={className}
    >
      Acceso a la Plataforma
      <ArrowRight size={16} />
    </Link>
  )
}

function HeroBanner() {
  const [index, setIndex] = useState(0)
  const slide = HERO_SLIDES[index]

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % HERO_SLIDES.length)
    }, 7000)
    return () => window.clearInterval(timer)
  }, [])

  const go = (next) => setIndex((next + HERO_SLIDES.length) % HERO_SLIDES.length)

  return (
    <section data-cy="hero-banner" className="relative isolate min-h-[32rem] overflow-hidden bg-navy-950 text-white lg:min-h-[38rem]">
      {HERO_SLIDES.map((item, itemIndex) => (
        <div
          key={item.id}
          className={`landing-hero-media absolute inset-0 bg-cover bg-center transition-opacity duration-700 ${
            itemIndex === index ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ backgroundImage: `url(${item.image})` }}
          aria-hidden={itemIndex !== index}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-navy-950/95 via-navy-950/70 to-navy-950/25" />

      <div className="relative mx-auto flex min-h-[32rem] max-w-6xl flex-col justify-end px-4 py-16 sm:px-6 lg:min-h-[38rem] lg:px-8 lg:py-24">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-300">{slide.kicker}</p>
        <h1 className="font-display mt-4 max-w-3xl text-4xl leading-tight sm:text-5xl">{slide.title}</h1>
        <p className="mt-4 max-w-2xl text-base text-white/80 sm:text-lg">{slide.text}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <AccessButton className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-5 py-3 text-sm font-semibold text-navy-950 hover:bg-teal-400" />
          <a href="#historia" className="rounded-xl border border-white/25 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">
            Conocer la institución
          </a>
        </div>

        <div className="mt-10 flex items-center gap-3">
          <button
            type="button"
            onClick={() => go(index - 1)}
            className="rounded-full border border-white/20 p-2 hover:bg-white/10"
            aria-label="Banner anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex gap-2">
            {HERO_SLIDES.map((item, itemIndex) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndex(itemIndex)}
                className={`h-2.5 rounded-full transition-all ${itemIndex === index ? 'w-8 bg-teal-400' : 'w-2.5 bg-white/35'}`}
                aria-label={`Ir al banner ${itemIndex + 1}`}
                aria-current={itemIndex === index ? 'true' : undefined}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(index + 1)}
            className="rounded-full border border-white/20 p-2 hover:bg-white/10"
            aria-label="Banner siguiente"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  )
}

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div data-cy="landing" className="min-h-svh bg-slate-50 text-slate-800">
      <div className="sticky top-0 z-40">
        <div className="bg-[#C8102E] py-1 text-center text-[11px] font-medium tracking-wide text-white">
          {INSTITUTION.network} · Modelo de Servicio Educativo COAR
        </div>

        <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <a href="#inicio" className="flex items-center gap-3">
            <CoarLogo size={44} />
            <span>
              <span className="block text-[11px] uppercase tracking-[0.18em] text-teal-700">{INSTITUTION.platform}</span>
              <span className="block font-display text-lg leading-tight text-navy-950">{INSTITUTION.shortName}</span>
            </span>
          </a>

          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 lg:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="hover:text-navy-900">
                {item.label}
              </a>
            ))}
            <AccessButton className="inline-flex items-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800" />
          </nav>

          <button
            type="button"
            className="rounded-lg p-2 text-navy-900 hover:bg-slate-100 lg:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {menuOpen ? (
          <nav className="space-y-1 border-t border-slate-100 px-4 py-3 lg:hidden">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {item.label}
              </a>
            ))}
            <AccessButton
              data-cy="acceso-plataforma-movil"
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white"
            />
          </nav>
        ) : null}
        </header>
      </div>

      <main id="inicio">
        <HeroBanner />

        <section id="indicadores" className="scroll-mt-28 bg-white py-14">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            {INDICATORS.map((item) => (
              <article key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="font-display text-3xl text-navy-950">{item.value}</p>
                <p className="mt-1 text-sm font-semibold text-navy-800">{item.label}</p>
                <p className="mt-2 text-sm text-slate-500">{item.hint}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="historia" className="scroll-mt-28 py-16">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Institución</p>
              <h2 className="font-display mt-2 text-3xl text-navy-950">{HISTORY.title}</h2>
              <p className="mt-4 text-lg text-slate-600">{HISTORY.lead}</p>
              <div className="mt-6 space-y-4 text-sm leading-relaxed text-slate-600">
                {HISTORY.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
            <aside className="rounded-3xl bg-navy-950 p-8 text-white">
              <p className="text-xs uppercase tracking-[0.2em] text-teal-300">Sede</p>
              <h3 className="font-display mt-3 text-2xl">{INSTITUTION.fullName}</h3>
              <p className="mt-4 text-sm text-white/75">{INSTITUTION.address}</p>
              <p className="mt-1 text-sm text-white/75">{INSTITUTION.reference}</p>
              <a href={`mailto:${INSTITUTION.email}`} className="mt-6 inline-block text-sm text-teal-300 hover:text-teal-200">
                {INSTITUTION.email}
              </a>
            </aside>
          </div>
        </section>

        <section id="mision" className="scroll-mt-28 bg-white py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Identidad</p>
            <h2 className="font-display mt-2 text-3xl text-navy-950">Misión, visión y valores</h2>
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <article className="rounded-3xl border border-slate-200 p-7">
                <h3 className="font-display text-2xl text-navy-950">{MISSION.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{MISSION.text}</p>
              </article>
              <article className="rounded-3xl bg-navy-50 p-7">
                <h3 className="font-display text-2xl text-navy-950">{VISION.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{VISION.text}</p>
              </article>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {VALUES.map((item) => (
                <article key={item.title} className="rounded-2xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-navy-950">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="noticias" className="scroll-mt-28 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Comunidad</p>
            <h2 className="font-display mt-2 text-3xl text-navy-950">Noticias y comunicados</h2>
            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {NEWS.map((item) => (
                <article key={item.title} className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">{item.date}</p>
                  <h3 className="font-display mt-3 text-xl text-navy-950">{item.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-navy-950 py-10 text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <CoarLogo size={40} />
            <div>
              <p className="font-display text-lg">{INSTITUTION.shortName}</p>
              <p className="text-xs text-white/60">{INSTITUTION.platform} · Sistema de alerta temprana para retención estudiantil</p>
            </div>
          </div>
          <AccessButton
            data-cy="acceso-plataforma-footer"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-navy-950 hover:bg-slate-100"
          />
        </div>
      </footer>

      <AccessButton
        data-cy="acceso-plataforma-flotante"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-navy-800 lg:hidden"
      />
    </div>
  )
}

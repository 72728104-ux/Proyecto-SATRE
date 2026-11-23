export const INSTITUTION = {
  shortName: 'COAR Junín',
  fullName: 'Colegio de Alto Rendimiento Junín',
  network: 'Ministerio de Educación del Perú',
  address: 'Calle Huayna Cápac, cuadra 4',
  reference: 'IESTP Jaime Cerrón Palomino · Chupaca, Junín',
  email: 'dirgecoarjunin@minedu.gob.pe',
  mailDomain: 'coar.edu.pe',
  platform: 'SATRE',
}

export function isDni(value) {
  return /^\d{8}$/.test(String(value ?? ''))
}

export function institutionalEmail(role, dni, domain = INSTITUTION.mailDomain) {
  if (!isDni(dni)) return ''
  if (role === 'student') return `${dni}@${domain}`
  if (role === 'teacher') return `d${dni}@${domain}`
  return ''
}

export const HERO_SLIDES = [
  {
    id: 'campus',
    image: '/landing/hero-campus.svg',
    kicker: 'Colegio de Alto Rendimiento · Junín',
    title: 'Excelencia pública al servicio del talento regional',
    text: 'Formación de 3.°, 4.° y 5.° de secundaria con altos estándares nacionales e internacionales, residencia a cargo del Estado y compromiso con el desarrollo de Junín.',
  },
  {
    id: 'aula',
    image: '/landing/hero-aula.svg',
    kicker: 'Propuesta pedagógica',
    title: 'Aprendizaje exigente, intercultural y con sentido de país',
    text: 'Plan de estudios alineado al Currículo Nacional, Programa del Diploma del Bachillerato Internacional en 4.° y 5.°, inglés como lengua de conocimiento y tutoría académica permanente.',
  },
  {
    id: 'residencia',
    image: '/landing/hero-residencia.svg',
    kicker: 'Bienestar y retención',
    title: 'Comunidad educativa con alerta temprana SATRE',
    text: 'El internado, el sistema de bienestar y la plataforma SATRE acompañan a cada estudiante para detectar a tiempo riesgos académicos, de asistencia o socioemocionales.',
  },
]

export const INDICATORS = [
  { value: '3.°–5.°', label: 'Estudiantes', hint: 'Secundaria de alto rendimiento, con residencia a cargo del Estado' },
  { value: 'MINEDU', label: 'Docentes', hint: 'Planta especializada del modelo de servicio educativo COAR' },
  { value: 'C.R.E.A.T.E.', label: 'Metodología', hint: 'Conectar, Recordar, Explicar, Aplicar, Transferir y Evaluar' },
  { value: '25 sedes', label: 'Red nacional', hint: 'Más de 7 500 estudiantes COAR en todo el Perú' },
]

export const HISTORY = {
  title: 'Historia institucional',
  lead: 'El COAR Junín forma parte del Modelo de Servicio Educativo de los Colegios de Alto Rendimiento del Ministerio de Educación.',
  paragraphs: [
    'El 23 de julio de 2014, el Gobierno Regional de Junín y el MINEDU suscribieron el convenio para la gestión educativa, administrativa y financiera del colegio. En 2015 inició operaciones en una sede acondicionada en Chongos Bajo, Chupaca, mientras se impulsaba la infraestructura definitiva.',
    'El Estado asume el costo de estudios y residencia durante los tres años de formación. El convenio de cooperación interinstitucional ha sido sucesivamente ampliado; la Adenda N.° 004, de 2026, extiende su vigencia hasta el 23 de julio de 2031.',
    'Hoy el COAR Junín atiende a estudiantes con habilidades sobresalientes de la Educación Básica Regular, con una propuesta que combina excelencia académica, internado, bienestar socioemocional y compromiso con el desarrollo local, regional y nacional.',
  ],
}

export const MISSION = {
  title: 'Misión',
  text: 'Brindar a los estudiantes con habilidades sobresalientes de la Educación Básica Regular un servicio educativo con altos estándares de calidad nacional e internacional, que propicie el desarrollo destacado de sus competencias a partir del diálogo respetuoso, crítico e intercultural.',
}

export const VISION = {
  title: 'Visión',
  text: 'Ser un modelo educativo referente de calidad académica e innovación educativa, organizacional y de gestión, que contribuya a mejorar la educación pública, formando una comunidad de líderes capaces de contribuir al desarrollo local, regional, nacional y mundial.',
}

export const VALUES = [
  { title: 'Excelencia', text: 'Altos estándares académicos, nacionales e internacionales, con jornada intensiva y exigencia formativa.' },
  { title: 'Equidad', text: 'El Estado cubre estudios y residencia para que el talento no quede limitado por la condición económica.' },
  { title: 'Interculturalidad', text: 'Diálogo respetuoso y crítico, con ciudadanía democrática y vínculo con las comunidades de origen.' },
  { title: 'Bienestar', text: 'Atención a las necesidades físicas y socioemocionales, con un sistema de protección y tutoría permanente.' },
]

export const NEWS = [
  {
    date: 'Mayo 2026',
    title: 'Convenio de gestión con el Gobierno Regional se amplía hasta 2031',
    text: 'La Adenda N.° 004 al Convenio N.° 159-2014 prorroga la operación del COAR Junín a cargo del MINEDU hasta el 23 de julio de 2031.',
  },
  {
    date: '2026',
    title: 'Proceso Único de Admisión a los COAR',
    text: 'La Resolución Viceministerial N.° 007-2026 aprueba las bases del PUA. La inscripción es gratuita y se realiza en la plataforma oficial del MINEDU.',
  },
  {
    date: 'Marzo 2026',
    title: 'Matrícula de ingresantes al servicio educativo',
    text: 'El cronograma nacional contempla el proceso de matrícula de estudiantes al COAR entre el 3 y el 31 de marzo de 2026.',
  },
]

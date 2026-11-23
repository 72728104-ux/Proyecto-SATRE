export default function CoarLogo({ className = '', size = 48, title = 'Colegio de Alto Rendimiento Junín' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title}
      className={className}
    >
      <circle cx="32" cy="32" r="31" fill="#0b2233" />
      <circle cx="32" cy="32" r="27.5" fill="none" stroke="#d4a017" strokeWidth="2.2" />
      <circle cx="32" cy="32" r="24.5" fill="none" stroke="#fbbf24" strokeWidth="0.6" opacity="0.7" />
      <path d="M18 30c4-8 8.5-12 14-12s10 4 14 12" fill="none" stroke="#fbbf24" strokeWidth="1.6" />
      <circle cx="32" cy="20" r="2.2" fill="#fbbf24" />
      <path d="M14 38.5 32 28.5 50 38.5v2.2L32 30.7 14 40.7z" fill="#f8fafc" />
      <path d="M18 41.5h28v1.4H18z" fill="#d4a017" />
      <path d="M16 46.5 32 42l16 4.5v3.2L32 45.2 16 49.7z" fill="#1b4664" />
      <path d="M20 50.2 32 47.2 44 50.2 32 53.4z" fill="#0d9488" />
    </svg>
  )
}

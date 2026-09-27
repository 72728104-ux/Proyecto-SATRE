import AlertBadge from '../../components/AlertBadge'
import { PASSING_SCORE, formatScore } from './shared'

export default function ScoreBadge({ value, max }) {
  if (value === null || value === undefined) return <AlertBadge nivel="observado">—</AlertBadge>
  return (
    <AlertBadge nivel={value >= PASSING_SCORE ? 'normal' : 'critico'}>
      {max ? `${value} / ${max}` : formatScore(value)}
    </AlertBadge>
  )
}

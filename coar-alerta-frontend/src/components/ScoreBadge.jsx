import AlertBadge from './AlertBadge'
import { formatScoreWithLiteral, letterBadge, toLiteral } from '../utils/mineduScale'

export function MineduLiteralBadge({ score, literal }) {
  const letter = literal || toLiteral(score)
  if (!letter) return <AlertBadge nivel="observado">—</AlertBadge>
  return <AlertBadge nivel={letterBadge(letter)}>{letter}</AlertBadge>
}

export default function ScoreBadge({ value, literal }) {
  if (value === null || value === undefined || value === '') {
    return <AlertBadge nivel="observado">—</AlertBadge>
  }
  const letter = literal || toLiteral(value)
  return <AlertBadge nivel={letterBadge(letter)}>{formatScoreWithLiteral(value, letter)}</AlertBadge>
}

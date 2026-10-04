import { Bot } from 'lucide-react'
import { quizFromMessage, stripMermaidFences } from './createProtocol'
import MermaidDiagram from './MermaidDiagram'
import TutorQuiz from './TutorQuiz'
import VisualResourceCard from './VisualResourceCard'

export default function TutorBubble({ message, interactive, disabled, onSelect }) {
  const isTutor = message.role === 'tutor'
  const quiz = isTutor ? quizFromMessage(message) : null
  const prose = stripMermaidFences(message.explanation || message.content)
  const showProse = prose && prose !== quiz?.question

  return (
    <li className={`flex gap-2 ${isTutor ? '' : 'justify-end'}`}>
      {isTutor ? (
        <span className="mt-1 hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-800 min-[400px]:flex">
          <Bot size={16} />
        </span>
      ) : null}
      <div
        className={`max-w-[85%] space-y-3 rounded-2xl px-4 py-2.5 text-sm sm:max-w-[75%] ${
          isTutor ? 'rounded-tl-sm bg-slate-100 text-slate-800' : 'rounded-tr-sm bg-navy-900 text-white'
        }`}
      >
        {showProse ? <p className="whitespace-pre-line">{prose}</p> : null}
        {isTutor ? <MermaidDiagram chart={message.diagram_mermaid} /> : null}
        {isTutor ? <VisualResourceCard resource={message.visual_resource} /> : null}
        {isTutor && message.reflection ? (
          <p className="rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold text-teal-800">Verifica: </span>
            {message.reflection}
          </p>
        ) : null}
        {interactive && quiz ? <TutorQuiz quiz={quiz} disabled={disabled} onSelect={onSelect} /> : null}
      </div>
    </li>
  )
}

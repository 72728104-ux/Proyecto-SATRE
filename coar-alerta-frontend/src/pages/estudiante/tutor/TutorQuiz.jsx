export default function TutorQuiz({ quiz, disabled, onSelect }) {
  if (!quiz?.options?.length) return null

  return (
    <div className="space-y-2" data-cy="tutor-quiz">
      {quiz.question ? <p className="text-sm font-medium text-navy-950">{quiz.question}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {quiz.options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(option)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 hover:border-teal-400 hover:bg-teal-50 disabled:opacity-60"
          >
            <span className="mr-2 font-semibold uppercase text-teal-700">{option.id})</span>
            {option.text}
          </button>
        ))}
      </div>
    </div>
  )
}

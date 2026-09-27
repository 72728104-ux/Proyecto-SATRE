import Modal from './Modal'

export default function ConfirmModal({
  open,
  title = '¿Confirmar acción?',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal open={open} title={title} onClose={loading ? undefined : onCancel}>
      {message ? <div className="text-sm text-slate-600">{message}</div> : null}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          data-cy="confirm-cancel"
          className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          autoFocus
          data-cy="confirm-accept"
          className={`h-10 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60 ${
            danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-navy-900 hover:bg-navy-800'
          }`}
        >
          {loading ? 'Procesando…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

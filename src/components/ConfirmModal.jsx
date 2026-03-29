export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  danger = false,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{title}</h2>
        <p style={{ fontSize: 'var(--font-body)', marginBottom: 'var(--space-lg)', lineHeight: 1.5 }}>
          {message}
        </p>
        <div className="btn-row">
          <button
            className="btn btn-secondary"
            style={{ minHeight: '64px' }}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            style={{ minHeight: '64px' }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

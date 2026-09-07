import type { ToastAction } from "../hooks/useToast";

interface ToastProps {
  message: string | null;
  action?: ToastAction | null;
}

// Fixed to the viewport (not the document flow, unlike ErrorBanner) since
// it's a transient confirmation, not a standing condition -- it shouldn't
// push anything else on the page around while it's up. The optional action
// button (e.g. "Undo") sits inline with the message rather than below it, so
// the toast reads as one compact strip either way.
export function Toast({ message, action }: ToastProps) {
  if (!message) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      <span>{message}</span>
      {action && (
        <button type="button" className="toast-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

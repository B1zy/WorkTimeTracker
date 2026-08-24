interface ToastProps {
  message: string | null;
}

// Fixed to the viewport (not the document flow, unlike ErrorBanner) since
// it's a transient confirmation, not a standing condition -- it shouldn't
// push anything else on the page around while it's up.
export function Toast({ message }: ToastProps) {
  if (!message) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>
  );
}

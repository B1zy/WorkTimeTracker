export type AppView = "week" | "overview";

interface TopNavProps {
  view: AppView;
  onChangeView: (view: AppView) => void;
  onOpenSettings: () => void;
}

export function TopNav({ view, onChangeView, onOpenSettings }: TopNavProps) {
  return (
    <div className="top-nav">
      <div className="top-nav-tabs">
        <button
          type="button"
          className={`top-nav-tab${view === "week" ? " is-active" : ""}`}
          onClick={() => onChangeView("week")}
        >
          This Week
        </button>
        <button
          type="button"
          className={`top-nav-tab${view === "overview" ? " is-active" : ""}`}
          onClick={() => onChangeView("overview")}
        >
          Overview
        </button>
      </div>
      <button type="button" className="top-nav-settings-btn" aria-label="Settings" title="Settings" onClick={onOpenSettings}>
        &#9881;
      </button>
    </div>
  );
}

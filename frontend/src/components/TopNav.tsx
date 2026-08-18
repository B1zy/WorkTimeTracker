export type AppView = "week" | "overview";

interface TopNavProps {
  view: AppView;
  onChangeView: (view: AppView) => void;
}

// Settings now live inline at the bottom of the Overview tab (see
// OverviewView) rather than behind a modal, so there's no separate settings
// trigger here anymore -- "Overview" doubles as the way in.
export function TopNav({ view, onChangeView }: TopNavProps) {
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
    </div>
  );
}

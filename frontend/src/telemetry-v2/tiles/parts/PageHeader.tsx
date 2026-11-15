// Metro page header: an optional small caps title over a big light subtitle. For panels over tiles (GPS settings
// shows just "settings") and, later, the radio panel.
export function PageHeader({ title, subtitle }: { title?: string; subtitle: string }) {
  return (
    <header className="tv2-page-header">
      {title && <div className="tv2-page-title">{title}</div>}
      <h2 className="tv2-page-subtitle">{subtitle}</h2>
    </header>
  );
}

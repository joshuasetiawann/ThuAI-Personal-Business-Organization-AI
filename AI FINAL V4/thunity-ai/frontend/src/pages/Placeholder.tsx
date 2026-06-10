export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="page">
      <div className="page-head"><h1>{title}</h1></div>
      <div className="card">
        <div className="card-body soon-screen">
          <div className="soon-mark">◷</div>
          <h3>{title} arrives in an upcoming web sprint</h3>
          <p className="muted">This module is intentionally not wired yet. No placeholder data is shown so the
            Command Center never presents fake state as real. High-risk actions here will require the approval flow.</p>
        </div>
      </div>
    </div>
  );
}

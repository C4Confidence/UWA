export default function Loading() {
  return (
    <div
      className="page-wrap loading-page"
      role="status"
      aria-label="Loading page"
    >
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-image" />
    </div>
  );
}

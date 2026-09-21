import { useEffect, useRef, useState } from "react";
import { X, Inbox, LoaderCircle, ArrowUpRight, Coffee } from "lucide-react";
export function Button({
  children,
  variant = "primary",
  loading,
  className = "",
  ...props
}) {
  return (
    <button
      className={`btn ${variant} ${className}`}
      {...props}
      disabled={props.disabled || loading}
    >
      {loading && <LoaderCircle size={16} className="spin" />}
      {children}
    </button>
  );
}
export function Input({ label, error, ...props }) {
  return (
    <label className="field">
      {label && <span>{label}</span>}
      <input {...props} />
      {error && <small className="error">{error}</small>}
    </label>
  );
}
export function Dropdown({ label, children, ...props }) {
  return (
    <label className="field">
      {label && <span>{label}</span>}
      <select {...props}>{children}</select>
    </label>
  );
}
export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.showModal();
    return () => previous?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button className="icon-btn" aria-label="Close" onClick={onClose}>
          <X size={20} />
        </button>
      </header>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function Drawer(props) {
  return <Modal {...props} />;
}
export function Confirm({
  title = "Delete this record?",
  description = "This action cannot be undone.",
  onConfirm,
  onClose,
  loading,
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted">{description}</p>
      <div className="actions">
        <Button variant="secondary" onClick={onClose}>
          Keep record
        </Button>
        <Button variant="danger" loading={loading} onClick={onConfirm}>
          Confirm delete
        </Button>
      </div>
    </Modal>
  );
}
export function Badge({ children, status }) {
  return <span className={`badge ${status || children}`}>{children}</span>;
}
export function StatCard({ label, value, icon: Icon = ArrowUpRight, detail }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">
          <Icon size={18} />
        </span>
      </div>
      <strong>{value}</strong>
      <small>{detail || "Live from your cafe"}</small>
    </div>
  );
}
export function EmptyState({
  title = "Nothing here yet",
  description = "Your records will appear here.",
  children,
}) {
  return (
    <div className="empty">
      <Inbox size={36} />
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Loader() {
  return (
    <div className="skeletons" aria-label="Loading">
      <div />
      <div />
      <div />
    </div>
  );
}
export function ErrorState({ error, retry }) {
  return (
    <div className="error-state">
      <strong>We couldn’t load this</strong>
      <p>{error}</p>
      <Button variant="secondary" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}
export function Table({ columns, rows, rowKey = "_id", onRow }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r[rowKey] || i}
              onClick={() => onRow?.(r)}
              className={onRow ? "clickable" : ""}
            >
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(r) : r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <EmptyState />}
    </div>
  );
}
export function Pagination({ meta, page, setPage }) {
  if (!meta || meta.pages <= 1) return null;
  return (
    <div className="pagination">
      <span>
        {meta.total} records · Page {page} of {meta.pages}
      </span>
      <Button
        variant="secondary"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        Previous
      </Button>
      <Button
        variant="secondary"
        disabled={page >= meta.pages}
        onClick={() => setPage(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}
export function PageHeading({
  eyebrow = "YOUR CAFE, CONNECTED",
  title,
  description,
  children,
}) {
  return (
    <div className="page-heading">
      <div>
        <small className="eyebrow">{eyebrow}</small>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function ProductCard({ product, onClick, currency }) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <button
      className="product-card"
      disabled={!product.available}
      onClick={onClick}
    >
      <div className="product-photo">
        {product.image && !imageFailed ? (
          <img
            src={product.image}
            alt={product.name}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Coffee size={42} />
        )}
        <span className={`diet ${product.veg ? "veg" : "nonveg"}`} />
        {!product.available && <span className="sold-out">Sold out</span>}
      </div>
      <div className="product-copy">
        <small>{product.category?.name}</small>
        <h3>{product.name}</h3>
        <div>
          <strong>{currency}</strong>
          <span className="add-circle">+</span>
        </div>
      </div>
    </button>
  );
}

import { Clock, ArrowRight, Printer } from "lucide-react";
import { Button, Badge } from "./ui";
const next = { new: "accepted", accepted: "preparing", preparing: "ready" };
export default function OrderCard({ order, onStatus, onPrint, busy }) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(order.createdAt)) / 60000),
  );
  return (
    <article className={`order-card ${minutes > 15 ? "overdue" : ""}`}>
      <div className="flex-between">
        <strong>{order.number}</strong>
        <Badge status={order.source === "qr" ? "info" : "neutral"}>
          {order.source === "qr" ? "QR order" : order.type}
        </Badge>
      </div>
      <div className="ticket-meta">
        <span>{order.tableName || "Takeaway / delivery"}</span>
        <span>
          <Clock size={13} /> {minutes} min
        </span>
      </div>
      <div className="ticket-items">
        {order.items.map((i, n) => (
          <div key={n}>
            <b className="qty-chip">{i.quantity}</b>
            <div>
              <strong>{i.name}</strong>
              <small>
                {[
                  i.variant,
                  ...i.addons.map((a) => a.name),
                  ...(i.modifiers || []),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
              {i.notes && <p className="ticket-note">{i.notes}</p>}
            </div>
          </div>
        ))}
      </div>
      {order.notes && <p className="ticket-note">{order.notes}</p>}
      <div className="flex">
        <button
          className="icon-btn"
          title="Print kitchen ticket"
          onClick={() => onPrint(order)}
        >
          <Printer size={18} />
        </button>
        {next[order.status] ? (
          <Button
            className="full-width"
            loading={busy}
            onClick={() => onStatus(order, next[order.status])}
          >
            {order.status === "new"
              ? "Accept order"
              : order.status === "accepted"
                ? "Start preparing"
                : "Mark ready"}
            <ArrowRight size={15} />
          </Button>
        ) : (
          <span className="ready-label">Ready to serve</span>
        )}
      </div>
    </article>
  );
}

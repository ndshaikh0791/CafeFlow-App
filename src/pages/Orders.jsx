import { useState } from "react";
import { useSelector } from "react-redux";
import { Search, Printer, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { useData, refresh } from "../hooks/useData";
import { api, message } from "../services/api";
import { money, title, dateTime } from "../utils/format";
import { printReceipt } from "../utils/print";
import {
  PageHeading,
  Button,
  Table,
  Badge,
  Modal,
  Loader,
  ErrorState,
  Pagination,
  EmptyState,
} from "../components/ui";
import PaymentModal from "../components/PaymentModal";
import OrderCard from "../components/OrderCard";
export const statuses = [
  "all",
  "new",
  "accepted",
  "preparing",
  "ready",
  "served",
  "completed",
  "cancelled",
];
const next = {
  new: "accepted",
  accepted: "preparing",
  preparing: "ready",
  ready: "served",
  served: "completed",
};
export default function Orders({ kitchen = false }) {
  const [status, setStatus] = useState("all"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState(null),
    [busy, setBusy] = useState("");
  const { data, meta, loading, error, reload } = useData(
    `/orders?limit=${kitchen ? 100 : 20}&page=${page}${!kitchen ? `&status=${status}&search=${encodeURIComponent(search)}` : "&active=true"}`,
    15000,
  );
  const user = useSelector((s) => s.auth.user);
  const { data: settings } = useData(
    user.role === "kitchen" ? null : "/settings",
  );
  async function update(order, status) {
    setBusy(order._id);
    try {
      await api.patch(`/orders/${order._id}/status`, { status });
      toast.success(`${order.number} · ${title(status)}`);
      refresh();
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <PageHeading
        eyebrow={
          kitchen ? "THE HEART OF YOUR CAFE" : "EVERY ORDER, IN ONE PLACE"
        }
        title={kitchen ? "Kitchen display" : "Orders"}
        description={
          kitchen
            ? "Keep the good things coming. Tickets update live."
            : "From the first sip to the final bill."
        }
      >
        <span className="live-indicator">
          <i /> Live updates
        </span>
      </PageHeading>
      {!kitchen && (
        <>
          <div className="category-tabs order-tabs">
            {statuses.map((s) => (
              <button
                key={s}
                className={status === s ? "active" : ""}
                onClick={() => {
                  setStatus(s);
                  setPage(1);
                }}
              >
                {title(s)}
              </button>
            ))}
          </div>
          <div className="toolbar panel">
            <div className="search-box">
              <Search size={18} />
              <input
                placeholder="Search order number…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <span className="muted">{meta?.total || 0} orders</span>
          </div>
        </>
      )}
      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorState error={error} retry={reload} />
      ) : kitchen ? (
        <>
          <div className="kitchen-grid">
            {["new", "accepted", "preparing", "ready"].map((s) => (
              <section className={`kitchen-column ${s}`} key={s}>
                <header>
                  <span>
                    <i />
                    {title(s)}
                  </span>
                  <b>{data?.filter((o) => o.status === s).length || 0}</b>
                </header>
                {data
                  ?.filter((o) => o.status === s)
                  .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                  .map((o) => (
                    <OrderCard
                      key={o._id}
                      order={o}
                      onStatus={update}
                      onPrint={(o) => printReceipt(o, settings, true)}
                      busy={busy === o._id}
                    />
                  ))}
                {!data?.some((o) => o.status === s) && (
                  <div className="column-empty">All clear here</div>
                )}
              </section>
            ))}
          </div>
          <Pagination meta={meta} page={page} setPage={setPage} />
        </>
      ) : (
        <div className="panel">
          <Table
            rows={data || []}
            onRow={setSelected}
            columns={[
              {
                key: "number",
                label: "Order",
                render: (o) => (
                  <strong>
                    {o.number}
                    <small className="cell-sub">
                      {o.source === "qr" ? "QR order" : "Point of sale"}
                    </small>
                  </strong>
                ),
              },
              {
                key: "table",
                label: "Table / Type",
                render: (o) => o.tableName || title(o.type),
              },
              {
                key: "customer",
                label: "Customer",
                render: (o) => o.customer?.name || "Walk-in guest",
              },
              {
                key: "items",
                label: "Items",
                render: (o) => o.items.reduce((s, i) => s + i.quantity, 0),
              },
              {
                key: "total",
                label: "Total",
                render: (o) => money(o.total, settings?.currency),
              },
              {
                key: "paymentStatus",
                label: "Payment",
                render: (o) => (
                  <Badge status={o.paymentStatus}>
                    {title(o.paymentStatus)}
                  </Badge>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (o) => (
                  <Badge status={o.status}>{title(o.status)}</Badge>
                ),
              },
              {
                key: "createdAt",
                label: "Placed",
                render: (o) => dateTime(o.createdAt),
              },
            ]}
          />
          <Pagination meta={meta} page={page} setPage={setPage} />
        </div>
      )}
      {selected && (
        <OrderDetail
          id={selected._id}
          settings={settings}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
function OrderDetail({ id, settings, onClose }) {
  const {
    data: order,
    loading,
    error,
    reload,
  } = useData(`/orders/${id}`, 15000);
  const [payment, setPayment] = useState(false),
    [busy, setBusy] = useState(false),
    [cancelling, setCancelling] = useState(false),
    [reason, setReason] = useState("");
  async function update(status) {
    setBusy(true);
    try {
      await api.patch(`/orders/${id}/status`, { status, reason });
      toast.success(`Order ${status}`);
      refresh();
      setCancelling(false);
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={order?.number || "Order details"} onClose={onClose} wide>
      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorState error={error} retry={reload} />
      ) : (
        order && (
          <>
            <div className="flex-between">
              <div>
                <Badge status={order.status}>{title(order.status)}</Badge>{" "}
                <Badge status={order.paymentStatus}>
                  {title(order.paymentStatus)}
                </Badge>
              </div>
              <span className="muted">{dateTime(order.createdAt)}</span>
            </div>
            <p>
              {order.tableName || title(order.type)} ·{" "}
              {order.customer?.name || "Walk-in guest"} · {order.cashierName}
            </p>
            {order.deliveryAddress && (
              <p>Deliver to: {order.deliveryAddress}</p>
            )}
            <Table
              rows={order.items}
              columns={[
                {
                  key: "name",
                  label: "Item",
                  render: (i) => (
                    <>
                      <strong>{i.name}</strong>
                      <small className="cell-sub">
                        {[
                          i.variant,
                          ...i.addons.map((a) => a.name),
                          ...(i.modifiers || []),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                      <small>{i.notes}</small>
                    </>
                  ),
                },
                { key: "quantity", label: "Qty" },
                {
                  key: "price",
                  label: "Rate",
                  render: (i) => money(i.price, settings?.currency),
                },
                {
                  key: "total",
                  label: "Amount",
                  render: (i) =>
                    money(i.price * i.quantity, settings?.currency),
                },
              ]}
            />
            {order.notes && <p className="callout">{order.notes}</p>}
            <div className="detail-totals">
              <span>
                Subtotal {money(order.subtotal, settings?.currency)} · Discount
                −{money(order.discount, settings?.currency)} · Tax{" "}
                {money(order.tax, settings?.currency)} · Service{" "}
                {money(order.serviceCharge, settings?.currency)}
              </span>
              <h2>Total {money(order.total, settings?.currency)}</h2>
            </div>
            {order.cancelReason && <p>Cancellation: {order.cancelReason}</p>}
            {cancelling && (
              <label className="field">
                Cancellation reason
                <input
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            )}
            <div className="actions wrap">
              {next[order.status] && (
                <Button
                  loading={busy}
                  disabled={
                    next[order.status] === "completed" &&
                    order.paymentStatus !== "paid"
                  }
                  onClick={() => update(next[order.status])}
                >
                  Mark {next[order.status]} <ArrowRight size={16} />
                </Button>
              )}
              {order.paymentStatus === "unpaid" &&
                order.status !== "cancelled" && (
                  <Button variant="secondary" onClick={() => setPayment(true)}>
                    Record payment
                  </Button>
                )}
              {order.paymentStatus === "paid" && (
                <Button
                  variant="secondary"
                  onClick={() => printReceipt(order, settings)}
                >
                  <Printer size={16} /> Receipt
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => printReceipt(order, settings, true)}
              >
                Print KOT
              </Button>
              {!["completed", "cancelled"].includes(order.status) &&
                order.paymentStatus === "unpaid" && (
                  <Button
                    variant="danger"
                    disabled={cancelling && !reason.trim()}
                    loading={busy}
                    onClick={() =>
                      cancelling ? update("cancelled") : setCancelling(true)
                    }
                  >
                    {cancelling ? "Confirm cancellation" : "Cancel order"}
                  </Button>
                )}
            </div>
          </>
        )
      )}
      {payment && (
        <PaymentModal
          order={order}
          currency={settings?.currency}
          onClose={() => setPayment(false)}
          onPaid={() => reload()}
        />
      )}
    </Modal>
  );
}

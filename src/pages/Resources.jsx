import { useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  QrCode,
  Download,
  Printer,
  PackagePlus,
  History,
} from "lucide-react";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import { resources } from "../constants/resources";
import { useData, refresh } from "../hooks/useData";
import { api, message } from "../services/api";
import { money as formatMoney, title, dateTime } from "../utils/format";
import {
  Button,
  Modal,
  Confirm,
  Badge,
  Table,
  PageHeading,
  Loader,
  ErrorState,
  Pagination,
  EmptyState,
} from "../components/ui";
import ResourceForm from "../components/ResourceForm";
import { printQR } from "../utils/print";
export default function Resources({ resource }) {
  const { data: settings } = useData("/settings");
  const money = (v) => formatMoney(v, settings?.currency);
  const config = {
      ...resources[resource],
      fields: resources[resource].fields.map((f) =>
        f.key === "tax" ? { ...f, default: settings?.tax ?? 5 } : f,
      ),
    },
    user = useSelector((s) => s.auth.user);
  const [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState(null),
    [remove, setRemove] = useState(null),
    [saving, setSaving] = useState(false),
    [qr, setQr] = useState(null),
    [adjust, setAdjust] = useState(null),
    [history, setHistory] = useState(null),
    [low, setLow] = useState(false);
  const { data, meta, loading, error, reload } = useData(
    `/${resource}?page=${page}&search=${encodeURIComponent(search)}&low=${low}`,
  );
  const canEdit =
    resource === "customers" || ["owner", "manager"].includes(user.role);
  async function save(values) {
    setSaving(true);
    try {
      await api[edit._id ? "put" : "post"](
        `/${resource}${edit._id ? "/" + edit._id : ""}`,
        values,
      );
      toast.success(`${title(config.singular)} saved`);
      setEdit(null);
      refresh();
    } catch (e) {
      toast.error(message(e));
    } finally {
      setSaving(false);
    }
  }
  async function deleteRecord() {
    setSaving(true);
    try {
      await api.delete(`/${resource}/${remove._id}`);
      setRemove(null);
      toast.success("Record deleted");
      reload();
    } catch (e) {
      toast.error(message(e));
    } finally {
      setSaving(false);
    }
  }
  async function showQR(row) {
    const url = `${window.location.origin}/menu/${row.qrToken}`;
    setQr({
      row,
      url,
      image: await QRCode.toDataURL(url, {
        width: 600,
        margin: 3,
        color: { dark: "#3e2723", light: "#ffffff" },
      }),
    });
  }
  const renderCell = (r, k) => {
    if (k === "category" || k === "product") return r[k]?.name || r[k];
    if (["price", "totalSpend", "amount"].includes(k)) return money(r[k]);
    if (["active", "available"].includes(k))
      return (
        <Badge status={r[k] ? "available" : "cancelled"}>
          {r[k] ? "Active" : "Inactive"}
        </Badge>
      );
    if (k === "status" || k === "role")
      return <Badge status={r[k]}>{title(r[k])}</Badge>;
    if (k === "quantity")
      return (
        <span className={r.quantity <= r.minStock ? "stock-low" : ""}>
          {r.quantity.toFixed(2).replace(".00", "")} {r.unit}
          {r.quantity <= r.minStock ? " · Low stock" : ""}
        </span>
      );
    if (k === "ingredients")
      return r.ingredients
        ?.map(
          (i) =>
            `${i.ingredient?.name || "Deleted ingredient"} × ${i.quantity}${i.ingredient?.unit || ""}`,
        )
        .join(", ");
    if (k === "cost" || k === "margin") {
      const cost =
        r.ingredients?.reduce(
          (s, i) => s + i.quantity * (i.ingredient?.costPerUnit || 0),
          0,
        ) || 0;
      return k === "cost"
        ? money(cost)
        : `${r.product?.price ? (((r.product.price - cost) / r.product.price) * 100).toFixed(1) : 0}%`;
    }
    if (k === "date") return new Date(r[k]).toLocaleDateString();
    return r[k] ?? "—";
  };
  const rowActions = (r) => (
    <div className="row-actions">
      {resource === "tables" && (
        <button
          title="Table QR code"
          className="icon-btn"
          onClick={() => showQR(r)}
        >
          <QrCode size={17} />
        </button>
      )}
      {resource === "inventory" && (
        <>
          <button
            title="Adjust stock"
            className="icon-btn"
            onClick={() => setAdjust(r)}
          >
            <PackagePlus size={17} />
          </button>
          <button
            title="Stock history"
            className="icon-btn"
            onClick={() =>
              setHistory({
                title: `${r.name} · stock history`,
                url: `/inventory/${r._id}/history`,
              })
            }
          >
            <History size={17} />
          </button>
        </>
      )}
      {resource === "customers" && (
        <button
          title="Customer history"
          className="icon-btn"
          onClick={() =>
            setHistory({
              title: `${r.name} · order history`,
              url: `/customers/${r._id}/orders`,
              customer: r,
            })
          }
        >
          <History size={17} />
        </button>
      )}
      {canEdit && (
        <>
          <button title="Edit" className="icon-btn" onClick={() => setEdit(r)}>
            <Pencil size={17} />
          </button>
          {resource !== "staff" && (
            <button
              title="Delete"
              className="icon-btn danger-text"
              onClick={() => setRemove(r)}
            >
              <Trash2 size={17} />
            </button>
          )}
        </>
      )}
    </div>
  );
  return (
    <>
      <PageHeading title={config.title} description={config.description}>
        {canEdit && (
          <Button onClick={() => setEdit({})}>
            <Plus size={18} /> Add {config.singular}
          </Button>
        )}
      </PageHeading>
      <div className="panel">
        <div className="toolbar">
          <div className="search-box">
            <Search size={18} />
            <input
              aria-label={`Search ${config.title}`}
              placeholder={`Search ${config.title.toLowerCase()}…`}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          {resource === "inventory" && (
            <label className="inline-check">
              <input
                type="checkbox"
                checked={low}
                onChange={(e) => {
                  setLow(e.target.checked);
                  setPage(1);
                }}
              />{" "}
              Low stock only
            </label>
          )}
          <span className="muted">{meta?.total || 0} records</span>
        </div>
        {loading ? (
          <Loader />
        ) : error ? (
          <ErrorState error={error} retry={reload} />
        ) : resource === "tables" ? (
          <div className="table-grid">
            {data?.map((r) => (
              <div key={r._id} className={`table-card ${r.status}`}>
                <div className="flex-between">
                  <Badge status={r.status}>{title(r.status)}</Badge>
                  <span className="muted">{r.capacity} seats</span>
                </div>
                <div className="table-illustration">
                  <span />
                  {r.name}
                  <span />
                </div>
                <p>
                  {r.currentOrder
                    ? `${r.currentOrder.number} · ${money(r.currentOrder.total)}`
                    : "Ready for the next chapter"}
                </p>
                {rowActions(r)}
              </div>
            ))}
          </div>
        ) : (
          <Table
            rows={data || []}
            columns={[
              ...config.columns.map((k) => ({
                key: k,
                label: title(k.replace(/([A-Z])/g, " $1")),
                render: (r) => renderCell(r, k),
              })),
              { key: "actions", label: "Actions", render: rowActions },
            ]}
          />
        )}
        <Pagination meta={meta} page={page} setPage={setPage} />
      </div>
      {edit && (
        <Modal
          title={`${edit._id ? "Edit" : "Add"} ${config.singular}`}
          onClose={() => setEdit(null)}
          wide
        >
          <ResourceForm
            config={config}
            record={edit._id ? edit : null}
            saving={saving}
            onSubmit={save}
          />
        </Modal>
      )}
      {remove && (
        <Confirm
          onClose={() => setRemove(null)}
          onConfirm={deleteRecord}
          loading={saving}
          description={`Delete ${remove.name || remove.title || remove.code || "this record"}? Linked historical orders remain intact.`}
        />
      )}
      {qr && (
        <Modal title={`${qr.row.name} · Table QR`} onClose={() => setQr(null)}>
          <div className="qr-preview">
            <img src={qr.image} alt={`QR code for table ${qr.row.name}`} />
            <h3>Good things are on the menu.</h3>
            <p>Scan, choose your favorites, and we’ll take it from here.</p>
            <a href={qr.url} target="_blank" rel="noreferrer">
              Open customer menu
            </a>
            <small>
              For phone access, open this app using its public or LAN address
              before generating the QR.
            </small>
          </div>
          <div className="actions">
            <a
              className="btn secondary"
              href={qr.image}
              download={`${qr.row.name}-qr.png`}
            >
              <Download size={16} /> Download
            </a>
            <Button onClick={() => printQR(qr)}>
              <Printer size={16} /> Print QR
            </Button>
          </div>
        </Modal>
      )}
      {adjust && <StockAdjust item={adjust} onClose={() => setAdjust(null)} />}{" "}
      {history && (
        <HistoryModal info={history} onClose={() => setHistory(null)} />
      )}
    </>
  );
}
function StockAdjust({ item, onClose }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Adjust ${item.name}`} onClose={onClose}>
      <p className="muted">
        Current stock: {item.quantity} {item.unit}. Use a negative quantity for
        wastage or a correction.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          try {
            await api.post(`/inventory/${item._id}/adjust`, {
              delta: Number(f.get("delta")),
              reason: f.get("reason"),
            });
            toast.success("Stock adjusted");
            refresh();
            onClose();
          } catch (err) {
            toast.error(message(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          Quantity change ({item.unit})
          <input required type="number" step="any" name="delta" />
        </label>
        <label className="field">
          Reason
          <input
            required
            minLength={3}
            name="reason"
            placeholder="Delivery, wastage, or stock correction"
          />
        </label>
        <Button loading={busy}>Save adjustment</Button>
      </form>
    </Modal>
  );
}
function HistoryModal({ info, onClose }) {
  const { data: settings } = useData("/settings");
  const money = (v) => formatMoney(v, settings?.currency);
  const { data, loading, error, reload } = useData(info.url);
  return (
    <Modal title={info.title} onClose={onClose} wide>
      {info.customer && (
        <p className="muted">
          Current points: {info.customer.points} · Earned:{" "}
          {info.customer.earnedPoints} · Redeemed:{" "}
          {info.customer.redeemedPoints}
        </p>
      )}
      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorState error={error} retry={reload} />
      ) : (
        <Table
          rows={data || []}
          columns={
            info.customer
              ? [
                  { key: "number", label: "Order" },
                  {
                    key: "createdAt",
                    label: "Date",
                    render: (r) => dateTime(r.createdAt),
                  },
                  {
                    key: "total",
                    label: "Total",
                    render: (r) => money(r.total),
                  },
                  { key: "status", label: "Status" },
                ]
              : [
                  {
                    key: "createdAt",
                    label: "Time",
                    render: (r) => dateTime(r.createdAt),
                  },
                  { key: "delta", label: "Change" },
                  { key: "reason", label: "Reason" },
                  {
                    key: "user",
                    label: "By",
                    render: (r) => r.user?.name || "System",
                  },
                ]
          }
        />
      )}
    </Modal>
  );
}

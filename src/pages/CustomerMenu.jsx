import { uniqueId } from "../utils/id";
import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Coffee,
  Search,
  ShoppingBag,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { useData } from "../hooks/useData";
import { api, message } from "../services/api";
import { money, title } from "../utils/format";
import {
  Button,
  Modal,
  ProductCard,
  EmptyState,
  Loader,
  ErrorState,
} from "../components/ui";
import CustomizeProduct from "../components/CustomizeProduct";
export default function CustomerMenu() {
  const { tableId } = useParams();
  const { data, loading, error, reload } = useData(`/public/menu/${tableId}`);
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("all"),
    [custom, setCustom] = useState(null),
    [cart, setCart] = useState([]),
    [open, setOpen] = useState(false),
    [notes, setNotes] = useState(""),
    [busy, setBusy] = useState(false),
    [order, setOrder] = useState(null);
  const key = useRef(uniqueId()),
    lock = useRef(false);
  const currency = data?.settings.currency;
  useEffect(() => {
    key.current = uniqueId();
  }, [cart, notes]);
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0),
    tax = cart.reduce((s, i) => s + (i.price * i.quantity * i.tax) / 100, 0),
    service = (subtotal * (data?.settings.serviceCharge || 0)) / 100,
    total = subtotal + tax + service;
  async function place() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const { data: res } = await api.post(`/public/menu/${tableId}/orders`, {
        idempotencyKey: key.current,
        type: "dine-in",
        items: cart.map(
          ({ product, quantity, variant, addons, modifiers, notes }) => ({
            product,
            quantity,
            variant,
            addons,
            modifiers,
            notes,
          }),
        ),
        notes,
      });
      setOrder(res.data);
      setCart([]);
      setOpen(false);
      toast.success("Your order is on its way to the kitchen");
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  if (loading)
    return (
      <div className="customer-shell">
        <Loader />
      </div>
    );
  if (error)
    return (
      <div className="customer-shell">
        <ErrorState error={error} retry={reload} />
      </div>
    );
  if (order)
    return (
      <Tracking
        initial={order}
        settings={data.settings}
        onBack={() => setOrder(null)}
      />
    );
  const products = data.products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      (category === "all" || p.category?._id === category),
  );
  return (
    <div className="customer-shell">
      <header className="customer-header">
        <div className="brand">
          <span className="brand-icon">
            {data.settings.logo ? (
              <img
                className="cafe-logo"
                src={data.settings.logo}
                alt="Cafe logo"
              />
            ) : (
              <Coffee size={22} />
            )}
          </span>
          <div>
            <strong>{data.settings.name}</strong>
            <small>GOOD FOOD. GOOD COMPANY.</small>
          </div>
        </div>
        <span className="table-pill">Table {data.table.name}</span>
      </header>
      <div className="customer-hero">
        <small>TAKE A MOMENT. MAKE IT YOURS.</small>
        <h1>
          A little pause.
          <br />A lot of flavor.
        </h1>
        <p>
          Freshly brewed, lovingly made,
          <br />
          and brought right to your table.
        </p>
        <Coffee className="hero-coffee" strokeWidth={0.9} />
      </div>
      <div className="customer-content">
        <div className="search-box">
          <Search size={19} />
          <input
            aria-label="Search menu"
            placeholder="What sounds good today?"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="category-tabs">
          <button
            className={category === "all" ? "active" : ""}
            onClick={() => setCategory("all")}
          >
            All favorites
          </button>
          {data.categories.map((c) => (
            <button
              key={c._id}
              className={category === c._id ? "active" : ""}
              onClick={() => setCategory(c._id)}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="catalog-heading">
          <h2>Something for every mood</h2>
          <span>{products.length} items</span>
        </div>
        <div className="product-grid customer-products">
          {products.map((p) => (
            <ProductCard
              key={p._id}
              product={p}
              currency={money(p.price, currency)}
              onClick={() => setCustom(p)}
            />
          ))}
        </div>
        {!products.length && (
          <EmptyState
            title="No matches yet"
            description="Try a different search."
          />
        )}
        <footer className="customer-footer">
          <Coffee size={20} />
          <p>Made with care at {data.settings.name}</p>
          <small>{data.settings.address}</small>
        </footer>
      </div>
      {cart.length > 0 && (
        <button className="floating-cart" onClick={() => setOpen(true)}>
          <span>
            <ShoppingBag size={19} /> {cart.reduce((s, i) => s + i.quantity, 0)}{" "}
            items
          </span>
          <b>View order · {money(total, currency)}</b>
          <ArrowRight size={18} />
        </button>
      )}
      {custom && (
        <CustomizeProduct
          product={custom}
          currency={currency}
          onClose={() => setCustom(null)}
          onAdd={(item) => setCart([...cart, { ...item, key: uniqueId() }])}
        />
      )}{" "}
      {open && (
        <Modal title="Your little favorites" onClose={() => setOpen(false)}>
          {cart.map((i) => (
            <div className="cart-item" key={i.key}>
              <div className="flex-between">
                <strong>{i.name}</strong>
                <b>{money(i.quantity * i.price, currency)}</b>
              </div>
              <small>
                {[i.variant, ...i.addons, ...i.modifiers]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
              {i.notes && <p>{i.notes}</p>}
              <div className="quantity">
                <button
                  aria-label="Decrease quantity"
                  onClick={() =>
                    setCart(
                      cart
                        .map((r) =>
                          r.key === i.key
                            ? { ...r, quantity: r.quantity - 1 }
                            : r,
                        )
                        .filter((r) => r.quantity > 0),
                    )
                  }
                >
                  −
                </button>
                <span>{i.quantity}</span>
                <button
                  aria-label="Increase quantity"
                  onClick={() =>
                    setCart(
                      cart.map((r) =>
                        r.key === i.key
                          ? { ...r, quantity: Math.min(100, r.quantity + 1) }
                          : r,
                      ),
                    )
                  }
                >
                  +
                </button>
              </div>
            </div>
          ))}
          <label className="field">
            Anything else?
            <textarea
              placeholder="Special instructions for your order"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <div className="totals">
            <div>
              <span>Subtotal</span>
              <span>{money(subtotal, currency)}</span>
            </div>
            <div>
              <span>Tax</span>
              <span>{money(tax, currency)}</span>
            </div>
            {service > 0 && (
              <div>
                <span>Service charge</span>
                <span>{money(service, currency)}</span>
              </div>
            )}
            <div className="grand-total">
              <strong>Total</strong>
              <strong>{money(total, currency)}</strong>
            </div>
          </div>
          <p className="muted">Pay at the counter when you’re ready.</p>
          <Button
            className="full-width"
            loading={busy}
            disabled={!cart.length}
            onClick={place}
          >
            Place order <ArrowRight size={18} />
          </Button>
        </Modal>
      )}
    </div>
  );
}
export function Tracking({ initial, settings, onBack }) {
  const params = useParams();
  const token = initial?.trackingToken || params.token;
  const { data, loading, error, reload, setData } = useData(
    `/public/orders/${token}`,
    10000,
  );
  const order = data || initial;
  useEffect(() => {
    const socket = io({ withCredentials: true });
    socket.on("connect", () => socket.emit("track", token));
    socket.on("tracking", setData);
    return () => socket.disconnect();
  }, [token, setData]);
  const steps = [
    "new",
    "accepted",
    "preparing",
    "ready",
    "served",
    "completed",
  ];
  if (!order)
    return (
      <div className="customer-shell">
        {loading ? <Loader /> : <ErrorState error={error} retry={reload} />}
      </div>
    );
  const idx = steps.indexOf(order.status);
  return (
    <div className="tracking-shell">
      <div className="tracking-icon">
        <CheckCircle2 size={42} />
      </div>
      <small className="eyebrow">{settings?.name || "CAFEFLOW"}</small>
      <h1>
        {order.status === "cancelled"
          ? "Order cancelled"
          : order.status === "ready"
            ? "Ready for you!"
            : "You’re in good hands."}
      </h1>
      <p className="muted">
        {order.number} · Table {order.tableName}
      </p>
      <div className="tracking-steps">
        {steps.map((s, i) => (
          <div className={i <= idx ? "done" : ""} key={s}>
            <span>
              {i <= idx ? <CheckCircle2 size={20} /> : <Clock size={20} />}
            </span>
            <div>
              <strong>{s === "new" ? "Order received" : title(s)}</strong>
              {i === idx && <small>We’ll keep this page up to date.</small>}
            </div>
          </div>
        ))}
      </div>
      <div className="panel tracking-summary">
        {order.items.map((i, n) => (
          <div key={n} className="flex-between">
            <span>
              {i.quantity} × {i.name}
            </span>
            <span>
              {money(
                i.price * i.quantity,
                order.currency || settings?.currency,
              )}
            </span>
          </div>
        ))}
        <div className="grand-total flex-between">
          <b>Total</b>
          <b>{money(order.total, order.currency || settings?.currency)}</b>
        </div>
      </div>
      <Link className="tracking-link" to={`/track/${token}`}>
        Save this tracking link
      </Link>
      {onBack && (
        <Button variant="secondary" onClick={onBack}>
          <ArrowLeft size={16} /> Back to menu
        </Button>
      )}
    </div>
  );
}

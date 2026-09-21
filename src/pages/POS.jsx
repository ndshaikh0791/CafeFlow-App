import { uniqueId } from "../utils/id";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Search,
  ShoppingBag,
  Trash2,
  Pause,
  Play,
  Plus,
  ArrowRight,
  UtensilsCrossed,
  Package,
  Truck,
} from "lucide-react";
import toast from "react-hot-toast";
import { useData, useCollection, refresh } from "../hooks/useData";
import { api, message } from "../services/api";
import { addItem, updateItem, setCart, clearCart } from "../store";
import { money } from "../utils/format";
import {
  Button,
  Modal,
  ProductCard,
  EmptyState,
  Loader,
  ErrorState,
  PageHeading,
} from "../components/ui";
import CustomizeProduct from "../components/CustomizeProduct";
import PaymentModal from "../components/PaymentModal";
import ResourceForm from "../components/ResourceForm";
import { resources } from "../constants/resources";
import { printReceipt } from "../utils/print";
export default function POS() {
  const dispatch = useDispatch(),
    cart = useSelector((s) => s.cart),
    user = useSelector((s) => s.auth.user);
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("all"),
    [custom, setCustom] = useState(null),
    [busy, setBusy] = useState(false),
    [quote, setQuote] = useState(null),
    [payment, setPayment] = useState(null),
    [placed, setPlaced] = useState(null),
    [held, setHeld] = useState(false),
    [addCustomer, setAddCustomer] = useState(false),
    [customerBusy, setCustomerBusy] = useState(false);
  const key = useRef(uniqueId()),
    locked = useRef(false);
  const { data: products, loading, error, reload } = useCollection("/products"),
    { data: categories } = useCollection("/categories"),
    { data: tables } = useCollection("/tables"),
    { data: customers } = useCollection("/customers"),
    { data: settings } = useData("/settings"),
    holds = useData("/held-orders");
  const currency = settings?.currency || "INR";
  const appliedDefaults = useRef(false);
  const resetCart = () => {
    dispatch(clearCart());
    dispatch(setCart({ type: settings?.defaultOrderType || "dine-in" }));
  };
  useEffect(() => {
    if (settings && !appliedDefaults.current) {
      appliedDefaults.current = true;
      if (!cart.items.length)
        dispatch(setCart({ type: settings.defaultOrderType }));
    }
  }, [settings, dispatch, cart.items.length]);
  const payload = () => ({
    ...cart,
    idempotencyKey: key.current,
    table: cart.table || undefined,
    customer: cart.customer || undefined,
    items: cart.items.map(
      ({ product, quantity, variant, addons, modifiers, notes }) => ({
        product,
        quantity,
        variant,
        addons,
        modifiers,
        notes,
      }),
    ),
  });
  useEffect(() => {
    setQuote(null);
    key.current = uniqueId();
  }, [cart]);
  async function calculate() {
    try {
      const { data } = await api.post("/orders/quote", payload());
      setQuote(data.data);
      toast.success("Discounts and totals verified");
    } catch (e) {
      toast.error(message(e));
    }
  }
  async function place(payNow) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      const { data } = await api.post("/orders", payload());
      const order = data.data;
      resetCart();
      setPlaced(order);
      refresh();
      toast.success(`${order.number} sent to kitchen`);
      if (payNow) setPayment(order);
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }
  async function hold() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    try {
      await api.post("/held-orders", {
        name: `${cart.type} · ${cart.items.length} items`,
        cart,
      });
      resetCart();
      holds.reload();
      toast.success("Order held");
    } catch (e) {
      toast.error(message(e));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const subtotal = cart.items.reduce((s, i) => s + i.price * i.quantity, 0),
    tax = cart.items.reduce(
      (s, i) => s + (i.price * i.quantity * i.tax) / 100,
      0,
    ),
    service = (subtotal * (settings?.serviceCharge || 0)) / 100,
    total = quote?.total ?? subtotal + tax + service;
  const filtered =
    products?.filter(
      (p) =>
        p.active &&
        p.name.toLowerCase().includes(search.toLowerCase()) &&
        (category === "all" || p.category?._id === category),
    ) || [];
  return (
    <>
      <PageHeading
        eyebrow="MAKE SOMETHING GOOD"
        title="Point of sale"
        description="Great service, one order at a time."
      >
        <Button variant="secondary" onClick={() => setHeld(true)}>
          <Play size={16} /> Held orders{" "}
          {holds.data?.length ? `(${holds.data.length})` : ""}
        </Button>
      </PageHeading>
      <div className="pos-layout">
        <section className="catalog">
          <div className="search-box catalog-search">
            <Search size={18} />
            <input
              placeholder="Search coffee, food, and more…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="key-hint">MENU</span>
          </div>
          <div className="category-tabs">
            <button
              className={category === "all" ? "active" : ""}
              onClick={() => setCategory("all")}
            >
              All items
            </button>
            {categories?.map((c) => (
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
            <h3>
              {category === "all"
                ? "Made for your day"
                : categories?.find((c) => c._id === category)?.name}
            </h3>
            <span>{filtered.length} items</span>
          </div>
          {loading ? (
            <Loader />
          ) : error ? (
            <ErrorState error={error} retry={reload} />
          ) : (
            <div className="product-grid">
              {filtered.map((p) => (
                <ProductCard
                  key={p._id}
                  product={p}
                  currency={money(p.price, currency)}
                  onClick={() => setCustom(p)}
                />
              ))}
            </div>
          )}
          {!loading && !filtered.length && (
            <EmptyState
              title="No matching products"
              description="Try another category or search."
            />
          )}
        </section>
        <aside className="cart-panel">
          <div className="cart-header">
            <div>
              <ShoppingBag size={19} />
              <h2>Current order</h2>
            </div>
            <button
              className="icon-btn"
              title="Clear cart"
              onClick={() => {
                if (
                  !cart.items.length ||
                  window.confirm("Clear all items from this cart?")
                )
                  resetCart();
              }}
            >
              <Trash2 size={18} />
            </button>
          </div>
          <div className="order-types">
            {[
              ["dine-in", UtensilsCrossed],
              ["takeaway", Package],
              ["delivery", Truck],
            ].map(([type, Icon]) => (
              <button
                key={type}
                className={cart.type === type ? "selected" : ""}
                onClick={() => dispatch(setCart({ type, table: "" }))}
              >
                <Icon size={15} />
                {type === "dine-in"
                  ? "Dine in"
                  : type === "takeaway"
                    ? "Takeaway"
                    : "Delivery"}
              </button>
            ))}
          </div>
          <div className="cart-fields">
            {cart.type === "dine-in" && (
              <select
                aria-label="Select table"
                value={cart.table}
                onChange={(e) => dispatch(setCart({ table: e.target.value }))}
              >
                <option value="">Select a table</option>
                {tables
                  ?.filter((t) => ["available", "occupied"].includes(t.status))
                  .map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name} · {t.capacity} seats · {t.status}
                    </option>
                  ))}
              </select>
            )}
            {cart.type === "delivery" && (
              <input
                placeholder="Delivery address"
                value={cart.deliveryAddress}
                onChange={(e) =>
                  dispatch(setCart({ deliveryAddress: e.target.value }))
                }
              />
            )}
            <div className="flex">
              <select
                aria-label="Customer"
                value={cart.customer}
                onChange={(e) =>
                  dispatch(setCart({ customer: e.target.value }))
                }
              >
                <option value="">Walk-in customer</option>
                {customers?.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name} · {c.points} pts
                  </option>
                ))}
              </select>
              <button
                className="icon-btn"
                title="Add customer"
                onClick={() => setAddCustomer(true)}
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
          <div className="cart-items">
            {!cart.items.length ? (
              <EmptyState
                title="A fresh start"
                description="Choose something delicious from the menu."
              />
            ) : (
              cart.items.map((i) => (
                <div key={i.key} className="cart-item">
                  <div className="flex-between">
                    <strong>{i.name}</strong>
                    <strong>{money(i.price * i.quantity, currency)}</strong>
                  </div>
                  <small>
                    {[i.variant, ...i.addons, ...i.modifiers]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                  {i.notes && <small className="item-note">{i.notes}</small>}
                  <div className="quantity">
                    <button
                      aria-label={`Decrease ${i.name}`}
                      onClick={() =>
                        dispatch(
                          updateItem({ key: i.key, quantity: i.quantity - 1 }),
                        )
                      }
                    >
                      −
                    </button>
                    <span>{i.quantity}</span>
                    <button
                      aria-label={`Increase ${i.name}`}
                      onClick={() =>
                        dispatch(
                          updateItem({
                            key: i.key,
                            quantity: Math.min(100, i.quantity + 1),
                          }),
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="cart-bottom">
            <input
              placeholder="Order notes…"
              maxLength={2000}
              value={cart.notes}
              onChange={(e) => dispatch(setCart({ notes: e.target.value }))}
            />
            <div className="promo-row">
              <input
                placeholder="Promo code"
                value={cart.discountCode}
                onChange={(e) =>
                  dispatch(setCart({ discountCode: e.target.value }))
                }
              />
              <Button
                variant="secondary"
                disabled={!cart.items.length}
                onClick={calculate}
              >
                Apply
              </Button>
            </div>
            {cart.customer && settings?.loyaltyEnabled && (
              <label className="field compact">
                Redeem loyalty points
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={cart.redeemPoints}
                  onChange={(e) =>
                    dispatch(setCart({ redeemPoints: Number(e.target.value) }))
                  }
                />
              </label>
            )}
            {["owner", "manager"].includes(user.role) && (
              <details>
                <summary>Manager discount</summary>
                <label className="field compact">
                  Flat order discount
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={cart.manualDiscount}
                    onChange={(e) =>
                      dispatch(
                        setCart({ manualDiscount: Number(e.target.value) }),
                      )
                    }
                  />
                </label>
                <small>Use Apply to verify adjusted totals.</small>
              </details>
            )}
            <div className="totals">
              <div>
                <span>Subtotal</span>
                <span>{money(quote?.subtotal ?? subtotal, currency)}</span>
              </div>
              <div>
                <span>Discount</span>
                <span>−{money(quote?.discount || 0, currency)}</span>
              </div>
              <div>
                <span>Tax / GST</span>
                <span>{money(quote?.tax ?? tax, currency)}</span>
              </div>
              {service > 0 && (
                <div>
                  <span>Service charge</span>
                  <span>
                    {money(quote?.serviceCharge ?? service, currency)}
                  </span>
                </div>
              )}
              <div className="grand-total">
                <strong>Total</strong>
                <strong>{money(total, currency)}</strong>
              </div>
            </div>
            <div className="cart-action-row">
              <Button
                variant="secondary"
                disabled={!cart.items.length || busy}
                onClick={hold}
              >
                <Pause size={16} /> Hold
              </Button>
              <Button
                variant="secondary"
                loading={busy}
                disabled={!cart.items.length}
                onClick={() => place(false)}
              >
                Send to kitchen
              </Button>
            </div>
            <Button
              className="full-width"
              disabled={!cart.items.length}
              loading={busy}
              onClick={() => place(true)}
            >
              Place order & pay <ArrowRight size={18} />
            </Button>
          </div>
        </aside>
      </div>
      {custom && (
        <CustomizeProduct
          product={custom}
          currency={currency}
          onClose={() => setCustom(null)}
          onAdd={(i) => dispatch(addItem(i))}
        />
      )}{" "}
      {payment && (
        <PaymentModal
          order={payment}
          currency={currency}
          onClose={() => setPayment(null)}
          onPaid={async (o) => {
            const { data } = await api.get(`/orders/${o._id}`);
            setPlaced(data.data);
          }}
        />
      )}
      {placed && !payment && (
        <Modal
          title={`${placed.number} · Order placed`}
          onClose={() => setPlaced(null)}
        >
          <p>
            Your order is in the kitchen queue. Follow its progress in Orders.
          </p>
          <div className="actions">
            {placed.paymentStatus === "unpaid" ? (
              <Button onClick={() => setPayment(placed)}>Record payment</Button>
            ) : (
              <Button onClick={() => printReceipt(placed, settings)}>
                Print receipt
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => printReceipt(placed, settings, true)}
            >
              Print KOT
            </Button>
            <Button variant="secondary" onClick={() => setPlaced(null)}>
              New order
            </Button>
          </div>
        </Modal>
      )}
      {held && (
        <Modal title="Held orders" onClose={() => setHeld(false)}>
          {holds.data?.length ? (
            holds.data.map((h) => (
              <div className="held-row" key={h._id}>
                <span>{h.name}</span>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      cart.items.length &&
                      !window.confirm(
                        "Replace your current cart with this held order?",
                      )
                    )
                      return;
                    setBusy(true);
                    try {
                      await api.delete(`/held-orders/${h._id}`);
                      dispatch(setCart(h.cart));
                      holds.reload();
                      setHeld(false);
                    } catch (e) {
                      toast.error(message(e));
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Resume
                </Button>
                <button
                  className="icon-btn"
                  aria-label="Delete held order"
                  onClick={async () => {
                    try {
                      await api.delete(`/held-orders/${h._id}`);
                      holds.reload();
                    } catch (e) {
                      toast.error(message(e));
                    }
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          ) : (
            <EmptyState title="No held orders" />
          )}
        </Modal>
      )}
      {addCustomer && (
        <Modal title="Add customer" onClose={() => setAddCustomer(false)}>
          <ResourceForm
            config={resources.customers}
            saving={customerBusy}
            onSubmit={async (v) => {
              setCustomerBusy(true);
              try {
                const { data } = await api.post("/customers", v);
                dispatch(setCart({ customer: data.data._id }));
                refresh();
                setAddCustomer(false);
                toast.success("Customer added");
              } catch (e) {
                toast.error(message(e));
              } finally {
                setCustomerBusy(false);
              }
            }}
          />
        </Modal>
      )}
    </>
  );
}

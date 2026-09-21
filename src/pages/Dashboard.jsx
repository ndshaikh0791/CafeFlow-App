import { useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  ArrowUpRight,
  ShoppingBag,
  IndianRupee,
  UtensilsCrossed,
  Clock,
  Package,
  Download,
  Plus,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useData } from "../hooks/useData";
import { money, csvExport, dateTime, title } from "../utils/format";
import {
  PageHeading,
  Button,
  StatCard,
  Table,
  Badge,
  Loader,
  ErrorState,
  EmptyState,
} from "../components/ui";
function rangeFor(preset) {
  const now = new Date(),
    from = new Date();
  from.setHours(0, 0, 0, 0);
  if (preset === "yesterday") {
    from.setDate(from.getDate() - 1);
    now.setTime(from.getTime() + 86400000 - 1);
  }
  if (preset === "week") from.setDate(from.getDate() - 6);
  if (preset === "month") from.setDate(from.getDate() - 29);
  return { from: from.toISOString(), to: now.toISOString() };
}
const colors = [
  "#5d4037",
  "#c98b5f",
  "#ddbc9f",
  "#899b83",
  "#c9d6c3",
  "#e7dacf",
];
export default function Dashboard({ reports = false }) {
  const user = useSelector((s) => s.auth.user),
    [preset, setPreset] = useState("week"),
    [range, setRange] = useState(() => rangeFor("week")),
    [tab, setTab] = useState("sales");
  const {
    data: r,
    loading,
    error,
    reload,
  } = useData(
    `/${reports ? "reports" : "dashboard"}?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
    30000,
  );
  const { data: settings } = useData("/settings");
  const fmt = (v) => money(v, settings?.currency);
  const reportRows = r
    ? {
        sales: r.orders.map((o) => ({
          order: o.number,
          date: dateTime(o.paidAt),
          subtotal: o.subtotal,
          discount: o.discount,
          tax: o.tax,
          total: o.total,
          status: o.status,
        })),
        orders: r.orders.map((o) => ({
          order: o.number,
          type: o.type,
          table: o.tableName || "",
          items: o.items.reduce((s, i) => s + i.quantity, 0),
          total: o.total,
          status: o.status,
        })),
        products: r.products,
        categories: r.categories,
        inventory: r.inventory.map((i) => ({
          name: i.name,
          sku: i.sku,
          quantity: i.quantity,
          unit: i.unit,
          minStock: i.minStock,
          costPerUnit: i.costPerUnit,
        })),
        lowstock: r.lowStock.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          minStock: i.minStock,
        })),
        payments: r.payments,
        expenses: r.expenses.map((e) => ({
          title: e.title,
          category: e.category,
          amount: e.amount,
          date: new Date(e.date).toLocaleDateString(),
          method: e.paymentMethod,
        })),
        profit: [
          {
            netSales: r.netSales,
            ingredientCost: r.cost,
            expenses: r.expenseTotal,
            estimatedProfit: r.profit,
          },
        ],
      }[tab]
    : [];
  return (
    <>
      <PageHeading
        eyebrow={reports ? "THE BIGGER PICTURE" : "A FRESH START, EVERY DAY"}
        title={
          reports ? "Reports & insights" : `Hello, ${user.name.split(" ")[0]}.`
        }
        description={
          reports
            ? "Understand your business, from the daily details to the bigger picture."
            : "Here’s what’s brewing at your cafe."
        }
      >
        {reports ? (
          <Button
            variant="secondary"
            disabled={!reportRows?.length}
            onClick={() => csvExport(`cafeflow-${tab}`, reportRows)}
          >
            <Download size={16} /> Export CSV
          </Button>
        ) : (
          <Link className="btn primary" to="/pos">
            <Plus size={18} /> New order
          </Link>
        )}
      </PageHeading>
      <div className="dashboard-filters">
        <div className="segment">
          {[
            ["today", "Today"],
            ["yesterday", "Yesterday"],
            ["week", "Last 7 days"],
            ["month", "Last 30 days"],
            ["custom", "Custom"],
          ].map(([v, label]) => (
            <button
              className={preset === v ? "active" : ""}
              key={v}
              onClick={() => {
                setPreset(v);
                if (v !== "custom") setRange(rangeFor(v));
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {preset === "custom" ? (
          <div className="date-range">
            <input
              aria-label="From date"
              type="date"
              onChange={(e) => {
                if (e.target.value)
                  setRange({
                    ...range,
                    from: new Date(e.target.value + "T00:00:00").toISOString(),
                  });
              }}
            />
            <span>to</span>
            <input
              aria-label="To date"
              type="date"
              onChange={(e) => {
                if (e.target.value)
                  setRange({
                    ...range,
                    to: new Date(e.target.value + "T23:59:59").toISOString(),
                  });
              }}
            />
          </div>
        ) : (
          <span className="muted date-label">
            {new Date(range.from).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })}{" "}
            —{" "}
            {new Date(range.to).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
        )}
      </div>
      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorState error={error} retry={reload} />
      ) : (
        r && (
          <>
            <div className="stats-grid">
              <StatCard
                label="Total sales"
                value={fmt(r.sales)}
                icon={IndianRupee}
                detail="Recorded payments in this period"
              />
              <StatCard
                label="Orders paid"
                value={r.ordersCount}
                icon={ShoppingBag}
                detail="Across POS and QR ordering"
              />
              <StatCard
                label="Average order"
                value={fmt(r.averageOrder)}
                icon={TrendingUp}
                detail="Sales per paid order"
              />
              <StatCard
                label="Active tables"
                value={r.activeTables}
                icon={UtensilsCrossed}
                detail="Currently welcoming guests"
              />
              <StatCard
                label="Pending orders"
                value={r.pending}
                icon={Clock}
                detail="In your live order queue"
              />
              <StatCard
                label="Low stock items"
                value={r.lowStock.length}
                icon={Package}
                detail="Ingredients that need attention"
              />
            </div>
            <div className="chart-grid">
              <section className="panel chart-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Sales overview</h2>
                    <p>Your cafe’s rhythm, day by day</p>
                  </div>
                  <span className="chart-legend">
                    <i /> Revenue
                  </span>
                </div>
                <div className="chart-big">
                  {fmt(r.sales)}
                  <small>in the selected period</small>
                </div>
                {r.daily.length ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart
                      data={r.daily}
                      margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="salesFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#c98b5f"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="100%"
                            stopColor="#c98b5f"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="4 4"
                        vertical={false}
                        stroke="#eee9e5"
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) =>
                          new Date(v).toLocaleDateString("en", {
                            month: "short",
                            day: "numeric",
                          })
                        }
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#8b8b86" }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#8b8b86" }}
                        tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                      />
                      <Tooltip formatter={(v) => fmt(v)} />
                      <Area
                        isAnimationActive={false}
                        type="monotone"
                        dataKey="sales"
                        stroke="#a56f4a"
                        strokeWidth={3}
                        fill="url(#salesFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    title="Your next sale starts the story"
                    description="Record an order payment to see revenue here."
                  />
                )}
              </section>
              <section className="panel chart-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Sales by category</h2>
                    <p>What your guests are loving</p>
                  </div>
                </div>
                {r.categories.length ? (
                  <>
                    <ResponsiveContainer width="100%" height={210}>
                      <PieChart>
                        <Pie
                          isAnimationActive={false}
                          data={r.categories}
                          dataKey="value"
                          innerRadius={62}
                          outerRadius={86}
                          paddingAngle={4}
                          stroke="none"
                        >
                          {r.categories.map((c, i) => (
                            <Cell
                              key={c.name}
                              fill={colors[i % colors.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="donut-legend">
                      {r.categories.map((c, i) => (
                        <div key={c.name}>
                          <span>
                            <i
                              style={{ background: colors[i % colors.length] }}
                            />
                            {c.name}
                          </span>
                          <b>{fmt(c.value)}</b>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <EmptyState title="No category sales yet" />
                )}
              </section>
            </div>
            {reports ? (
              <section className="panel">
                <div className="category-tabs report-tabs">
                  {[
                    "sales",
                    "orders",
                    "products",
                    "categories",
                    "inventory",
                    "lowstock",
                    "payments",
                    "expenses",
                    "profit",
                  ].map((t) => (
                    <button
                      key={t}
                      className={t === tab ? "active" : ""}
                      onClick={() => setTab(t)}
                    >
                      {t === "lowstock" ? "Low stock" : title(t)}
                    </button>
                  ))}
                </div>
                {tab === "profit" && (
                  <p className="callout">
                    Estimate = sales excluding tax, less recorded ingredient
                    costs and expenses. Avoid counting ingredient purchases
                    twice in expenses and recipe costs. This is an operational
                    estimate, not an accounting statement.
                  </p>
                )}
                {reportRows?.length ? (
                  <Table
                    rows={reportRows}
                    columns={Object.keys(reportRows[0]).map((k) => ({
                      key: k,
                      label: title(k.replace(/([A-Z])/g, " $1")),
                      render: (row) =>
                        typeof row[k] === "number"
                          ? Number(row[k].toFixed(2)).toLocaleString()
                          : row[k],
                    }))}
                  />
                ) : (
                  <EmptyState title="No records for this period" />
                )}
              </section>
            ) : (
              <div className="chart-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Recent orders</h2>
                      <p>A little look at the latest</p>
                    </div>
                    <Link className="text-link" to="/orders">
                      View all <ArrowRight size={15} />
                    </Link>
                  </div>
                  <Table
                    rows={r.recentOrders}
                    columns={[
                      {
                        key: "number",
                        label: "Order",
                        render: (o) => <strong>{o.number}</strong>,
                      },
                      {
                        key: "tableName",
                        label: "Table",
                        render: (o) => o.tableName || title(o.type),
                      },
                      {
                        key: "total",
                        label: "Total",
                        render: (o) => fmt(o.total),
                      },
                      {
                        key: "status",
                        label: "Status",
                        render: (o) => (
                          <Badge status={o.status}>{title(o.status)}</Badge>
                        ),
                      },
                    ]}
                  />
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Best on the menu</h2>
                      <p>Your best-selling favorites</p>
                    </div>
                    <ArrowUpRight size={19} />
                  </div>
                  {r.products.slice(0, 5).map((p, i) => (
                    <div className="top-product" key={p.name}>
                      <span className="rank">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <strong>{p.name}</strong>
                        <small>{p.quantity} sold</small>
                      </div>
                      <b>{fmt(p.sales)}</b>
                    </div>
                  ))}
                  {!r.products.length && (
                    <EmptyState title="Waiting for your first sale" />
                  )}
                </section>
              </div>
            )}
            <div className="three-grid">
              <section className="panel chart-panel">
                <div className="panel-heading">
                  <h2>Order trends</h2>
                </div>
                {r.daily.length ? (
                  <ResponsiveContainer width="100%" height={170}>
                    <BarChart data={r.daily}>
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => new Date(v).getDate()}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip />
                      <Bar
                        isAnimationActive={false}
                        dataKey="orders"
                        fill="#c98b5f"
                        radius={[5, 5, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="muted">No paid orders in this period.</p>
                )}
              </section>
              <section className="panel chart-panel">
                <div className="panel-heading">
                  <h2>Payment methods</h2>
                </div>
                {r.payments.map((p) => (
                  <div className="payment-breakdown" key={p.name}>
                    <div className="flex-between">
                      <span>{p.name.toUpperCase()}</span>
                      <b>{fmt(p.value)}</b>
                    </div>
                    <div className="progress-track">
                      <i
                        style={{
                          width: `${r.sales ? (p.value / r.sales) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
                {!r.payments.length && (
                  <p className="muted">No payments in this period.</p>
                )}
              </section>
              <section className="panel chart-panel stock-alerts">
                <div className="panel-heading">
                  <h2>Stock watch</h2>
                  <Badge status="warning">{r.lowStock.length} alerts</Badge>
                </div>
                {r.lowStock.slice(0, 4).map((i) => (
                  <div className="stock-alert" key={i._id}>
                    <span>{i.name}</span>
                    <strong>
                      {i.quantity.toFixed(1)} {i.unit}
                    </strong>
                  </div>
                ))}
                {!r.lowStock.length && (
                  <p className="muted">
                    All ingredients are above their thresholds.
                  </p>
                )}
                <Link to="/inventory" className="text-link">
                  Manage inventory <ArrowRight size={14} />
                </Link>
              </section>
            </div>
          </>
        )
      )}
    </>
  );
}

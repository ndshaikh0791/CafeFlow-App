import { uniqueId } from "../utils/id";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { io } from "socket.io-client";
import toast from "react-hot-toast";
import {
  Coffee,
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  ChefHat,
  BookOpen,
  Shapes,
  Grid2X2,
  Package,
  NotebookPen,
  Users,
  UserRoundCog,
  Receipt,
  ChartNoAxesCombined,
  Tag,
  Settings,
  Search,
  Bell,
  ChevronDown,
  Menu,
  PanelLeftClose,
  LogOut,
  X,
  MapPin,
} from "lucide-react";
import { api, message } from "../services/api";
import { setUser, clearCart } from "../store";
import { useData, refresh } from "../hooks/useData";
import { Modal, EmptyState } from "../components/ui";
const links = [
  ["dashboard", "Dashboard", LayoutDashboard, "manage"],
  ["pos", "Point of sale", ShoppingCart, "operate"],
  ["orders", "Orders", ClipboardList, "operate"],
  ["kitchen", "Kitchen display", ChefHat, "kitchen"],
  ["products", "Menu", BookOpen, "manage"],
  ["categories", "Categories", Shapes, "manage"],
  ["tables", "Tables & QR", Grid2X2, "manage"],
  ["inventory", "Inventory", Package, "manage"],
  ["recipes", "Recipes", NotebookPen, "manage"],
  ["customers", "Customers", Users, "operate"],
  ["staff", "Staff", UserRoundCog, "owner"],
  ["expenses", "Expenses", Receipt, "manage"],
  ["reports", "Reports", ChartNoAxesCombined, "manage"],
  ["discounts", "Offers & discounts", Tag, "manage"],
  ["settings", "Settings", Settings, "owner"],
];
export const permitted = (role, scope) =>
  scope === "all" ||
  (scope === "kitchen" && ["owner", "manager", "kitchen"].includes(role)) ||
  (scope === "owner" && role === "owner") ||
  (scope === "manage" && ["owner", "manager"].includes(role)) ||
  (scope === "operate" && ["owner", "manager", "cashier"].includes(role));
export default function AdminLayout() {
  const user = useSelector((s) => s.auth.user),
    dispatch = useDispatch(),
    navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [notifications, setNotifications] = useState([]),
    [showNotifications, setShowNotifications] = useState(false),
    [profile, setProfile] = useState(false),
    [search, setSearch] = useState("");
  const { data: settings } = useData(
    user.role === "kitchen" ? null : "/settings",
  );
  const { data: stock } = useData(
    ["owner", "manager"].includes(user.role)
      ? "/inventory?low=true&limit=5"
      : null,
  );
  useEffect(() => {
    const socket = io({ withCredentials: true });
    socket.on("refresh", (event) => {
      refresh();
      if (event.message) {
        setNotifications((n) =>
          [
            {
              ...event,
              time: new Date().toISOString(),
              id: uniqueId(),
            },
            ...n,
          ].slice(0, 30),
        );
        if (
          ["New QR order", "New kitchen order", "Order ready"].includes(
            event.message,
          )
        )
          toast(event.number + " · " + event.message, { icon: "•" });
      }
    });
    return () => socket.disconnect();
  }, []);
  async function logout() {
    try {
      await api.post("/auth/logout");
      dispatch(setUser(null));
      dispatch(clearCart());
      navigate("/login");
    } catch (e) {
      toast.error(message(e));
    }
  }
  const available = links.filter((l) => permitted(user.role, l[3]));
  return (
    <div className={`app-layout ${collapsed ? "collapsed" : ""}`}>
      {mobile && (
        <div className="sidebar-backdrop" onClick={() => setMobile(false)} />
      )}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <NavLink
          to={
            user.role === "kitchen"
              ? "/kitchen"
              : user.role === "cashier"
                ? "/pos"
                : "/dashboard"
          }
          className="brand"
        >
          <span className="brand-icon">
            <Coffee size={24} />
          </span>
          <div className="brand-text">
            <strong>CafeFlow</strong>
            <small>A LITTLE MORE FLOW.</small>
          </div>
        </NavLink>
        <div className="sidebar-section">WORKSPACE</div>
        <nav>
          {available.map(([path, label, Icon], i) => (
            <NavLink
              key={path}
              to={`/${path}`}
              onClick={() => setMobile(false)}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""} ${["products", "customers", "reports"].includes(path) ? "nav-divider" : ""}`
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={19} />
              <span>{label}</span>
              {path === "pos" && <small>POS</small>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="cafe-status">
            <span className="status-dot" />
            <div>
              <strong>Made for your everyday</strong>
              <small>One good order at a time.</small>
            </div>
          </div>
          <button
            className="collapse-button"
            onClick={() => setCollapsed(!collapsed)}
          >
            <PanelLeftClose size={18} />
            <span>Collapse sidebar</span>
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Menu size={22} />
          </button>
          <div className="global-search">
            <Search size={17} />
            <input
              placeholder="Find a page…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <div className="search-results">
                {available
                  .filter((l) =>
                    l[1].toLowerCase().includes(search.toLowerCase()),
                  )
                  .map(([p, l]) => (
                    <NavLink to={`/${p}`} key={p} onClick={() => setSearch("")}>
                      {l}
                    </NavLink>
                  ))}
                {!available.some((l) =>
                  l[1].toLowerCase().includes(search.toLowerCase()),
                ) && <span>No matching pages</span>}
              </div>
            )}
          </div>
          <div className="topbar-right">
            <div className="branch">
              <MapPin size={16} />
              <span>
                {settings?.name || "CafeFlow"}
                <small>Main cafe</small>
              </span>
            </div>
            <div className="header-divider" />
            <button
              className="icon-btn notification-btn"
              title="Notifications"
              onClick={() => setShowNotifications(true)}
            >
              <Bell size={20} />
              {(notifications.length > 0 || stock?.length > 0) && <i />}
            </button>
            <div className="profile-wrap">
              <button
                className="profile-button"
                onClick={() => setProfile(!profile)}
              >
                <span className="avatar">
                  {user.name
                    .split(" ")
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <span>
                  {user.name}
                  <small>
                    {user.role === "owner" ? "Cafe owner" : user.role}
                  </small>
                </span>
                <ChevronDown size={15} />
              </button>
              {profile && (
                <div className="profile-menu">
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                  <button onClick={logout}>
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="main-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>CafeFlow · Made for a better everyday.</span>
          <span>
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </footer>
      </div>
      {showNotifications && (
        <Modal
          title="Your cafe, in the loop"
          onClose={() => setShowNotifications(false)}
        >
          {!notifications.length && !stock?.length ? (
            <EmptyState
              title="You’re all caught up"
              description="New orders, ready tickets, and stock alerts appear here."
            />
          ) : (
            <>
              {stock?.map((s) => (
                <div key={s._id} className="notification">
                  <Package size={19} />
                  <div>
                    <strong>Low stock · {s.name}</strong>
                    <p>
                      {s.quantity} {s.unit} remaining
                    </p>
                    <NavLink
                      to="/inventory"
                      onClick={() => setShowNotifications(false)}
                    >
                      View inventory
                    </NavLink>
                  </div>
                </div>
              ))}
              {notifications.map((n) => (
                <div className="notification" key={n.id}>
                  <Bell size={18} />
                  <div>
                    <strong>
                      {n.number} · {n.message}
                    </strong>
                    <small>{new Date(n.time).toLocaleTimeString()}</small>
                  </div>
                </div>
              ))}
              {notifications.length > 0 && (
                <button
                  className="btn secondary"
                  onClick={() => setNotifications([])}
                >
                  Clear session notifications
                </button>
              )}
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

import { useEffect, lazy, Suspense } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Routes, Route, Navigate, Outlet, Link } from "react-router-dom";
import { api } from "./services/api";
import { setUser, clearCart } from "./store";
import AdminLayout, { permitted } from "./layouts/AdminLayout";
import Auth from "./pages/Auth";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const POS = lazy(() => import("./pages/POS"));
const Orders = lazy(() => import("./pages/Orders"));
const Resources = lazy(() => import("./pages/Resources"));
const Settings = lazy(() => import("./pages/Settings"));
const CustomerMenu = lazy(() => import("./pages/CustomerMenu"));
const Tracking = lazy(() =>
  import("./pages/CustomerMenu").then((m) => ({ default: m.Tracking })),
);
import { Loader } from "./components/ui";
function Guard({ scope = "all" }) {
  const { user, loading } = useSelector((s) => s.auth);
  if (loading)
    return (
      <div className="startup">
        <Loader />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (!permitted(user.role, scope))
    return (
      <Navigate
        to={
          user.role === "kitchen"
            ? "/kitchen"
            : user.role === "cashier"
              ? "/pos"
              : "/dashboard"
        }
        replace
      />
    );
  return <Outlet />;
}
function Home() {
  const user = useSelector((s) => s.auth.user);
  return (
    <Navigate
      to={
        user?.role === "kitchen"
          ? "/kitchen"
          : user?.role === "cashier"
            ? "/pos"
            : "/dashboard"
      }
      replace
    />
  );
}
export default function App() {
  const dispatch = useDispatch();
  useEffect(() => {
    const expire = () => {
      dispatch(setUser(null));
      dispatch(clearCart());
    };
    window.addEventListener("cf-session-expired", expire);
    return () => window.removeEventListener("cf-session-expired", expire);
  }, [dispatch]);
  useEffect(() => {
    if (
      /^\/(login|forgot-password|reset-password|menu|track)(\/|$)/.test(
        window.location.pathname,
      )
    ) {
      dispatch(setUser(null));
      return;
    }
    api
      .get("/auth/me")
      .then((r) => dispatch(setUser(r.data.data)))
      .catch(() => dispatch(setUser(null)));
  }, [dispatch]);
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="/forgot-password" element={<Auth mode="forgot" />} />
        <Route path="/reset-password" element={<Auth mode="reset" />} />
        <Route path="/menu/:tableId" element={<CustomerMenu />} />
        <Route path="/track/:token" element={<Tracking />} />
        <Route element={<Guard />}>
          <Route element={<AdminLayout />}>
            <Route index element={<Home />} />
            <Route element={<Guard scope="kitchen" />}>
              <Route path="/kitchen" element={<Orders kitchen />} />
            </Route>
            <Route element={<Guard scope="operate" />}>
              <Route path="/pos" element={<POS />} />
              <Route path="/orders" element={<Orders />} />
              <Route
                path="/customers"
                element={<Resources key="customers" resource="customers" />}
              />
            </Route>
            <Route element={<Guard scope="manage" />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/reports" element={<Dashboard reports />} />
              {[
                "products",
                "categories",
                "tables",
                "inventory",
                "recipes",
                "expenses",
                "discounts",
              ].map((r) => (
                <Route
                  key={r}
                  path={`/${r}`}
                  element={<Resources key={r} resource={r} />}
                />
              ))}
            </Route>
            <Route element={<Guard scope="owner" />}>
              <Route
                path="/staff"
                element={<Resources key="staff" resource="staff" />}
              />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>
        </Route>
        <Route
          path="*"
          element={
            <div className="not-found">
              <h1>This page is off the menu.</h1>
              <Link className="btn primary" to="/">
                Back to your cafe
              </Link>
            </div>
          }
        />
      </Routes>
    </Suspense>
  );
}

import { useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Coffee, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { api, message } from "../services/api";
import { setUser } from "../store";
import { Button } from "../components/ui";
export default function Auth({ mode = "login" }) {
  const { register, handleSubmit } = useForm();
  const [busy, setBusy] = useState(false),
    [show, setShow] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  const dispatch = useDispatch(),
    navigate = useNavigate(),
    [params] = useSearchParams();
  async function submit(values) {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post(
        `/auth/${mode === "login" ? "login" : mode === "forgot" ? "forgot-password" : "reset-password"}`,
        {
          ...values,
          ...(mode === "reset" ? { token: params.get("token") } : {}),
        },
      );
      if (mode === "login") {
        dispatch(setUser(data.data));
        navigate(
          data.data.role === "kitchen"
            ? "/kitchen"
            : data.data.role === "cashier"
              ? "/pos"
              : "/dashboard",
        );
      } else {
        setDone(true);
        toast.success(
          mode === "forgot"
            ? data.data.message
            : "Password updated. You can now sign in.",
        );
      }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Link to="/login" className="brand">
          <span className="brand-icon">
            <Coffee size={25} />
          </span>
          <strong>
            CafeFlow<span>OPERATE WITH A LITTLE MORE EASE</span>
          </strong>
        </Link>
        <div>
          <span className="auth-label">FOR THE LOVE OF THE EVERYDAY</span>
          <h1>
            Good mornings.
            <br />
            Great service.
            <br />
            <em>All in a day’s flow.</em>
          </h1>
          <p>
            From the first coffee to the last happy guest,
            <br />a little more space to do what you love.
          </p>
        </div>
        <div className="auth-art">
          <div className="cup-top" />
          <div className="cup-body">
            <Coffee size={70} strokeWidth={1} />
          </div>
          <div className="saucer" />
          <span className="bean bean-one" />
          <span className="bean bean-two" />
        </div>
        <footer>
          Thoughtfully built for the places that bring people together.
        </footer>
      </section>
      <section className="auth-form-wrap">
        <div className="auth-form">
          <small className="eyebrow">YOUR CAFE. IN GOOD HANDS.</small>
          <h2>
            {mode === "login"
              ? "Welcome back."
              : mode === "forgot"
                ? "Let’s get you back in."
                : "A fresh start."}
          </h2>
          <p className="muted">
            {mode === "login"
              ? "Sign in to see what’s brewing today."
              : mode === "forgot"
                ? "Enter the email connected to your staff account."
                : "Choose a new password of at least 10 characters."}
          </p>
          {done ? (
            <div className="callout">
              {mode === "forgot"
                ? "If the account exists, a reset link has been sent."
                : "Your password has been updated."}
              <p>
                <Link to="/login">Return to sign in</Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(submit)}>
              {mode !== "reset" && (
                <label className="field">
                  Email address
                  <input
                    autoComplete="username"
                    type="email"
                    required
                    placeholder="you@yourcafe.com"
                    {...register("email")}
                  />
                </label>
              )}
              {mode !== "forgot" && (
                <label className="field">
                  Password
                  <div className="password-field">
                    <input
                      type={show ? "text" : "password"}
                      minLength={mode === "reset" ? 10 : undefined}
                      maxLength={100}
                      required
                      autoComplete={
                        mode === "reset" ? "new-password" : "current-password"
                      }
                      placeholder="Enter your password"
                      {...register("password")}
                    />
                    <button
                      type="button"
                      aria-label={show ? "Hide password" : "Show password"}
                      onClick={() => setShow(!show)}
                    >
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
              )}
              {mode === "login" && (
                <div className="auth-help">
                  <span>Secure staff access</span>
                  <Link to="/forgot-password">Forgot password?</Link>
                </div>
              )}
              {error && (
                <p role="alert" className="error-box">
                  {error}
                </p>
              )}
              <Button className="full-width" loading={busy}>
                {mode === "login"
                  ? "Sign in"
                  : mode === "forgot"
                    ? "Send reset link"
                    : "Update password"}
                <ArrowRight size={17} />
              </Button>
              {mode !== "login" && (
                <Link className="back-login" to="/login">
                  Back to sign in
                </Link>
              )}
            </form>
          )}
          <p className="auth-footnote">A smoother day starts here.</p>
        </div>
      </section>
    </div>
  );
}

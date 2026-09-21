import { useState } from "react";
import { Banknote, CreditCard, Smartphone, Split } from "lucide-react";
import toast from "react-hot-toast";
import { api, message } from "../services/api";
import { refresh } from "../hooks/useData";
import { Modal, Button } from "./ui";
import { money } from "../utils/format";
export default function PaymentModal({ order, onClose, onPaid, currency }) {
  const [method, setMethod] = useState("cash"),
    [cash, setCash] = useState(""),
    [second, setSecond] = useState("upi"),
    [reference, setReference] = useState(""),
    [busy, setBusy] = useState(false);
  async function pay() {
    setBusy(true);
    try {
      const payments =
        method === "split"
          ? [
              { method: "cash", amount: Number(cash) },
              {
                method: second,
                amount: Math.round((order.total - Number(cash)) * 100) / 100,
                reference,
              },
            ]
          : [{ method, amount: order.total, reference }];
      const { data } = await api.post(`/orders/${order._id}/pay`, { payments });
      toast.success("Payment recorded · inventory updated");
      refresh();
      onPaid(data.data);
      onClose();
    } catch (e) {
      toast.error(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={`Payment · ${order.number}`} onClose={onClose}>
      <div className="payment-total">
        <span>Amount due</span>
        <strong>{money(order.total, currency)}</strong>
      </div>
      <div className="payment-methods">
        {[
          ["cash", Banknote],
          ["upi", Smartphone],
          ["card", CreditCard],
          ["split", Split],
        ].map(([m, Icon]) => (
          <button
            key={m}
            className={method === m ? "selected" : ""}
            onClick={() => setMethod(m)}
          >
            <Icon size={22} />
            {m.toUpperCase()}
          </button>
        ))}
      </div>
      {method === "split" && (
        <>
          <label className="field">
            Cash portion
            <input
              type="number"
              min="0.01"
              max={order.total - 0.01}
              step="0.01"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
            />
          </label>
          <label className="field">
            Remaining {money(order.total - Number(cash), currency)}
            <select value={second} onChange={(e) => setSecond(e.target.value)}>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
            </select>
          </label>
        </>
      )}
      {method !== "cash" && (
        <label className="field">
          Transaction reference (optional)
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Reference from your terminal or UPI app"
          />
        </label>
      )}
      <p className="callout">
        Confirm only after you receive the money. This records a payment; it
        does not charge a card or UPI account.
      </p>
      <Button
        className="full-width"
        loading={busy}
        disabled={
          method === "split" &&
          !(Number(cash) > 0 && Number(cash) < order.total)
        }
        onClick={pay}
      >
        Confirm payment · {money(order.total, currency)}
      </Button>
    </Modal>
  );
}

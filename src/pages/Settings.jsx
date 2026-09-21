import { useState } from "react";
import toast from "react-hot-toast";
import { useData, refresh } from "../hooks/useData";
import { api, message } from "../services/api";
import { PageHeading, Loader, ErrorState, Button } from "../components/ui";
const sections = [
  [
    "Cafe profile",
    [
      ["name", "Cafe name"],
      ["logo", "Logo URL"],
      ["phone", "Phone"],
      ["email", "Email"],
      ["address", "Address"],
    ],
  ],
  [
    "Business",
    [
      ["currency", "Currency", "select", ["INR", "USD", "EUR", "GBP"]],
      ["timezone", "Timezone"],
      ["tax", "Default product tax / GST (%)", "number"],
      ["serviceCharge", "Service charge (%)", "number"],
    ],
  ],
  [
    "Orders",
    [
      ["orderPrefix", "Order number prefix"],
      [
        "defaultOrderType",
        "Default order type",
        "select",
        ["dine-in", "takeaway", "delivery"],
      ],
      ["allowNegativeStock", "Allow negative inventory", "checkbox"],
    ],
  ],
  [
    "Receipt",
    [
      ["receiptHeader", "Header message"],
      ["receiptFooter", "Footer message"],
      ["receiptSize", "Paper size (mm)", "select", ["58", "80"]],
      ["showTax", "Show tax on receipt", "checkbox"],
    ],
  ],
  ["QR ordering", [["qrEnabled", "Enable table QR ordering", "checkbox"]]],
  [
    "Loyalty",
    [
      ["loyaltyEnabled", "Enable loyalty points", "checkbox"],
      ["pointsPerAmount", "Spend needed to earn one point", "number"],
      ["minRedeem", "Minimum points to redeem", "number"],
      ["pointValue", "Value of one point", "number"],
    ],
  ],
];
export default function Settings() {
  const { data, loading, error, reload } = useData("/settings");
  return (
    <>
      <PageHeading
        title="Settings"
        description="Make CafeFlow feel right at home."
      />
      {loading ? (
        <Loader />
      ) : error ? (
        <ErrorState error={error} retry={reload} />
      ) : (
        <SettingsForm initial={data} />
      )}
    </>
  );
}
function SettingsForm({ initial }) {
  const [values, setValues] = useState(initial),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api.put("/settings", values);
          refresh();
          toast.success("Settings saved");
        } catch (e) {
          toast.error(message(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="settings-grid">
        {sections.map(([name, fields]) => (
          <section className="panel settings-section" key={name}>
            <h2>{name}</h2>
            <div className="form-grid">
              {fields.map(([key, label, type = "text", options]) => (
                <label
                  className={`field ${type === "checkbox" ? "check-field" : ""}`}
                  key={key}
                >
                  <span>{label}</span>
                  {type === "select" ? (
                    <select
                      value={values[key]}
                      onChange={(e) =>
                        setValues({ ...values, [key]: e.target.value })
                      }
                    >
                      {options.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={type}
                      required={
                        type === "number" ||
                        key === "name" ||
                        key === "timezone"
                      }
                      min={0}
                      step="any"
                      checked={type === "checkbox" ? values[key] : undefined}
                      value={
                        type === "checkbox" ? undefined : (values[key] ?? "")
                      }
                      onChange={(e) =>
                        setValues({
                          ...values,
                          [key]:
                            type === "checkbox"
                              ? e.target.checked
                              : type === "number"
                                ? Number(e.target.value)
                                : e.target.value,
                        })
                      }
                    />
                  )}
                </label>
              ))}
            </div>
            {name === "Business" && (
              <small className="muted">
                Product tax rates are stored on each menu item. Update existing
                products in Menu. Date filters use your device timezone; daily
                report buckets use your configured cafe timezone.
              </small>
            )}
          </section>
        ))}
      </div>
      <div className="settings-save">
        <Button loading={busy}>Save settings</Button>
      </div>
    </form>
  );
}

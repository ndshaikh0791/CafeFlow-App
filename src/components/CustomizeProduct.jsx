import { useState } from "react";
import { Modal, Button } from "./ui";
import { money } from "../utils/format";
export default function CustomizeProduct({
  product,
  onClose,
  onAdd,
  currency,
}) {
  const [variant, setVariant] = useState(product.variants?.[0]?.name || ""),
    [addons, setAddons] = useState([]),
    [modifiers, setModifiers] = useState([]),
    [quantity, setQuantity] = useState(1),
    [notes, setNotes] = useState("");
  const price =
    (product.variants?.find((v) => v.name === variant)?.price ??
      product.price) +
    product.addons
      .filter((a) => addons.includes(a.name))
      .reduce((s, a) => s + a.price, 0);
  return (
    <Modal title={product.name} onClose={onClose}>
      <p className="muted">{product.description}</p>
      {product.variants?.length > 0 && (
        <label className="field">
          Size
          <select
            aria-label="Size"
            value={variant}
            onChange={(e) => setVariant(e.target.value)}
          >
            {product.variants.map((v) => (
              <option key={v.name}>{v.name}</option>
            ))}
          </select>
        </label>
      )}
      {product.addons?.length > 0 && (
        <fieldset>
          <legend>Make it yours</legend>
          {product.addons.map((a) => (
            <label key={a.name} className="option-row">
              <span>
                <input
                  type="checkbox"
                  checked={addons.includes(a.name)}
                  onChange={(e) =>
                    setAddons(
                      e.target.checked
                        ? [...addons, a.name]
                        : addons.filter((n) => n !== a.name),
                    )
                  }
                />{" "}
                {a.name}
              </span>
              <span>+{money(a.price, currency)}</span>
            </label>
          ))}
        </fieldset>
      )}
      {product.modifiers?.length > 0 && (
        <fieldset>
          <legend>Preferences</legend>
          {product.modifiers.map((m) => (
            <label key={m} className="option-row">
              <span>
                <input
                  type="checkbox"
                  checked={modifiers.includes(m)}
                  onChange={(e) =>
                    setModifiers(
                      e.target.checked
                        ? [...modifiers, m]
                        : modifiers.filter((n) => n !== m),
                    )
                  }
                />{" "}
                {m}
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <label className="field">
        Special instructions
        <textarea
          maxLength={500}
          placeholder="Anything we should know?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      <div className="flex-between">
        <div className="quantity">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span>{quantity}</span>
          <button
            onClick={() => setQuantity(Math.min(100, quantity + 1))}
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
        <Button
          onClick={() => {
            onAdd({
              product: product._id,
              name: product.name,
              price,
              tax: product.tax,
              quantity,
              variant,
              addons,
              modifiers,
              notes,
              image: product.image,
            });
            onClose();
          }}
        >
          Add to order · {money(price * quantity, currency)}
        </Button>
      </div>
    </Modal>
  );
}

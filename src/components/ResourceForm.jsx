import { useState } from "react";
import { useForm } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { useCollection } from "../hooks/useData";
import { Button } from "./ui";
import { title } from "../utils/format";
function FieldWrapper({ complex, ...props }) {
  return complex ? <div {...props} /> : <label {...props} />;
}
function Relation({ field, register, value }) {
  const { data, error } = useCollection(`/${field.resource}`);
  return (
    <>
      <select
        aria-label={field.label}
        {...register(field.key, { required: !field.optional })}
        value={value || ""}
      >
        <option value="">Select {field.label.toLowerCase()}</option>
        {data?.map((v) => (
          <option key={v._id} value={v._id}>
            {v.name}
          </option>
        ))}
      </select>
      {error && <small className="error">{error}</small>}
    </>
  );
}
function ListEditor({ field, value = [], onChange }) {
  const { data: ingredients } = useCollection(
    field.type === "ingredients" ? "/inventory" : null,
  );
  return (
    <div className="list-editor">
      {value.map((row, i) => (
        <div className="list-row" key={i}>
          {field.type === "ingredients" ? (
            <select
              aria-label="Ingredient"
              required
              value={row.ingredient?._id || row.ingredient || ""}
              onChange={(e) =>
                onChange(
                  value.map((r, n) =>
                    n === i ? { ...r, ingredient: e.target.value } : r,
                  ),
                )
              }
            >
              <option value="">Choose ingredient</option>
              {ingredients?.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.name} ({v.unit})
                </option>
              ))}
            </select>
          ) : (
            <input
              aria-label="Option name"
              required
              placeholder="Name"
              value={row.name}
              onChange={(e) =>
                onChange(
                  value.map((r, n) =>
                    n === i ? { ...r, name: e.target.value } : r,
                  ),
                )
              }
            />
          )}
          <input
            aria-label={field.type === "ingredients" ? "Quantity" : "Price"}
            required
            type="number"
            min={field.type === "ingredients" ? 0.000001 : 0}
            step="any"
            placeholder={field.type === "ingredients" ? "Quantity" : "Price"}
            value={row.quantity ?? row.price}
            onChange={(e) =>
              onChange(
                value.map((r, n) =>
                  n === i
                    ? {
                        ...r,
                        [field.type === "ingredients" ? "quantity" : "price"]:
                          Number(e.target.value),
                      }
                    : r,
                ),
              )
            }
          />
          <button
            type="button"
            className="icon-btn"
            aria-label="Remove row"
            onClick={() => onChange(value.filter((_, n) => n !== i))}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() =>
          onChange([
            ...value,
            field.type === "ingredients"
              ? { ingredient: "", quantity: 1 }
              : { name: "", price: 0 },
          ])
        }
      >
        <Plus size={16} /> Add{" "}
        {field.type === "ingredients" ? "ingredient" : "option"}
      </Button>
      {field.type === "ingredients" && (
        <small>
          Quantities use each ingredient’s inventory unit. These are deducted
          when payment is recorded.
        </small>
      )}
    </div>
  );
}
export default function ResourceForm({ config, record, onSubmit, saving }) {
  const defaults = Object.fromEntries(
    config.fields.map((f) => {
      let v =
        record?.[f.key] ??
        f.default ??
        (["number"].includes(f.type)
          ? 0
          : f.type === "checkbox"
            ? false
            : f.type === "select"
              ? f.options[0]
              : ["options", "ingredients"].includes(f.type)
                ? []
                : "");
      if (f.type === "relation") v = v?._id || v;
      if (f.type === "tags") v = Array.isArray(v) ? v.join(", ") : v;
      if ((f.type === "date" || f.type === "datetime-local") && v)
        v = new Date(v).toISOString().slice(0, f.type === "date" ? 10 : 16);
      return [f.key, v];
    }),
  );
  const {
    register,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues: defaults });
  const [lists, setLists] = useState(
    Object.fromEntries(
      config.fields
        .filter((f) => ["options", "ingredients"].includes(f.type))
        .map((f) => [f.key, defaults[f.key]]),
    ),
  );
  return (
    <form
      onSubmit={handleSubmit((values) => {
        for (const f of config.fields) {
          if (f.type === "number") values[f.key] = Number(values[f.key]);
          if (f.type === "tags")
            values[f.key] = values[f.key]
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          if (f.type === "password" && !values[f.key]) delete values[f.key];
        }
        onSubmit({
          ...values,
          ...Object.fromEntries(
            Object.entries(lists).map(([k, v]) => [
              k,
              v.map((r) => ({
                ...r,
                ingredient: r.ingredient?._id || r.ingredient,
              })),
            ]),
          ),
        });
      })}
      className="form-grid"
    >
      {config.fields
        .filter((f) => !(record && f.key === "quantity"))
        .map((f) => (
          <FieldWrapper
            complex={["options", "ingredients"].includes(f.type)}
            key={f.key}
            className={`field ${["textarea", "options", "ingredients", "tags"].includes(f.type) ? "full" : ""} ${f.type === "checkbox" ? "check-field" : ""}`}
          >
            <span>{f.label}</span>
            {["options", "ingredients"].includes(f.type) ? (
              <ListEditor
                field={f}
                value={lists[f.key]}
                onChange={(v) => setLists({ ...lists, [f.key]: v })}
              />
            ) : f.type === "relation" ? (
              <Relation field={f} register={register} value={watch(f.key)} />
            ) : f.type === "select" ? (
              <select {...register(f.key)}>
                {f.options.map((v) => (
                  <option key={v} value={v}>
                    {title(v)}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea {...register(f.key)} rows={3} />
            ) : (
              <input
                type={f.type === "tags" ? "text" : f.type}
                min={f.min ?? 0}
                max={f.max}
                step="any"
                minLength={f.type === "password" ? 10 : undefined}
                {...register(f.key, {
                  required:
                    (f.key === "password" && !record) ||
                    (["name", "title", "sku", "email", "code"].includes(
                      f.key,
                    ) &&
                      !(config.singular === "customer" && f.key === "email")),
                })}
              />
            )}{" "}
            {errors[f.key] && (
              <small className="error">This field is required</small>
            )}
          </FieldWrapper>
        ))}
      <div className="full form-footer">
        <Button type="submit" loading={saving}>
          Save {config.singular}
        </Button>
      </div>
    </form>
  );
}

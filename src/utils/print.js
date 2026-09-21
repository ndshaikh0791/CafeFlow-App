const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function printDocument(html, width = "80") {
  const frame = document.createElement("iframe");
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(
    `<!doctype html><html><head><title>CafeFlow print</title><style>@page{size:${width}mm auto;margin:3mm}body{font-family:monospace;font-size:11px;width:${Number(width) - 8}mm;margin:0 auto;color:#000}h1{font-size:19px}h2{font-size:15px}p{margin:6px 0}.center{text-align:center}table{width:100%;border-collapse:collapse}td,th{padding:5px 0;text-align:left;vertical-align:top}td:last-child,th:last-child{text-align:right}.line{border-top:1px dashed #000;margin:10px 0}small{font-size:10px}img{max-width:100%}</style></head><body>${html}</body></html>`,
  );
  frame.onload = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 60000);
  };
  doc.close();
}
export function printReceipt(order, settings = {}, kot = false) {
  settings ||= {};
  const m = (n) =>
    `${order.currency || settings.currency || "INR"} ${Number(n || 0).toFixed(2)}`;
  printDocument(
    `<div class="center"><h1>${esc(settings.name || "CafeFlow")}</h1><p>${esc(kot ? "KITCHEN ORDER TICKET" : settings.receiptHeader)}</p>${!kot ? `<p>${esc(settings.address)}<br/>${esc(settings.phone)}</p>` : ""}<h2>${esc(order.number)}</h2></div><p>${esc(new Date(order.createdAt).toLocaleString())}<br/>${esc(order.tableName || order.type)} · ${esc(order.cashierName)}</p><div class="line"></div><table><thead><tr><th>Item</th><th>${kot ? "Qty" : "Amount"}</th></tr></thead><tbody>${order.items.map((i) => `<tr><td>${i.quantity} × ${esc(i.name)}<br/><small>${esc([i.variant, ...i.addons.map((a) => a.name), ...(i.modifiers || [])].filter(Boolean).join(", "))}${i.notes ? `<br/>Note: ${esc(i.notes)}` : ""}${!kot ? `<br/>${esc(m(i.price))} each` : ""}</small></td><td>${kot ? i.quantity : esc(m(i.quantity * i.price))}</td></tr>`).join("")}</tbody></table>${order.notes ? `<p>Instructions: ${esc(order.notes)}</p>` : ""}${!kot ? `<div class="line"></div><table>${[["Subtotal", order.subtotal], ["Discount", -order.discount], ...(settings.showTax !== false ? [["Tax / GST", order.tax]] : []), ["Service charge", order.serviceCharge], ["TOTAL", order.total]].map(([k, v]) => `<tr><td>${k}</td><td>${esc(m(v))}</td></tr>`).join("")}</table><p>${esc(order.paymentStatus.toUpperCase())} · ${esc(order.payments?.map((p) => `${p.method}: ${m(p.amount)}`).join(" / ") || "")}</p><div class="line"></div><p class="center">${esc(settings.receiptFooter || "Thank you for visiting!")}</p>` : ""}`,
    settings.receiptSize || "80",
  );
}
export function printQR({ row, image }) {
  printDocument(
    `<div class="center"><h1>Your table. Your favorites.</h1><h2>${esc(row.name)}</h2><img src="${image}" alt="Table QR"/><p>Scan to explore the menu and order.</p></div>`,
  );
}

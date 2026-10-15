export const fmtMoney = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(n);
  } catch {
    return n.toFixed(2);
  }
};

export function OrdersTable({
  rows,
}: {
  rows: {
    id: string;
    name: string | null;
    orderId: string | null;
    draftOrderId?: string | null;
    customer: string;
    phone: string;
    total: number;
    currency: string;
    status: string;
    createdAt: string;
  }[];
}) {
  return (
    <s-table>
      <s-table-header-row>
        <s-table-header>Order</s-table-header>
        <s-table-header>Customer</s-table-header>
        <s-table-header>Phone</s-table-header>
        <s-table-header>Total</s-table-header>
        <s-table-header>Status</s-table-header>
        <s-table-header>Date</s-table-header>
      </s-table-header-row>
      <s-table-body>
        {rows.map((o) => (
          <s-table-row key={o.id}>
            <s-table-cell>
              {o.orderId ? (
                <s-link href={`shopify://admin/orders/${o.orderId.split("/").pop()}`} target="_top">
                  {o.name || "View"}
                </s-link>
              ) : o.draftOrderId ? (
                <s-link href={`shopify://admin/draft_orders/${o.draftOrderId.split("/").pop()}`} target="_top">
                  {o.name || "Draft"}
                </s-link>
              ) : (
                o.name || "—"
              )}
            </s-table-cell>
            <s-table-cell>{o.customer}</s-table-cell>
            <s-table-cell>{o.phone}</s-table-cell>
            <s-table-cell>{fmtMoney(o.total, o.currency)}</s-table-cell>
            <s-table-cell>
              <s-badge tone={o.status === "created" ? "success" : o.status === "failed" ? "critical" : "neutral"}>
                {o.status}
              </s-badge>
            </s-table-cell>
            <s-table-cell>{new Date(o.createdAt).toLocaleString()}</s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  );
}


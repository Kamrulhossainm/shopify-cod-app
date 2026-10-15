/* eslint-disable @typescript-eslint/no-explicit-any -- untyped JSON from GraphQL and requests */
import { useAppBridge } from "@shopify/app-bridge-react";
import { Switch } from "./fields";

export interface PickedProduct {
  id: string;
  title: string;
  image?: string;
}

export function ProductScopePicker({
  all,
  products,
  onChange,
  label = "Apply to all products",
}: {
  all: boolean;
  products: PickedProduct[];
  onChange: (all: boolean, products: PickedProduct[]) => void;
  label?: string;
}) {
  const shopify = useAppBridge();
  const pick = async () => {
    const selected = await shopify.resourcePicker({
      type: "product",
      multiple: true,
      selectionIds: products.map((p) => ({ id: p.id })),
      filter: { variants: false },
    });
    if (selected) {
      onChange(
        false,
        selected.map((p: any) => ({ id: p.id, title: p.title, image: p.images?.[0]?.originalSrc })),
      );
    }
  };
  return (
    <s-stack gap="small-200">
      <Switch label={label} checked={all} onChange={(v) => onChange(v, products)} />
      {!all && (
        <>
          <s-stack direction="inline" gap="small-200">
            {products.map((p) => (
              <s-badge key={p.id}>{p.title}</s-badge>
            ))}
            {products.length === 0 && <s-text color="subdued">No products selected</s-text>}
          </s-stack>
          <s-stack direction="inline">
            <s-button icon="product" onClick={pick}>
              {products.length ? "Change products" : "Select products"}
            </s-button>
          </s-stack>
        </>
      )}
    </s-stack>
  );
}

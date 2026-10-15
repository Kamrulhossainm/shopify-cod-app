/* eslint-disable @typescript-eslint/no-explicit-any -- untyped JSON from GraphQL and requests */
import { round2, type AllSettings } from "./settings";
import { gql, type AdminGraphql, type PricedCart } from "./pricing.server";

export interface CustomerInput {
  firstName?: string;
  lastName?: string;
  phone: string;
  email?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  zip?: string;
  country?: string;
  note?: string;
  custom?: Record<string, string>;
}

const money = (amount: number, currencyCode: string) => ({
  amount: round2(amount).toFixed(2),
  currencyCode,
});

/** Builds a DraftOrderInput from a priced cart. */
export function buildDraftInput(
  settings: AllSettings,
  cart: PricedCart,
  customer: CustomerInput | null,
  discountCode?: string,
  extraAttributes: { key: string; value: string }[] = [],
) {
  const lineItems: any[] = cart.lines.map((l) => {
    const item: any = { variantId: l.variantId, quantity: l.quantity };
    if (l.discount > 0) {
      const lineTotal = l.unitPrice * l.quantity;
      // Express all line discounts as a percentage of the line so the result
      // is independent of how Shopify spreads fixed amounts across units.
      item.appliedDiscount = {
        title: (l.discountTitle || "Offer").slice(0, 255),
        valueType: "PERCENTAGE",
        value: Math.min(100, Number(((l.discount / lineTotal) * 100).toFixed(4))),
      };
    }
    return item;
  });

  if (cart.codFee > 0) {
    lineItems.push({
      title: settings.general.codFeeLabel || "COD fee",
      quantity: 1,
      originalUnitPriceWithCurrency: money(cart.codFee, cart.currency),
      requiresShipping: false,
      taxable: false,
    });
  }

  const input: any = {
    lineItems,
    tags: ["COD", ...settings.general.orderTags.split(",").map((t) => t.trim())]
      .filter(Boolean)
      .filter((t, i, a) => a.indexOf(t) === i),
    customAttributes: extraAttributes,
  };

  if (cart.shippingRate) {
    input.shippingLine = {
      title: cart.shippingRate.name,
      priceWithCurrency: money(cart.shipping, cart.currency),
    };
  }
  if (discountCode) input.discountCodes = [discountCode.trim()];

  if (customer) {
    const countryCode = (customer.country || settings.form.defaultCountry || "").toUpperCase();
    const address = {
      firstName: customer.firstName || "",
      lastName: customer.lastName || customer.firstName || "",
      address1: customer.address1 || "",
      address2: customer.address2 || "",
      city: customer.city || "",
      province: customer.province || "",
      zip: customer.zip || "",
      countryCode: countryCode || undefined,
      phone: customer.phone,
    };
    input.shippingAddress = address;
    input.billingAddress = address;
    input.phone = customer.phone;
    if (customer.email) input.email = customer.email;
    const notes = [settings.general.orderNote, customer.note].filter(Boolean);
    if (notes.length) input.note = notes.join("\n\n");
    for (const [key, value] of Object.entries(customer.custom || {})) {
      if (value) input.customAttributes.push({ key, value: String(value).slice(0, 500) });
    }
  }
  return input;
}

const MONEY = "shopMoney { amount currencyCode }";

/** Uses Shopify's own engine for discount codes and taxes. */
export async function calculateDraft(graphql: AdminGraphql, input: any) {
  const data = await gql(
    graphql,
    `#graphql
    mutation CodCalculate($input: DraftOrderInput!) {
      draftOrderCalculate(input: $input) {
        calculatedDraftOrder {
          subtotalPriceSet { ${MONEY} }
          totalPriceSet { ${MONEY} }
          totalShippingPriceSet { ${MONEY} }
          totalDiscountsSet { ${MONEY} }
          totalTaxSet { ${MONEY} }
        }
        userErrors { field message }
      }
    }`,
    { input },
  );
  const r = data.draftOrderCalculate;
  if (r.userErrors?.length) throw new Error(r.userErrors[0].message);
  const c = r.calculatedDraftOrder;
  return {
    subtotal: Number(c.subtotalPriceSet.shopMoney.amount),
    total: Number(c.totalPriceSet.shopMoney.amount),
    shipping: Number(c.totalShippingPriceSet.shopMoney.amount),
    discounts: Number(c.totalDiscountsSet.shopMoney.amount),
    tax: Number(c.totalTaxSet.shopMoney.amount),
    currency: c.totalPriceSet.shopMoney.currencyCode as string,
  };
}

export async function createShopifyOrder(
  graphql: AdminGraphql,
  settings: AllSettings,
  input: any,
) {
  const created = await gql(
    graphql,
    `#graphql
    mutation CodDraftCreate($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder { id name invoiceUrl totalPriceSet { ${MONEY} } }
        userErrors { field message }
      }
    }`,
    { input },
  );
  const errs = created.draftOrderCreate.userErrors;
  if (errs?.length) throw new Error(errs.map((e: any) => e.message).join("; "));
  const draft = created.draftOrderCreate.draftOrder;
  const total = Number(draft.totalPriceSet.shopMoney.amount);

  if (settings.general.orderType === "draft") {
    return {
      draftOrderId: draft.id as string,
      orderId: null as string | null,
      name: draft.name as string,
      statusPageUrl: null as string | null,
      total,
    };
  }

  const completed = await gql(
    graphql,
    `#graphql
    mutation CodDraftComplete($id: ID!) {
      draftOrderComplete(id: $id, paymentPending: true) {
        draftOrder { order { id name statusPageUrl totalPriceSet { ${MONEY} } } }
        userErrors { field message }
      }
    }`,
    { id: draft.id },
  );
  const cErrs = completed.draftOrderComplete.userErrors;
  if (cErrs?.length) throw new Error(cErrs.map((e: any) => e.message).join("; "));
  const order = completed.draftOrderComplete.draftOrder.order;
  return {
    draftOrderId: draft.id as string,
    orderId: order.id as string,
    name: order.name as string,
    statusPageUrl: order.statusPageUrl as string,
    total: Number(order.totalPriceSet.shopMoney.amount),
  };
}

/** One-click post-purchase upsell: adds a discounted variant to a placed order. */
export async function addUpsellToOrder(
  graphql: AdminGraphql,
  orderId: string,
  variantId: string,
  discountPercent: number,
  discountTitle: string,
) {
  const begin = await gql(
    graphql,
    `#graphql
    mutation CodEditBegin($id: ID!) {
      orderEditBegin(id: $id) {
        calculatedOrder { id }
        userErrors { field message }
      }
    }`,
    { id: orderId },
  );
  if (begin.orderEditBegin.userErrors?.length)
    throw new Error(begin.orderEditBegin.userErrors[0].message);
  const calcId = begin.orderEditBegin.calculatedOrder.id;

  const add = await gql(
    graphql,
    `#graphql
    mutation CodEditAdd($id: ID!, $variantId: ID!) {
      orderEditAddVariant(id: $id, variantId: $variantId, quantity: 1, allowDuplicates: true) {
        calculatedLineItem { id }
        userErrors { field message }
      }
    }`,
    { id: calcId, variantId },
  );
  if (add.orderEditAddVariant.userErrors?.length)
    throw new Error(add.orderEditAddVariant.userErrors[0].message);

  if (discountPercent > 0) {
    const disc = await gql(
      graphql,
      `#graphql
      mutation CodEditDiscount($id: ID!, $lineItemId: ID!, $discount: OrderEditAppliedDiscountInput!) {
        orderEditAddLineItemDiscount(id: $id, lineItemId: $lineItemId, discount: $discount) {
          userErrors { field message }
        }
      }`,
      {
        id: calcId,
        lineItemId: add.orderEditAddVariant.calculatedLineItem.id,
        discount: { percentValue: Math.min(100, discountPercent), description: discountTitle },
      },
    );
    if (disc.orderEditAddLineItemDiscount.userErrors?.length)
      throw new Error(disc.orderEditAddLineItemDiscount.userErrors[0].message);
  }

  const commit = await gql(
    graphql,
    `#graphql
    mutation CodEditCommit($id: ID!) {
      orderEditCommit(id: $id, notifyCustomer: false, staffNote: "COD one-click upsell") {
        order { id totalPriceSet { ${MONEY} } }
        userErrors { field message }
      }
    }`,
    { id: calcId },
  );
  if (commit.orderEditCommit.userErrors?.length)
    throw new Error(commit.orderEditCommit.userErrors[0].message);
  return Number(commit.orderEditCommit.order.totalPriceSet.shopMoney.amount);
}

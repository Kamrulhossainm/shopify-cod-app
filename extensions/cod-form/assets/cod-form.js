/* COD Order Form \u2013 storefront script (no dependencies). */
(function () {
  "use strict";
  if (window.__codFormLoaded) return;
  window.__codFormLoaded = true;

  var root = document.getElementById("cod-app-root");
  if (!root) return;
  var PROXY = root.dataset.proxy || "/apps/cod";
  var PAGE = root.dataset.page;
  var PRODUCT = readJson("cod-product-json");
  var MONEY_FORMAT = readJson("cod-money-format") || "${{amount}}";
  var cfg = null;

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 helpers \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function readJson(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }
  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "style" && typeof v === "object") { for (var sk in v) { if (v[sk] == null) continue; if (sk.indexOf("--") === 0) el.style.setProperty(sk, v[sk]); else el.style[sk] = v[sk]; } }
      else if (k.indexOf("on") === 0) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) return child.forEach(function (c) { append(el, c); });
    el.appendChild(typeof child === "object" ? child : document.createTextNode(String(child)));
  }
  function api(path, body) {
    var opts = body
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      : { headers: { Accept: "application/json" } };
    return fetch(PROXY + "/" + path, opts).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: "Network error" }; });
    });
  }
  function money(amount) {
    var cents = Math.round(Number(amount || 0) * 100);
    function fmt(n, dec, ts, ds) {
      var fixed = (n / 100).toFixed(dec).split(".");
      fixed[0] = fixed[0].replace(/\B(?=(\d{3})+(?!\d))/g, ts);
      return fixed.join(ds);
    }
    return String(MONEY_FORMAT).replace(/\{\{\s*(\w+)\s*\}\}/, function (_, k) {
      switch (k) {
        case "amount_no_decimals": return fmt(cents, 0, ",", ".");
        case "amount_with_comma_separator": return fmt(cents, 2, ".", ",");
        case "amount_no_decimals_with_comma_separator": return fmt(cents, 0, ".", ",");
        case "amount_with_apostrophe_separator": return fmt(cents, 2, "'", ".");
        case "amount_with_space_separator": return fmt(cents, 2, " ", ",");
        default: return fmt(cents, 2, ",", ".");
      }
    });
  }
  function discountOf(amount, type, value) {
    if (type === "percentage") return Math.round(amount * Math.min(value, 100)) / 100;
    if (type === "fixed") return Math.min(value, amount);
    return 0;
  }
  function uid() {
    return (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  }
  function debounce(fn, ms) {
    var t; return function () { var a = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(null, a); }, ms); };
  }
  function cookie(name) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : undefined;
  }
  function storeUtm() {
    try {
      var p = new URLSearchParams(location.search), utm = {};
      ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (k) {
        if (p.get(k)) utm[k] = p.get(k);
      });
      if (Object.keys(utm).length) sessionStorage.setItem("cod_utm", JSON.stringify(utm));
    } catch (e) {}
  }
  function getUtm() { try { return JSON.parse(sessionStorage.getItem("cod_utm") || "{}"); } catch (e) { return {}; } }
  function hidden(selectors) {
    var css = selectors.join(",") + "{display:none!important}";
    document.head.appendChild(h("style", { text: css }));
  }

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 pixels \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  var Pixels = {
    ids: function (s) { return String(s || "").split(/[\s,]+/).filter(Boolean); },
    load: function (p) {
      var fb = this.ids(p.facebook), tt = this.ids(p.tiktok), sc = this.ids(p.snapchat), pin = this.ids(p.pinterest);
      // Only fire PageView for pixels we load ourselves (avoids duplicates with theme/channel pixels).
      var mk = { fb: !window.fbq, tt: !window.ttq, sc: !window.snaptr, pin: !window.pintrk };
      if (fb.length && !window.fbq) {
        !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      }
      if (fb.length) { fb.forEach(function (id) { window.fbq("init", id); }); if (mk.fb) window.fbq("track", "PageView"); }
      if (tt.length && !window.ttq) {
        !function (w, d, t) { w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || []; ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"]; ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; }; for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]); ttq.instance = function (t) { for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]); return e; }; ttq.load = function (e, n) { var i = "https://analytics.tiktok.com/i18n/pixel/events.js"; ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = i; ttq._t = ttq._t || {}; ttq._t[e] = +new Date(); ttq._o = ttq._o || {}; ttq._o[e] = n || {}; var o = document.createElement("script"); o.type = "text/javascript"; o.async = !0; o.src = i + "?sdkid=" + e + "&lib=" + t; var a = document.getElementsByTagName("script")[0]; a.parentNode.insertBefore(o, a); }; }(window, document, "ttq");
      }
      if (tt.length) { if (mk.tt) { tt.forEach(function (id) { window.ttq.load(id); }); window.ttq.page(); } }
      if (sc.length && !window.snaptr) {
        (function (e, t, n) { if (e.snaptr) return; var a = e.snaptr = function () { a.handleRequest ? a.handleRequest.apply(a, arguments) : a.queue.push(arguments); }; a.queue = []; var s = "script", r = t.createElement(s); r.async = !0; r.src = n; var u = t.getElementsByTagName(s)[0]; u.parentNode.insertBefore(r, u); })(window, document, "https://sc-static.net/scevent.min.js");
      }
      if (sc.length) { if (mk.sc) { sc.forEach(function (id) { window.snaptr("init", id, {}); }); window.snaptr("track", "PAGE_VIEW"); } }
      if (pin.length && !window.pintrk) {
        !function (e) { if (!window.pintrk) { window.pintrk = function () { window.pintrk.queue.push(Array.prototype.slice.call(arguments)); }; var n = window.pintrk; n.queue = [], n.version = "3.0"; var t = document.createElement("script"); t.async = !0, t.src = e; var r = document.getElementsByTagName("script")[0]; r.parentNode.insertBefore(t, r); } }("https://s.pinimg.com/ct/core.js");
      }
      if (pin.length) { if (mk.pin) { pin.forEach(function (id) { window.pintrk("load", id); }); window.pintrk("page"); } }
      var gIds = [p.ga4, p.googleAds].filter(Boolean);
      if (gIds.length) {
        if (!window.gtag) {
          var s = document.createElement("script"); s.async = true;
          s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(gIds[0]);
          document.head.appendChild(s);
          window.dataLayer = window.dataLayer || [];
          window.gtag = function () { window.dataLayer.push(arguments); };
          window.gtag("js", new Date());
        }
        gIds.forEach(function (id) { window.gtag("config", id); });
      }
    },
    initiate: function (value, currency, ids) {
      var p = cfg.pixels; if (!p.fireInitiateCheckout) return;
      try {
        if (window.fbq && p.facebook) window.fbq("track", "InitiateCheckout", { value: value, currency: currency, content_ids: ids, content_type: "product" });
        if (window.ttq && p.tiktok) window.ttq.track("InitiateCheckout", { value: value, currency: currency, content_type: "product", content_id: ids[0] });
        if (window.snaptr && p.snapchat) window.snaptr("track", "START_CHECKOUT", { price: value, currency: currency, item_ids: ids });
        if (window.pintrk && p.pinterest) window.pintrk("track", "checkout_initiated", { value: value, currency: currency });
        if (window.gtag && p.ga4) window.gtag("event", "begin_checkout", { value: value, currency: currency });
      } catch (e) {}
    },
    purchase: function (res) {
      var p = cfg.pixels; if (!p.firePurchase) return;
      var v = res.total, c = res.currency, ids = res.contentIds || [];
      try {
        if (window.fbq && p.facebook) window.fbq("track", "Purchase", { value: v, currency: c, content_ids: ids, content_type: "product" }, { eventID: res.eventId });
        if (window.ttq && p.tiktok) window.ttq.track("CompletePayment", { value: v, currency: c, content_type: "product", content_id: ids[0] }, { event_id: res.eventId });
        if (window.snaptr && p.snapchat) window.snaptr("track", "PURCHASE", { price: v, currency: c, transaction_id: res.orderName, item_ids: ids });
        if (window.pintrk && p.pinterest) window.pintrk("track", "checkout", { value: v, currency: c, order_id: res.orderName, event_id: res.eventId });
        if (window.gtag && p.ga4) window.gtag("event", "purchase", { transaction_id: res.orderName, value: v, currency: c });
        if (window.gtag && p.googleAds && p.googleAdsLabel) window.gtag("event", "conversion", { send_to: p.googleAds + "/" + p.googleAdsLabel, value: v, currency: c, transaction_id: res.orderName });
      } catch (e) {}
    },
  };

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 state \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  var S = {
    mode: PAGE === "cart" ? "cart" : "product",
    cartItems: [],
    variantId: null,
    quantity: 1,
    offerId: null,
    tierIndex: null,
    upsells: {}, // upsellId -> {downsell:bool}
    shownPreSubmit: false,
    shippingRateId: null,
    discountCode: "",
    summary: null,
    otpToken: null,
    sessionKey: null,
    eventId: uid(),
    submitting: false,
  };
  var ui = {}; // DOM refs

  function variant() {
    if (!PRODUCT) return null;
    var id = Number(S.variantId || PRODUCT.selected);
    return PRODUCT.variants.find(function (v) { return v.id === id; }) || PRODUCT.variants[0];
  }
  function currentProductFormVariant() {
    var input = document.querySelector('form[action*="/cart/add"] [name="id"]');
    var val = input && Number(input.value);
    if (val) return val;
    var q = new URLSearchParams(location.search).get("variant");
    return q ? Number(q) : PRODUCT && PRODUCT.selected;
  }
  function activeOffer() { return cfg.offers.find(function (o) { return o.id === S.offerId; }) || null; }
  function upsellsFor(placement) {
    var pid = PRODUCT ? "gid://shopify/Product/" + PRODUCT.id : null;
    return cfg.upsells.filter(function (u) {
      if (u.placement !== placement) return false;
      if (u.triggerScope === "all" || !pid) return true;
      return u.triggerScope.indexOf(pid) !== -1;
    });
  }
  function lines() {
    if (S.mode === "cart") {
      return S.cartItems.map(function (i) { return { variantId: i.variant_id, quantity: i.quantity }; });
    }
    var l = { variantId: variant().id, quantity: S.quantity };
    if (S.offerId != null && S.tierIndex != null) { l.offerId = S.offerId; l.tierIndex = S.tierIndex; }
    return [l];
  }
  function upsellPayload() {
    return Object.keys(S.upsells).map(function (id) { return { upsellId: id, downsell: !!S.upsells[id].downsell }; });
  }
  function fieldValues() {
    var out = {};
    if (!ui.form) return out;
    cfg.form.fields.forEach(function (f) {
      if (!f.enabled) return;
      var el = ui.form.querySelector('[name="' + f.key + '"]');
      if (!el) return;
      out[f.key] = f.type === "checkbox" ? el.checked : el.value.trim();
    });
    return out;
  }

  /** Instant local estimate; the server summary replaces it a moment later. */
  function localSummary() {
    var subtotal = 0, discount = 0, rows = [];
    if (S.mode === "cart") {
      S.cartItems.forEach(function (i) {
        subtotal += (i.final_line_price || i.line_price) / 100;
        rows.push({ title: i.product_title, variantTitle: i.variant_title, image: i.image, quantity: i.quantity, unitPrice: i.final_price / 100, discount: 0 });
      });
    } else {
      var v = variant(), unit = v.price / 100, lineTotal = unit * S.quantity, d = 0;
      var offer = activeOffer();
      if (offer && S.tierIndex != null) {
        var t = offer.tiers[S.tierIndex];
        if (t) d = discountOf(lineTotal, t.discountType, t.discountValue);
      }
      subtotal += lineTotal; discount += d;
      rows.push({ title: PRODUCT.title, variantTitle: v.title === "Default Title" ? "" : v.title, image: v.image || PRODUCT.image, quantity: S.quantity, unitPrice: unit, discount: d });
    }
    Object.keys(S.upsells).forEach(function (id) {
      var u = cfg.upsells.find(function (x) { return x.id === id; });
      if (!u) return;
      var dd = S.upsells[id].downsell && u.downsell ? u.downsell : u;
      var ud = discountOf(u.price, dd.discountType, dd.discountValue);
      subtotal += u.price; discount += ud;
      rows.push({ title: u.title, image: u.image, quantity: 1, unitPrice: u.price, discount: ud, upsellId: u.id });
    });
    var after = subtotal - discount;
    var rates = cfg.shipping.map(function (r) { return { id: r.id, name: r.name, price: r.freeAbove > 0 && after >= r.freeAbove ? 0 : r.price }; });
    var rate = rates.find(function (r) { return r.id === S.shippingRateId; }) || rates[0];
    var g = cfg.general;
    var fee = g.codFeeEnabled ? (g.codFeeType === "percentage" ? Math.round(after * g.codFeeAmount) / 100 : g.codFeeAmount) : 0;
    var shipping = rate ? rate.price : 0;
    return { lines: rows, subtotal: subtotal, offerDiscount: discount, discountCodeAmount: 0, shipping: shipping, shippingRateId: rate && rate.id, rates: rates, codFee: fee, tax: 0, total: after + shipping + fee, local: true };
  }

  var refreshServer = debounce(function () {
    var seq = (S.calcSeq = (S.calcSeq || 0) + 1);
    var country = fieldValues().country;
    api("calculate", { lines: lines(), upsells: upsellPayload(), country: country, shippingRateId: S.shippingRateId, discountCode: S.discountCode })
      .then(function (r) {
        if (seq !== S.calcSeq) return;
        if (r && r.ok) {
          S.summary = r;
          if (S.discountCode && r.discountCodeValid === false) setDiscountMsg("This discount code isn't valid for your order", true);
          else if (S.discountCode && r.discountCodeValid) setDiscountMsg("Discount applied", false);
          renderSummary();
        } else if (r && r.error && S.discountCode) {
          setDiscountMsg(r.error, true);
        }
      });
  }, 350);

  function recalc() {
    S.summary = localSummary();
    renderSummary();
    refreshServer();
  }

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 rendering \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function renderButton(target, position) {
    var f = cfg.form;
    var btn = h("button", {
      type: "button",
      class: "cod-btn cod-anim-" + f.buttonAnimation,
      style: { background: f.buttonColor, color: f.buttonTextColor, borderRadius: f.borderRadius + "px" },
      onclick: openForm,
    },
      h("span", { class: "cod-btn-title", text: f.buttonText }),
      f.buttonSubtext ? h("span", { class: "cod-btn-sub", text: f.buttonSubtext }) : null
    );
    if (position === "after") target.insertAdjacentElement("afterend", btn);
    else target.appendChild(btn);
    if (f.stickyMobileButton) {
      var sticky = btn.cloneNode(true);
      sticky.classList.add("cod-sticky");
      sticky.addEventListener("click", openForm);
      document.body.appendChild(sticky);
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (e) { sticky.classList.toggle("cod-sticky-show", !e[0].isIntersecting); }).observe(btn);
      }
    }
    return btn;
  }

  function buildForm() {
    var f = cfg.form;
    S.sessionKey = uid();
    ui.form = h("form", { class: "cod-form", novalidate: true, onsubmit: function (e) { e.preventDefault(); submit(); } });
    ui.wrap = h("div", { class: "cod-wrap" + (f.rtl ? " cod-rtl" : ""), dir: f.rtl ? "rtl" : null, style: { "--cod-accent": f.accentColor, "--cod-radius": f.borderRadius + "px" } });
    ui.wrap.appendChild(h("h3", { class: "cod-title", text: f.title }));

    // Product / cart summary
    ui.items = h("div", { class: "cod-items" });
    ui.wrap.appendChild(ui.items);

    // Quantity offers
    if (S.mode === "product" && cfg.offers.length) {
      var offer = cfg.offers[0];
      S.offerId = offer.id;
      var box = h("div", { class: "cod-offers" });
      offer.tiers.forEach(function (t, i) {
        if (t.preselected && S.tierIndex == null) { S.tierIndex = i; S.quantity = t.quantity; }
      });
      if (S.tierIndex == null && offer.tiers.length) { S.tierIndex = 0; S.quantity = offer.tiers[0].quantity; }
      offer.tiers.forEach(function (t, i) {
        var unit = variant().price / 100, full = unit * t.quantity, d = discountOf(full, t.discountType, t.discountValue);
        var id = "cod-tier-" + i;
        var row = h("label", { class: "cod-offer" + (S.tierIndex === i ? " is-active" : ""), for: id },
          h("input", { type: "radio", name: "cod_tier", id: id, value: i, checked: S.tierIndex === i, onchange: function () {
            S.tierIndex = i; S.quantity = t.quantity;
            box.querySelectorAll(".cod-offer").forEach(function (el, j) { el.classList.toggle("is-active", j === i); });
            recalc(); trackAbandon();
          } }),
          h("span", { class: "cod-offer-main" },
            h("strong", { text: t.label || "Buy " + t.quantity }),
            t.badge ? h("em", { class: "cod-badge", text: t.badge }) : null),
          h("span", { class: "cod-offer-price" },
            h("strong", { text: money(full - d) }),
            d > 0 ? h("s", { text: money(full) }) : null)
        );
        box.appendChild(row);
      });
      ui.wrap.appendChild(box);
    } else if (S.mode === "product" && f.showQuantity) {
      var qty = h("input", { type: "number", min: 1, max: 99, value: S.quantity, class: "cod-qty-input", "aria-label": "Quantity", oninput: function () {
        S.quantity = Math.max(1, Math.min(99, parseInt(qty.value, 10) || 1)); recalc();
      } });
      ui.wrap.appendChild(h("div", { class: "cod-qty" },
        h("span", { text: "Quantity" }),
        h("button", { type: "button", "aria-label": "Decrease", onclick: function () { qty.value = Math.max(1, S.quantity - 1); qty.dispatchEvent(new Event("input")); } }, "\u2212"),
        qty,
        h("button", { type: "button", "aria-label": "Increase", onclick: function () { qty.value = Math.min(99, S.quantity + 1); qty.dispatchEvent(new Event("input")); } }, "+")));
    }

    // In-form upsells (checkbox)
    upsellsFor("in_form").forEach(function (u) {
      var price = u.price - discountOf(u.price, u.discountType, u.discountValue);
      api("track", { upsellId: u.id, type: "impression" });
      ui.wrap.appendChild(h("label", { class: "cod-inform-upsell" },
        h("input", { type: "checkbox", onchange: function (e) { if (e.target.checked) S.upsells[u.id] = { downsell: false }; else delete S.upsells[u.id]; recalc(); } }),
        u.image ? h("img", { src: u.image, alt: "", loading: "lazy" }) : null,
        h("span", {}, h("strong", { text: u.headline || u.title }), h("small", { text: u.title + " \u2014 " + money(price) }))));
    });

    // Fields
    var grid = h("div", { class: "cod-fields" });
    f.fields.forEach(function (fd) {
      if (!fd.enabled) return;
      var id = "cod-f-" + fd.key, input;
      var clearErr = function () { var e = grid.querySelector('[data-err="' + fd.key + '"]'); if (e) e.textContent = ""; };
      var common = { id: id, name: fd.key, placeholder: fd.placeholder || fd.label, required: fd.required, onblur: trackAbandon, oninput: clearErr, onchange: clearErr };
      if (fd.type === "textarea") input = h("textarea", Object.assign({ rows: 2 }, common));
      else if (fd.type === "select" || fd.key === "country") {
        input = h("select", common);
        var opts = fd.options && fd.options.length ? fd.options : (fd.key === "country" ? countryOptions() : []);
        opts.forEach(function (o) { var parts = String(o).split("|"); input.appendChild(h("option", { value: parts[0], text: parts[1] || parts[0] })); });
        if (fd.key === "country") { input.value = (root.dataset.country || cfg.form.defaultCountry); input.addEventListener("change", recalc); }
      } else if (fd.type === "checkbox") {
        input = h("input", Object.assign({ type: "checkbox" }, common));
        grid.appendChild(h("label", { class: "cod-field cod-check" }, input, h("span", { text: fd.label })));
        return;
      } else {
        input = h("input", Object.assign({ type: fd.type, autocomplete: autocomplete(fd.key), inputmode: fd.type === "tel" ? "tel" : null }, common));
      }
      grid.appendChild(h("div", { class: "cod-field" + (fd.half ? " cod-half" : "") },
        h("label", { for: id }, fd.label, fd.required ? h("span", { class: "cod-req", text: " *" }) : null),
        input,
        h("div", { class: "cod-err", "data-err": fd.key })));
    });
    ui.form.appendChild(grid);

    // Shipping rates
    ui.rates = h("div", { class: "cod-rates" });
    ui.form.appendChild(ui.rates);

    // Discount code
    if (f.showDiscountCode) {
      var code = h("input", { type: "text", placeholder: "Discount code", class: "cod-code-input" });
      ui.discountMsg = h("div", { class: "cod-code-msg" });
      ui.form.appendChild(h("div", { class: "cod-code" }, code,
        h("button", { type: "button", class: "cod-code-btn", onclick: function () { S.discountCode = code.value.trim(); setDiscountMsg("", false); recalc(); } }, "Apply")), ui.discountMsg);
    }

    ui.summary = h("div", { class: "cod-summary" });
    if (f.showOrderSummary) ui.form.appendChild(ui.summary);

    ui.error = h("div", { class: "cod-form-error", role: "alert" });
    ui.form.appendChild(ui.error);
    ui.submit = h("button", { type: "submit", class: "cod-submit cod-anim-" + f.buttonAnimation, style: { background: f.buttonColor, color: f.buttonTextColor } });
    ui.form.appendChild(ui.submit);
    ui.form.appendChild(h("p", { class: "cod-secure", text: "\uD83D\uDD12 Pay with cash upon delivery" }));

    ui.wrap.appendChild(ui.form);
    if (f.customCss) document.head.appendChild(h("style", { text: f.customCss }));
    return ui.wrap;
  }

  function autocomplete(key) {
    return { firstName: "given-name", lastName: "family-name", phone: "tel", email: "email", address1: "address-line1", address2: "address-line2", city: "address-level2", province: "address-level1", zip: "postal-code" }[key] || null;
  }
  function countryOptions() {
    var codes = {};
    cfg.shipping.forEach(function (r) { String(r.countries).split(/[\s,]+/).forEach(function (c) { if (c && c !== "*") codes[c.toUpperCase()] = 1; }); });
    var list = Object.keys(codes);
    if (!list.length) list = [cfg.form.defaultCountry];
    var names;
    try { names = new Intl.DisplayNames([root.dataset.locale || "en"], { type: "region" }); } catch (e) {}
    return list.map(function (c) { return c + "|" + (names ? names.of(c) : c); });
  }
  function setDiscountMsg(msg, bad) {
    if (!ui.discountMsg) return;
    ui.discountMsg.textContent = msg;
    ui.discountMsg.className = "cod-code-msg" + (bad ? " is-bad" : " is-good");
  }

  function renderSummary() {
    var s = S.summary; if (!s || !ui.items) return;
    ui.items.innerHTML = "";
    s.lines.forEach(function (l) {
      ui.items.appendChild(h("div", { class: "cod-item" },
        l.image ? h("img", { src: l.image, alt: "", loading: "lazy" }) : h("span", { class: "cod-item-img" }),
        h("div", { class: "cod-item-info" },
          h("div", { class: "cod-item-title", text: l.title }),
          l.variantTitle ? h("div", { class: "cod-item-variant", text: l.variantTitle }) : null,
          h("div", { class: "cod-item-qty", text: "\u00D7 " + l.quantity })),
        h("div", { class: "cod-item-price" },
          h("strong", { text: money(l.unitPrice * l.quantity - l.discount) }),
          l.discount > 0 ? h("s", { text: money(l.unitPrice * l.quantity) }) : null)));
    });

    ui.rates.innerHTML = "";
    if (s.rates && s.rates.length > 1) {
      ui.rates.appendChild(h("div", { class: "cod-rates-title", text: "Shipping method" }));
      s.rates.forEach(function (r) {
        ui.rates.appendChild(h("label", { class: "cod-rate" + (r.id === s.shippingRateId ? " is-active" : "") },
          h("input", { type: "radio", name: "cod_rate", value: r.id, checked: r.id === s.shippingRateId, onchange: function () { S.shippingRateId = r.id; recalc(); } }),
          h("span", { text: r.name }), h("strong", { text: r.price > 0 ? money(r.price) : "Free" })));
      });
    }

    ui.summary.innerHTML = "";
    function row(label, value, cls) { ui.summary.appendChild(h("div", { class: "cod-sum-row " + (cls || "") }, h("span", { text: label }), h("span", { text: value }))); }
    row("Subtotal", money(s.subtotal));
    if (s.offerDiscount > 0) row("Discount", "\u2212" + money(s.offerDiscount), "is-discount");
    if (s.discountCodeAmount > 0) row("Discount code", "\u2212" + money(s.discountCodeAmount), "is-discount");
    row("Shipping", s.shipping > 0 ? money(s.shipping) : "Free");
    if (s.codFee > 0) row(cfg.general.codFeeLabel, money(s.codFee));
    if (s.tax > 0) row("Taxes", money(s.tax));
    row("Total", money(s.total), "is-total");
    ui.submit.textContent = cfg.form.submitText.replace("{total}", money(s.total));
    ui.submit.disabled = S.submitting;
  }

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 modal \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function modal(content, opts) {
    opts = opts || {};
    var close = function () { overlay.remove(); document.documentElement.classList.remove("cod-lock"); if (opts.onClose) opts.onClose(); };
    var overlay = h("div", { class: "cod-overlay", onclick: function (e) { if (e.target === overlay && !opts.persistent) close(); } },
      h("div", { class: "cod-modal" + (cfg.form.rtl ? " cod-rtl" : ""), role: "dialog", "aria-modal": "true", dir: cfg.form.rtl ? "rtl" : null, style: { "--cod-accent": cfg.form.accentColor, "--cod-radius": cfg.form.borderRadius + "px" } },
        opts.persistent ? null : h("button", { type: "button", class: "cod-close", "aria-label": "Close", onclick: close }, "\u00D7"),
        content));
    document.body.appendChild(overlay);
    document.documentElement.classList.add("cod-lock");
    return { el: overlay, close: close };
  }

  var formModal = null;
  function openForm() {
    if (S.mode === "product") {
      S.variantId = currentProductFormVariant();
      var v = variant();
      if (v && !v.available) { alert("This variant is sold out."); return; }
    }
    var content = buildForm();
    if (cfg.general.mode === "popup" || !ui.inline) {
      formModal = modal(content, { onClose: function () { formModal = null; } });
    }
    recalc();
    var s = S.summary;
    Pixels.initiate(s.total, cfg.currency, S.mode === "cart" ? S.cartItems.map(function (i) { return String(i.product_id); }) : [String(PRODUCT.id)]);
    var first = content.querySelector("input:not([type=radio]):not([type=checkbox]),textarea");
    if (first && cfg.general.mode === "popup") setTimeout(function () { first.focus(); }, 50);
  }

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 abandoned \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  var trackAbandon = debounce(function () {
    if (!cfg.abandoned) return;
    var c = fieldValues();
    if (!c.phone && !c.email) return;
    api("abandoned", { sessionKey: S.sessionKey, customer: c, lines: lines(), total: S.summary && S.summary.total, currency: cfg.currency, url: location.href });
  }, 1200);

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 submit flow \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function validate() {
    var ok = true, values = fieldValues();
    ui.form.querySelectorAll(".cod-err").forEach(function (e) { e.textContent = ""; });
    cfg.form.fields.forEach(function (f) {
      if (!f.enabled) return;
      var v = values[f.key], msg = "";
      if (f.required && (v === "" || v === false)) msg = "Required";
      else if (f.key === "phone" && v) {
        var d = String(v).replace(/\D/g, "");
        if (d.length < cfg.form.phoneMinDigits || d.length > cfg.form.phoneMaxDigits) msg = "Enter a valid phone number";
      } else if (f.type === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) msg = "Enter a valid email";
      if (msg) {
        ok = false;
        var el = ui.form.querySelector('[data-err="' + f.key + '"]');
        if (el) el.textContent = msg;
      }
    });
    if (!ok) { var firstErr = ui.form.querySelector(".cod-err:not(:empty)"); if (firstErr) firstErr.scrollIntoView({ block: "center", behavior: "smooth" }); }
    return ok;
  }

  function submit() {
    if (S.submitting || !validate()) return;
    ui.error.textContent = "";
    var pre = upsellsFor("pre_submit").filter(function (u) { return !S.upsells[u.id]; });
    if (pre.length && !S.shownPreSubmit) {
      S.shownPreSubmit = true;
      return showUpsell(pre[0], function (accepted, downsell) {
        if (accepted) { S.upsells[pre[0].id] = { downsell: !!downsell }; recalc(); }
        submit();
      });
    }
    if (cfg.otp.enabled && !S.otpToken) return startOtp();
    placeOrder();
  }

  function setBusy(b) {
    S.submitting = b;
    ui.submit.disabled = b;
    ui.submit.classList.toggle("is-loading", b);
  }

  function placeOrder() {
    setBusy(true);
    var customer = fieldValues();
    api("submit", {
      customer: customer, lines: lines(), upsells: upsellPayload(), shippingRateId: S.shippingRateId,
      discountCode: S.discountCode, otpToken: S.otpToken, sessionKey: S.sessionKey, eventId: S.eventId,
      utm: getUtm(), url: location.href, fbp: cookie("_fbp"), fbc: cookie("_fbc"),
    }).then(function (r) {
      setBusy(false);
      if (!r.ok) {
        if (r.otpRequired) { S.otpToken = null; return startOtp(); }
        ui.error.textContent = r.error || "Something went wrong. Please try again.";
        return;
      }
      Pixels.purchase(r);
      if (S.mode === "cart") fetch("/cart/clear.js", { method: "POST" });
      var post = (r.postUpsells || []).map(function (id) { return cfg.upsells.find(function (u) { return u.id === id; }); }).filter(Boolean);
      if (post.length && r.upsellToken) {
        if (formModal) formModal.close();
        showUpsell(post[0], function (accepted, downsell) {
          if (!accepted) return done(r);
          api("upsell/accept", { upsellToken: r.upsellToken, upsellId: post[0].id, downsell: downsell }).then(function (u) {
            if (u.ok) r.total = u.total;
            done(r);
          });
        }, true);
      } else done(r);
    }).catch(function () { setBusy(false); ui.error.textContent = "Network error. Please try again."; });
  }

  function done(r) {
    var g = cfg.general;
    if (g.redirect === "order_status" && r.statusPageUrl) return location.assign(r.statusPageUrl);
    if (g.redirect === "custom" && g.customRedirectUrl) {
      var u = g.customRedirectUrl + (g.customRedirectUrl.indexOf("?") > -1 ? "&" : "?") + "order=" + encodeURIComponent(r.orderName) + "&total=" + r.total;
      return location.assign(u);
    }
    if (formModal) formModal.close();
    if (ui.inline) ui.inline.innerHTML = "";
    var f = cfg.form;
    var box = h("div", { class: "cod-success", style: { "--cod-accent": f.accentColor } },
      h("div", { class: "cod-success-icon", text: "\u2713" }),
      h("h3", { text: f.successTitle }),
      h("p", { class: "cod-success-order", text: "Order " + r.orderName + " \u00B7 " + money(r.total) }),
      h("p", { text: f.successMessage }),
      r.statusPageUrl ? h("a", { class: "cod-link", href: r.statusPageUrl }, "View order status") : null);
    if (ui.inline) ui.inline.appendChild(box); else modal(box, { onClose: function () { if (S.mode === "cart") location.reload(); } });
    S.eventId = uid(); S.upsells = {}; S.shownPreSubmit = false; S.otpToken = null;
  }

  function showUpsell(u, cb, persistent) {
    api("track", { upsellId: u.id, type: "impression" });
    var answered = false;
    function answer(a, d) { if (answered) return; answered = true; m.close(); cb(a, d); }
    function card(isDown) {
      var d = isDown ? u.downsell : u;
      var price = u.price - discountOf(u.price, d.discountType, d.discountValue);
      return h("div", { class: "cod-upsell" },
        h("h3", { text: d.headline || u.headline }),
        u.image ? h("img", { src: u.image, alt: "" }) : null,
        h("div", { class: "cod-upsell-title", text: u.title }),
        u.description && !isDown ? h("p", { text: u.description }) : null,
        h("div", { class: "cod-upsell-price" }, h("strong", { text: money(price) }), price < u.price ? h("s", { text: money(u.price) }) : null),
        h("button", { type: "button", class: "cod-submit", style: { background: cfg.form.buttonColor, color: cfg.form.buttonTextColor }, onclick: function () { answer(true, isDown); } }, u.acceptText),
        h("button", { type: "button", class: "cod-decline", onclick: function () {
          if (!isDown && u.downsell) { body.innerHTML = ""; body.appendChild(card(true)); }
          else answer(false, false);
        } }, u.declineText));
    }
    var body = h("div", {}, card(false));
    var m = modal(body, { persistent: !!persistent, onClose: function () { if (!answered) { answered = true; cb(false, false); } } });
  }

  function startOtp() {
    var phone = fieldValues().phone;
    setBusy(true);
    api("otp/send", { phone: phone }).then(function (r) {
      setBusy(false);
      if (!r.ok) { ui.error.textContent = r.error; return; }
      var inputs = h("input", { type: "text", inputmode: "numeric", autocomplete: "one-time-code", maxlength: cfg.otp.codeLength, class: "cod-otp-input", placeholder: "\u2022".repeat(cfg.otp.codeLength) });
      var err = h("div", { class: "cod-form-error" });
      var verifyBtn = h("button", { type: "button", class: "cod-submit", style: { background: cfg.form.buttonColor, color: cfg.form.buttonTextColor }, onclick: verify }, "Verify & place order");
      var resend = h("button", { type: "button", class: "cod-decline", onclick: function () {
        api("otp/send", { phone: phone }).then(function (x) { err.textContent = x.ok ? "A new code was sent." : x.error; });
      } }, "Resend code");
      var m = modal(h("div", { class: "cod-otp" },
        h("h3", { text: "Verify your phone" }),
        h("p", { text: "We sent a code to " + phone }),
        inputs, err, verifyBtn, resend));
      setTimeout(function () { inputs.focus(); }, 50);
      inputs.addEventListener("input", function () { if (inputs.value.length >= cfg.otp.codeLength) verify(); });
      function verify() {
        verifyBtn.disabled = true;
        api("otp/verify", { phone: phone, code: inputs.value }).then(function (x) {
          verifyBtn.disabled = false;
          if (!x.ok) { err.textContent = x.error; return; }
          S.otpToken = x.token; m.close(); placeOrder();
        });
      }
    });
  }

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 mount \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  function mount() {
    var g = cfg.general;
    if (!g.enabled) return;
    var slot = document.querySelector("[data-cod-slot]");

    if (S.mode === "product") {
      if (!g.showOnProduct || !PRODUCT) return;
      if (g.hideAddToCart) hidden(['form[action*="/cart/add"] [name="add"]', "form[action*=\"/cart/add\"] button[type=submit]"]);
      if (g.hideBuyNow) hidden([".shopify-payment-button"]);
      var anchor = slot || document.querySelector('form[action*="/cart/add"] [name="add"], form[action*="/cart/add"] button[type="submit"]');
      if (!anchor) return;
      if (g.mode === "embedded") {
        ui.inline = h("div", { class: "cod-inline" });
        if (slot) slot.appendChild(ui.inline); else anchor.closest("form").insertAdjacentElement("afterend", ui.inline);
        S.variantId = currentProductFormVariant();
        ui.inline.appendChild(buildForm());
        recalc();
        document.addEventListener("change", function (e) {
          if (e.target && e.target.closest && e.target.closest('form[action*="/cart/add"]')) {
            var nv = currentProductFormVariant();
            if (nv && nv !== S.variantId) { S.variantId = nv; recalc(); }
          }
        });
      } else {
        renderButton(slot || anchor, slot ? "inside" : "after");
      }
    } else if (S.mode === "cart") {
      if (!g.showOnCart) return;
      if (g.hideCheckoutButton) hidden(['[name="checkout"]', ".additional-checkout-buttons"]);
      var checkout = slot || document.querySelector('[name="checkout"]');
      if (!checkout) return;
      fetch("/cart.js").then(function (r) { return r.json(); }).then(function (cart) {
        if (!cart.items.length) return;
        S.cartItems = cart.items;
        renderButton(checkout, slot ? "inside" : "after");
      });
    }
  }

  storeUtm();
  if (PAGE !== "product" && PAGE !== "cart") return;
  var qs = PRODUCT ? "?product_id=" + PRODUCT.id : "";
  api("config" + qs).then(function (c) {
    if (!c || !c.ok) return;
    cfg = c;
    try { Pixels.load(c.pixels); } catch (e) {}
    mount();
  });
})();

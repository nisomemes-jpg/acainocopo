let lastProductTrigger = null;
const products = sections.flatMap((section) => section.products);
const cart = {};
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const whatsappNumber = "5584988356392";
let query = "";
let activeSection = "";
let cartOpen = false;
let configurator = null;
let orderError = "";
const savedClient = (() => { try { return JSON.parse(localStorage.getItem("acai.cliente")) || {}; } catch { return {}; } })();
const orderOptions = {
  name: savedClient.name || "",
  phone: savedClient.phone || "",
  fulfillment: "",
  payment: "",
  address: savedClient.address || "",
  changeFor: "",
};
let sending = false;
const onlyDigits = (value) => String(value).replace(/\D/g, "");

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function visualLabel(product) {
  if (product.label) return product.label;
  if (product.tone === "gold") return "GUARANÁ";
  if (product.tone === "pink") return "CREMES";
  return "AÇAÍ";
}

function productCard(product) {
  return `
    <article class="product-card">
      <div class="product-image-wrap">
        ${product.image
          ? `<img src="${product.image}" alt="${product.name}" loading="lazy" decoding="async">`
          : `<div class="product-visual ${product.tone || "purple"}" aria-hidden="true"><span>${product.visual}</span><b>${visualLabel(product)}</b></div>`}
        ${product.badge ? `<span class="product-badge">${product.badge}</span>` : ""}
      </div>
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <div class="product-footer">
          <div class="price">${product.oldPrice ? `<del>${money.format(product.oldPrice)}</del>` : ""}<strong>${money.format(product.price)}</strong></div>
          <button type="button" class="add-button" data-add="${product.id}" aria-label="${product.customize ? "Montar" : "Adicionar"} ${product.name}">+</button>
        </div>
      </div>
    </article>`;
}

function filteredSections() {
  const normalize = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const normalized = normalize(query.trim());
  if (!normalized) return sections;
  const matches = products.filter((product) => normalize(`${product.name} ${product.description}`).includes(normalized));
  return [{ id: "resultados", name: "Resultados", kicker: `${matches.length} PRODUTO${matches.length === 1 ? "" : "S"}`, products: matches }];
}

function findChoice(group, id) {
  return choices[group].find((choice) => choice.id === id);
}

function selectedDetails(state) {
  const details = [];
  const product = products.find((item) => item.id === state.productId);
  if (product.filling) details.push(`Recheio: ${state.filled ? "com recheio (cremes escolhidos)" : "sem recheio"}`);
  if (state.flavor?.trim()) details.push(`Sabor desejado: ${state.flavor.trim()} (confirmar disponibilidade)`);
  if (state.notes?.trim()) details.push(`Observações: ${state.notes.trim()}`);
  const creams = state.creams.map((id) => findChoice("creams", id)?.name).filter(Boolean);
  const accompaniments = state.accompaniments.map((id) => findChoice("accompaniments", id)?.name).filter(Boolean);
  const toppings = state.toppings.map((id) => findChoice("toppings", id)?.name).filter(Boolean);
  const extras = Object.entries(state.extras).filter(([, quantity]) => quantity > 0).map(([id, quantity]) => `${quantity}x ${findChoice("extras", id)?.name}`);
  if (creams.length) details.push(`Creme${creams.length > 1 ? "s" : ""}: ${creams.join(", ")}`);
  if (accompaniments.length) details.push(`Acompanhamentos: ${accompaniments.join(", ")}`);
  if (toppings.length) details.push(`Cobertura: ${toppings.join(", ")}`);
  extras.forEach((extra, index) => details.push(`${index === 0 ? "Adicionais: " : ""}${extra}`));
  return details;
}

function configurationPrice(state) {
  const product = products.find((item) => item.id === state.productId);
  const creamValue = state.creams.reduce((total, id) => total + (findChoice("creams", id)?.price || 0), 0);
  const extraValue = Object.entries(state.extras).reduce((total, [id, quantity]) => total + (findChoice("extras", id)?.price || 0) * quantity, 0);
  const basePrice = product.filling === "optional" && state.filled ? product.filledPrice : product.price;
  return basePrice + creamValue + extraValue;
}

function addSimpleProduct(product) {
  const key = product.id;
  if (!cart[key]) cart[key] = { key, product, quantity: 0, unitPrice: product.price, details: [] };
  cart[key].quantity += 1;
}

function addConfiguredProduct() {
  const product = products.find((item) => item.id === configurator.productId);
  if ((product.customize.creams && !configurator.creams.length) || (product.customize.toppings && !configurator.toppings.length) || (product.customize.flavor && !configurator.flavor.trim())) {
    configurator.error = product.customize.flavor ? "Informe o sabor desejado para continuar." : product.customize.creams ? "Escolha pelo menos 1 creme e 1 cobertura para continuar." : "Escolha 1 cobertura para continuar.";
    render();
    return;
  }
  const signature = JSON.stringify({ creams: configurator.creams, accompaniments: configurator.accompaniments, toppings: configurator.toppings, extras: configurator.extras, filled: configurator.filled, flavor: configurator.flavor.trim(), notes: configurator.notes.trim() });
  const key = `${product.id}|${signature}`;
  if (!cart[key]) cart[key] = { key, product, quantity: 0, unitPrice: configurationPrice(configurator), details: selectedDetails(configurator), state: JSON.parse(JSON.stringify({ ...configurator, error: "" })) };
  cart[key].quantity += 1;
  configurator = null;
  cartOpen = true;
  render();
}

function persistCart() {
  try {
    const items = cartItems().map((item) => ({ key: item.key, productId: item.product.id, quantity: item.quantity, state: item.state || null }));
    if (items.length) localStorage.setItem("acai.sacola", JSON.stringify({ t: Date.now(), items }));
    else localStorage.removeItem("acai.sacola");
  } catch {}
}

function restoreCart() {
  try {
    const saved = JSON.parse(localStorage.getItem("acai.sacola"));
    if (!saved || Date.now() - saved.t > 6 * 60 * 60 * 1000) return;
    saved.items.forEach(({ key, productId, quantity, state }) => {
      const product = products.find((item) => item.id === productId);
      if (!product || !(quantity > 0)) return;
      if (!state) { cart[key] = { key, product, quantity, unitPrice: product.price, details: [] }; return; }
      const valid = ["creams", "accompaniments", "toppings"].every((group) => state[group].every((id) => findChoice(group, id))) && Object.keys(state.extras).every((id) => findChoice("extras", id));
      if (valid) cart[key] = { key, product, quantity, unitPrice: configurationPrice(state), details: selectedDetails(state), state };
    });
  } catch {}
}

function updateActiveSection() {
  const row = document.querySelector(".category-row");
  const sectionEls = [...document.querySelectorAll(".catalog-section")];
  if (!row || !sectionEls.length) return;
  let current = sectionEls[0];
  sectionEls.forEach((el) => { if (el.getBoundingClientRect().top <= window.innerHeight * 0.3) current = el; });
  if (current.id === activeSection && row.querySelector("a.active")?.getAttribute("href") === `#${current.id}`) return;
  activeSection = current.id;
  row.querySelectorAll("a").forEach((link) => {
    const active = link.getAttribute("href") === `#${activeSection}`;
    link.classList.toggle("active", active);
    if (active) row.scrollLeft = link.offsetLeft - row.clientWidth / 2 + link.offsetWidth / 2;
  });
}

let scrollTicking = false;
window.addEventListener("scroll", () => {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => { scrollTicking = false; updateActiveSection(); });
}, { passive: true });

function parseMoney(value) {
  const cleaned = String(value).replace(/[^\d,.]/g, "");
  if (!cleaned) return NaN;
  if (cleaned.includes(",")) return Number(cleaned.replace(/\./g, "").replace(",", "."));
  return Number(/^\d{1,3}(\.\d{3})+$/.test(cleaned) ? cleaned.replace(/\./g, "") : cleaned);
}

function changeTooLow() {
  const text = orderOptions.changeFor.trim();
  return Boolean(text) && !(parseMoney(text) >= cartTotals().total);
}

function saveClient() {
  try { localStorage.setItem("acai.cliente", JSON.stringify({ name: orderOptions.name, phone: orderOptions.phone, address: orderOptions.address })); } catch {}
}

function buildOrderData() {
  const { total } = cartTotals();
  return {
    nome: orderOptions.name.trim(),
    telefone: orderOptions.phone.trim(),
    tipo: orderOptions.fulfillment,
    endereco: orderOptions.fulfillment === "entrega" ? orderOptions.address.trim() : "",
    pagamento: { pix: "Pix", dinheiro: "Dinheiro", cartao: "Cartão" }[orderOptions.payment],
    troco: orderOptions.payment === "dinheiro" ? orderOptions.changeFor.trim() : "",
    itens: cartItems().map((item) => ({ nome: item.product.name, qtd: item.quantity, valor: item.unitPrice * item.quantity, detalhes: item.details })),
    subtotal: total,
    taxa: null,
    total,
  };
}

async function submitOrder() {
  if (sending) return;
  sending = true;
  const button = document.querySelector("[data-order-submit]");
  if (button) { button.disabled = true; button.firstChild.textContent = "Enviando pedido… "; }
  const whatsappLink = (id) => `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(buildOrderMessage(id))}`;
  let sent = true;
  if (window.Pedidos) sent = await window.Pedidos.enviar(buildOrderData(), whatsappLink);
  else window.open(whatsappLink(""), "_blank", "noopener,noreferrer");
  sending = false;
  if (sent) { Object.keys(cart).forEach((key) => delete cart[key]); cartOpen = false; }
  render();
}

function cartItems() {
  return Object.values(cart);
}

function cartTotals() {
  return cartItems().reduce((totals, item) => ({ count: totals.count + item.quantity, total: totals.total + item.unitPrice * item.quantity }), { count: 0, total: 0 });
}

function orderIsReady() {
  return Boolean(cartItems().length && orderOptions.fulfillment && orderOptions.payment && (orderOptions.fulfillment !== "entrega" || orderOptions.address.trim()));
}

function buildOrderMessage(orderId = "") {
  const items = cartItems();
  const { total } = cartTotals();
  const messageLines = items.flatMap((item) => [`${item.quantity}x ${item.product.name} — ${money.format(item.unitPrice * item.quantity)}`, ...item.details.map((detail) => `   • ${detail}`)]);
  const fulfillmentLabel = orderOptions.fulfillment === "entrega" ? "Entrega" : "Retirada no balcão";
  const paymentLabels = { pix: "Pix", dinheiro: "Dinheiro", cartao: "Cartão (crédito ou débito)" };
  const serviceLines = [
    `Forma de recebimento: ${fulfillmentLabel}`,
    ...(orderOptions.fulfillment === "entrega" ? [`Endereço: ${orderOptions.address.trim()}`] : []),
    `Forma de pagamento: ${paymentLabels[orderOptions.payment]}`,
    ...(orderOptions.payment === "dinheiro" && orderOptions.changeFor.trim() ? [`Troco para: ${orderOptions.changeFor.trim()}`] : []),
  ];
  return ["Olá! Quero fazer este pedido pelo cardápio digital:", ...(orderId ? [`Pedido #${orderId.slice(0, 5).toUpperCase()}`] : []), "", ...messageLines, "", `Cliente: ${orderOptions.name.trim()}`, `Telefone: ${orderOptions.phone.trim()}`, ...serviceLines, "", `Subtotal dos produtos: ${money.format(total)}`, ...(orderOptions.fulfillment === "entrega" ? ["Taxa de entrega: a confirmar com a loja."] : []), ...(orderId ? ["", `Acompanhe seu pedido: ${location.origin}${location.pathname}#pedido=${orderId}`] : []), "", "Pode confirmar o pedido?"].join("\n");
}

function choiceGroup(title, step, note, group, limit) {
  if (!limit) return "";
  const selected = configurator[group];
  return `
    <section class="config-group">
      <div class="config-group-heading"><div><span>ESCOLHA SUAS OPÇÕES</span><h3>${title}</h3><p>${note}</p></div><b>${selected.length}/${limit}</b></div>
      <div class="choice-list">${choices[group].map((choice) => {
        const active = selected.includes(choice.id);
        return `<button type="button" class="choice-row ${active ? "selected" : ""}" data-choice="${choice.id}" data-group="${group}" aria-pressed="${active}" data-focus-key="${group}-${choice.id}">
          <span class="choice-check">${active ? "✓" : ""}</span><strong>${choice.name}</strong>${choice.price ? `<small>+ ${money.format(choice.price)}</small>` : `<small>Incluso</small>`}
        </button>`;
      }).join("")}</div>
    </section>`;
}

function extrasGroup() {
  const product = products.find((item) => item.id === configurator.productId);
  if (!product.customize.extras) return "";
  return `
    <section class="config-group">
      <div class="config-group-heading"><div><span>FRUTAS E ADICIONAIS</span><h3>Adicionais</h3><p>Opcional. Você pode adicionar mais de uma unidade.</p></div><b>Opcional</b></div>
      <div class="extras-list">${choices.extras.map((choice) => {
        const quantity = configurator.extras[choice.id] || 0;
        return `<div class="extra-row"><div><strong>${choice.name}</strong><small>+ ${money.format(choice.price)}</small></div><div class="extra-control"><button type="button" data-extra="${choice.id}" data-extra-amount="-1" data-focus-key="extra-${choice.id}-minus" aria-label="Remover ${choice.name}">−</button><b>${quantity}</b><button type="button" data-extra="${choice.id}" data-extra-amount="1" data-focus-key="extra-${choice.id}-plus" aria-label="Adicionar ${choice.name}">+</button></div></div>`;
      }).join("")}</div>
    </section>`;
}

function configuratorLayer() {
  if (!configurator) return "";
  const product = products.find((item) => item.id === configurator.productId);
  const price = configurationPrice(configurator);
  return `
    <div class="config-layer">
      <button type="button" class="config-backdrop" data-config-close aria-label="Fechar montagem"></button>
      <section class="configurator" role="dialog" aria-modal="true" aria-labelledby="config-title">
        <header class="config-header"><div><span>MONTE DO SEU JEITO</span><h2 id="config-title">${product.name}</h2><p>A partir de ${money.format(product.price)}</p></div><button type="button" class="close-cart" data-config-close aria-label="Fechar montagem">×</button></header>
        <div class="config-content">
          ${fillingGroup(product)}
          ${choiceGroup("Açaí e cremes", 1, `Escolha ${product.customize.creams === 1 ? "1 opção" : `até ${product.customize.creams} opções`}.`, "creams", product.customize.creams)}
          ${choiceGroup("Acompanhamentos", 2, `Escolha até ${product.customize.accompaniments} opções.`, "accompaniments", product.customize.accompaniments)}
          ${choiceGroup("Cobertura", 3, "Escolha 1 opção.", "toppings", product.customize.toppings)}
          ${extrasGroup()}
          ${product.customize.flavor ? `<label class="order-field"><span>Sabor desejado</span><input type="text" data-config-flavor maxlength="80" value="${escapeAttribute(configurator.flavor)}" placeholder="Qual sabor você gostaria?"><small>A loja confirma a disponibilidade pelo WhatsApp.</small></label>` : ""}
          <label class="order-field"><span>Observações (opcional)</span><textarea rows="2" data-config-notes maxlength="300" placeholder="Ex.: sem amendoim">${escapeAttribute(configurator.notes)}</textarea></label>
        </div>
        <footer class="config-footer">
          ${configurator.error ? `<p class="config-error">${configurator.error}</p>` : ""}
          <button type="button" class="confirm-config" data-config-confirm><span>Adicionar à sacola</span><strong>${money.format(price)}</strong></button>
        </footer>
      </section>
    </div>`;
}

function cartLayer() {
  if (!cartOpen) return "";
  const items = cartItems();
  const { total } = cartTotals();
  return `
    <div class="cart-layer">
      <button type="button" class="cart-backdrop" data-close aria-label="Fechar sacola"></button>
      <section class="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div class="drawer-handle" aria-hidden="true"></div>
        <header class="cart-drawer-header"><div><span>SEU PEDIDO</span><h2 id="cart-title">Sacola</h2></div><button type="button" class="close-cart" data-close aria-label="Fechar sacola">×</button></header>
        ${items.length ? `
          <div class="cart-list">${items.map((item) => `
            <article class="cart-line">
              <div class="cart-line-info"><strong>${item.product.name}</strong>${item.details.length ? `<small class="cart-details">${item.details.map(escapeAttribute).join("<br>")}</small>` : ""}<span>${money.format(item.unitPrice * item.quantity)}</span></div>
              <div class="quantity-control" aria-label="Quantidade de ${item.product.name}">
                <button type="button" data-change="${encodeURIComponent(item.key)}" data-amount="-1" aria-label="Remover uma unidade de ${item.product.name}">−</button>
                <b>${item.quantity}</b>
                <button type="button" data-change="${encodeURIComponent(item.key)}" data-amount="1" aria-label="Adicionar mais uma unidade de ${item.product.name}">+</button>
              </div>
            </article>`).join("")}
            <section class="order-options" aria-labelledby="service-title">
              <label class="order-field"><span>Seu nome</span><input type="text" data-order-name autocomplete="name" maxlength="60" placeholder="Como podemos te chamar?" value="${escapeAttribute(orderOptions.name)}"></label>
              <label class="order-field"><span>Seu WhatsApp (com DDD)</span><input type="tel" inputmode="tel" data-order-phone autocomplete="tel" maxlength="20" placeholder="(84) 9 0000-0000" value="${escapeAttribute(orderOptions.phone)}"><small>Usamos para avisar sobre o seu pedido.</small></label>
              <div class="order-option-heading"><span>COMO VOCÊ QUER RECEBER?</span><h3 id="service-title">Entrega ou retirada</h3></div>
              <div class="order-choice-row">
                <button type="button" class="order-choice ${orderOptions.fulfillment === "entrega" ? "selected" : ""}" data-fulfillment="entrega" aria-pressed="${orderOptions.fulfillment === "entrega"}">Entrega</button>
                <button type="button" class="order-choice ${orderOptions.fulfillment === "retirada" ? "selected" : ""}" data-fulfillment="retirada" aria-pressed="${orderOptions.fulfillment === "retirada"}">Retirada no balcão</button>
              </div>
              ${orderOptions.fulfillment === "entrega" ? `<label class="order-field"><span>Endereço para entrega</span><textarea rows="2" data-order-address placeholder="Rua, número, bairro e complemento">${escapeAttribute(orderOptions.address)}</textarea></label>` : ""}

              <div class="order-option-heading payment-heading"><span>COMO VOCÊ QUER PAGAR?</span><h3>Forma de pagamento</h3></div>
              <div class="order-choice-row payment-options">
                <button type="button" class="order-choice ${orderOptions.payment === "pix" ? "selected" : ""}" data-payment="pix" aria-pressed="${orderOptions.payment === "pix"}">Pix</button>
                <button type="button" class="order-choice ${orderOptions.payment === "dinheiro" ? "selected" : ""}" data-payment="dinheiro" aria-pressed="${orderOptions.payment === "dinheiro"}">Dinheiro</button>
                <button type="button" class="order-choice ${orderOptions.payment === "cartao" ? "selected" : ""}" data-payment="cartao" aria-pressed="${orderOptions.payment === "cartao"}">Cartão</button>
              </div>
              ${orderOptions.payment === "dinheiro" ? `<label class="order-field"><span>Precisa de troco? (opcional)</span><input type="text" inputmode="decimal" data-order-change placeholder="Ex.: R$ 60,00" value="${escapeAttribute(orderOptions.changeFor)}"></label>` : ""}
              ${orderError ? `<p class="order-error">${orderError}</p>` : ""}
            </section>
          </div>
          <footer class="cart-summary">
            <div><span>Subtotal dos produtos</span><strong>${money.format(total)}</strong></div>
            <button type="button" class="checkout-button" data-order-submit>Enviar pedido no WhatsApp <span>→</span></button>
            ${orderOptions.fulfillment === "entrega" ? "<small>Taxa de entrega a confirmar com a loja.</small>" : ""}
            <small>As escolhas já serão enviadas detalhadas para o atendente.</small>
          </footer>` : `
          <div class="empty-cart"><span aria-hidden="true">＋</span><h3>Sua sacola está vazia</h3><p>Toque no botão + de um produto para adicioná-lo aqui.</p><button type="button" data-close>Continuar escolhendo</button></div>`}
      </section>
    </div>`;
}

function render() {
  persistCart();
  const previousDialog = document.querySelector("[role=dialog]");
  const focusKey = document.activeElement?.dataset?.focusKey;
  const previousTrigger = document.activeElement?.getAttribute?.("data-add");
  if (previousTrigger) lastProductTrigger = previousTrigger;
  const pageScroll = {
    left: window.scrollX,
    top: window.scrollY,
  };
  const configScrollTop = document.querySelector(".config-content")?.scrollTop;
  const cartScrollTop = document.querySelector(".cart-list")?.scrollTop;
  const visible = filteredSections();
  const { count, total } = cartTotals();
  document.querySelector("#app").innerHTML = `
    <main>
      <div class="ambient ambient-one"></div><div class="ambient ambient-two"></div>
      <section class="hero-shell">
        <header class="topbar">
          <div class="brand-lockup"><img class="brand-logo" src="logo-oficial.jpeg" alt="Logomarca oficial Açaí no Copo"><div><p class="eyebrow">CARDÁPIO DIGITAL</p><strong>Açaí no Copo</strong></div></div>
          <a class="icon-button" href="https://www.ifood.com.br/delivery/natal-rn/acai-no-copo-areia-preta/3ce4ceac-3be4-4db4-84c6-4284b0240a86" target="_blank" rel="noreferrer" aria-label="Abrir loja no iFood">i</a>
        </header>
        <div class="hero-card"><img class="hero-image" fetchpriority="high" src="foto-copo-chocolate.jpeg" alt="Copo de açaí recheado"><div class="hero-shade"></div><div class="hero-copy"><span class="hero-pill">Areia Preta • Natal</span><h1>Seu açaí.<br>Do seu jeito.</h1><p>Açaí cremoso, recheado e com os acompanhamentos que você ama.</p></div></div>
        <div class="store-strip"><div class="store-status"><span class="status-dot"></span><div><strong>Preços do cardápio da loja</strong><small>Entrega ou retirada no balcão</small></div></div><div class="rating"><span>★</span> 5,0</div></div>
      </section>
      <section class="menu-shell">
        <div class="sponsor-card"><div class="sponsor-seal">J</div><div><span>Nosso açaí é</span><strong>Açaí do Joca Jr.</strong></div><p>Energia de campeão</p></div>
        <label class="search-box"><span aria-hidden="true">⌕</span><input type="search" placeholder="Busque por açaí, guaraná ou sorvete" value="${escapeAttribute(query)}"></label>
        ${query ? "" : `<nav class="category-row" aria-label="Categorias do cardápio">${sections.map((section, index) => `<a class="${(activeSection ? section.id === activeSection : index === 0) ? "active" : ""}" href="#${section.id}">${section.name}</a>`).join("")}</nav>`}
        <div class="catalog-meta"><span>MONTE SEU PEDIDO</span><p>Escolha cremes, acompanhamentos, cobertura e adicionais</p></div>
        ${visible.map((section) => `<section class="catalog-section" id="${section.id}"><div class="section-heading"><div><span>${section.kicker}</span><h2>${section.name}</h2></div><small>${section.products.length} ${section.products.length === 1 ? "item" : "itens"}</small></div>${section.products.length ? `<div class="product-grid">${section.products.map(productCard).join("")}</div>` : `<div class="empty-search">Nenhum produto encontrado. Tente outro nome.</div>`}</section>`).join("")}
        <section class="photo-gallery" aria-labelledby="galeria-title">
          <div class="gallery-heading"><span>FEITOS NA HORA</span><h2 id="galeria-title">Açaís de verdade</h2><p>Algumas combinações preparadas pelo Açaí no Copo.</p></div>
          <div class="gallery-grid">
            <img loading="lazy" decoding="async" src="foto-copo-grande.jpeg" alt="Copo grande de açaí com banana">
            <img loading="lazy" decoding="async" src="foto-copo-joca.jpeg" alt="Copo de açaí com confeitos">
            <img loading="lazy" decoding="async" src="foto-copo-colorido.jpeg" alt="Copo de açaí com cremes e confeitos">
            <img loading="lazy" decoding="async" src="foto-copo-trufado.jpeg" alt="Copo de açaí trufado com chocolate">
          </div>
        </section>

        <section class="location-card" aria-labelledby="location-title">
          <img loading="lazy" decoding="async" src="loja-areia-preta.jpeg" alt="Fachada do Açaí no Copo em Areia Preta">
          <div class="location-copy"><span>VENHA CONHECER</span><h2 id="location-title">Açaí no Copo — Areia Preta</h2><p>R. Maj. Afonso Magalhães, 236A<br>Areia Preta, Natal - RN<br>CEP 59014-170</p><a href="https://www.google.com/maps/search/?api=1&query=R.%20Maj.%20Afonso%20Magalh%C3%A3es%2C%20236A%20-%20Areia%20Preta%2C%20Natal%20-%20RN%2C%2059014-170" target="_blank" rel="noreferrer">Abrir no mapa <span>→</span></a></div>
        </section>

        <p class="catalog-note">Cardápio atualizado em 26/09/2026. Fotos ilustrativas das combinações. Disponibilidade confirmada pela loja.</p>
      </section>
      <button type="button" class="cart-bar" data-open aria-label="Abrir sacola com ${count} ${count === 1 ? "item" : "itens"}">
        <span class="cart-icon">${count || "▰"}</span><div><small>${count ? `${count} ${count === 1 ? "item" : "itens"} na sacola` : "Sua sacola"}</small><strong>${count ? money.format(total) : "Adicione seus produtos"}</strong></div><b>${count ? "Ver sacola" : "Abrir"} <span>→</span></b>
      </button>
      ${cartLayer()}
      ${configuratorLayer()}
    </main>`;

  document.body.style.overflow = configurator || cartOpen ? "hidden" : "";
  const dialog = document.querySelector("[role=dialog]");
  if (focusKey) document.querySelector(`[data-focus-key="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
  else if (dialog && (!previousDialog || previousDialog.getAttribute("aria-labelledby") !== dialog.getAttribute("aria-labelledby"))) dialog.querySelector("button, input, textarea")?.focus({ preventScroll: true });
  else if (!dialog && previousDialog) document.querySelector(lastProductTrigger ? `[data-add="${CSS.escape(lastProductTrigger)}"]` : "[data-open]")?.focus({ preventScroll: true });
  const configContent = document.querySelector(".config-content");
  if (configContent && Number.isFinite(configScrollTop)) configContent.scrollTop = configScrollTop;

  const cartList = document.querySelector(".cart-list");
  if (cartList && Number.isFinite(cartScrollTop)) cartList.scrollTop = cartScrollTop;

  window.scrollTo(pageScroll.left, pageScroll.top);
  requestAnimationFrame(() => window.scrollTo(pageScroll.left, pageScroll.top));
  updateActiveSection();
}

document.addEventListener("click", (event) => {
  const add = event.target.closest("[data-add]");
  const change = event.target.closest("[data-change]");
  const choice = event.target.closest("[data-choice]");
  const extra = event.target.closest("[data-extra]");
  const fulfillment = event.target.closest("[data-fulfillment]");
  const payment = event.target.closest("[data-payment]");
  const filling = event.target.closest("[data-filling]");
  if (add) {
    const product = products.find((item) => item.id === add.dataset.add);
    if (product.customize) {
      cartOpen = false;
      configurator = { productId: product.id, creams: [], accompaniments: [], toppings: [], extras: {}, filled: product.filling === "included", flavor: "", notes: "", error: "" };
    }
    else addSimpleProduct(product);
  } else if (filling && configurator) {
    configurator.filled = filling.dataset.filling === "yes";
    configurator.error = "";
  } else if (choice && configurator) {
    configurator.error = "";
    const group = choice.dataset.group;
    const id = choice.dataset.choice;
    const product = products.find((item) => item.id === configurator.productId);
    const limit = product.customize[group];
    const selected = configurator[group];
    if (selected.includes(id)) configurator[group] = selected.filter((item) => item !== id);
    else if (limit === 1) configurator[group] = [id];
    else if (selected.length < limit) configurator[group] = [...selected, id];
    else configurator.error = `Você pode escolher no máximo ${limit} opções nesta etapa.`;
  } else if (extra && configurator) {
    const id = extra.dataset.extra;
    const next = Math.max(0, Math.min(9, (configurator.extras[id] || 0) + Number(extra.dataset.extraAmount)));
    configurator.extras[id] = next;
  } else if (event.target.closest("[data-config-confirm]")) {
    addConfiguredProduct();
    return;
  } else if (event.target.closest("[data-config-close]")) configurator = null;
  else if (fulfillment) {
    orderOptions.fulfillment = fulfillment.dataset.fulfillment;
    orderError = "";
  } else if (payment) {
    orderOptions.payment = payment.dataset.payment;
    orderError = "";
  } else if (event.target.closest("[data-order-submit]")) {
    if (!cartItems().length) return;
    if (window.Pedidos && !window.Pedidos.lojaAberta()) orderError = "A loja está fechada no momento. Volte quando abrirmos!";
    else if (!orderOptions.name.trim()) orderError = "Informe seu nome para continuar.";
    else if (onlyDigits(orderOptions.phone).length < 10) orderError = "Informe um WhatsApp válido, com DDD.";
    else if (!orderOptions.fulfillment) orderError = "Escolha entrega ou retirada para continuar.";
    else if (orderOptions.fulfillment === "entrega" && !orderOptions.address.trim()) orderError = "Informe o endereço da entrega para continuar.";
    else if (!orderOptions.payment) orderError = "Escolha a forma de pagamento para continuar.";
    else if (orderOptions.payment === "dinheiro" && changeTooLow()) orderError = "Informe um valor de troco maior que o total do pedido (ou deixe em branco).";
    else { submitOrder(); return; }
  }
  else if (change) {
    const key = decodeURIComponent(change.dataset.change);
    cart[key].quantity += Number(change.dataset.amount);
    if (cart[key].quantity <= 0) delete cart[key];
  } else if (event.target.closest("[data-open]")) cartOpen = true;
  else if (event.target.closest("[data-close]")) cartOpen = false;
  else return;
  render();
});

document.addEventListener("input", (event) => {
  if (configurator && event.target.matches("[data-config-flavor], [data-config-notes]")) {
    configurator[event.target.matches("[data-config-flavor]") ? "flavor" : "notes"] = event.target.value;
    configurator.error = "";
    return;
  }
  if (event.target.matches("[data-order-name], [data-order-phone]")) {
    orderOptions[event.target.matches("[data-order-name]") ? "name" : "phone"] = event.target.value;
    orderError = "";
    saveClient();
    return;
  }
  if (event.target.matches("[data-order-address]")) {
    orderOptions.address = event.target.value;
    orderError = "";
    saveClient();
    return;
  }
  if (event.target.matches("[data-order-change]")) {
    orderOptions.changeFor = event.target.value;
    orderError = "";
    return;
  }
  if (event.target.matches('.search-box input')) {
    query = event.target.value;
    render();
    const input = document.querySelector('.search-box input');
    input.focus({ preventScroll: true });
    input.setSelectionRange(query.length, query.length);
    requestAnimationFrame(() => input.scrollIntoView({ block: "center" }));
  }
});

function fillingGroup(product) {
  if (!product.filling || product.filling === "none") return "";
  if (product.filling === "included") return '<p class="filling-note">Recheio incluído. Escolha os cremes abaixo.</p>';
  return `<section class="config-group"><div class="config-group-heading"><div><span>SEU AÇAÍ</span><h3>Com ou sem recheio?</h3><p>O recheio acompanha os cremes escolhidos.</p></div></div><div class="order-choice-row"><button type="button" class="order-choice ${!configurator.filled ? "selected" : ""}" data-filling="no" data-focus-key="filling-no" aria-pressed="${!configurator.filled}">Sem recheio · ${money.format(product.price)}</button><button type="button" class="order-choice ${configurator.filled ? "selected" : ""}" data-filling="yes" data-focus-key="filling-yes" aria-pressed="${configurator.filled}">Com recheio · ${money.format(product.filledPrice)}</button></div></section>`;
}

document.addEventListener("keydown", (event) => {
  const dialog = document.querySelector("[role=dialog]");
  if (!dialog) return;
  if (event.key === "Escape") {
    configurator = null;
    cartOpen = false;
    render();
  } else if (event.key === "Tab") {
    const controls = Array.from(dialog.querySelectorAll('button, a[href], input, textarea')).filter((item) => !item.disabled);
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});

restoreCart();
render();

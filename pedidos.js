// Automação dos pedidos: salva no Firebase, acompanhamento do cliente e painel da loja (#painel).
(() => {
  const KEY = "acai.pedido";
  const LOJA = "R. Maj. Afonso Magalhães, 236A — Areia Preta";
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const codigo = (id) => id.slice(0, 5).toUpperCase();
  const digitos = (v) => String(v).replace(/\D/g, "");
  const FLUXO = {
    retirada: [["novo", "Pedido recebido"], ["preparo", "Em preparo"], ["pronto", "Pronto para retirar"], ["entregue", "Retirado"]],
    entrega: [["novo", "Pedido recebido"], ["preparo", "Em preparo"], ["rota", "Saiu para entrega"], ["entregue", "Entregue"]],
  };
  const TEXTO = {
    novo: ["Pedido recebido", "A loja vai confirmar o seu pedido em instantes.", "📩"],
    preparo: ["Em preparo", "Estamos montando o seu açaí.", "🍇"],
    pronto: ["Pronto para retirar!", "Seu pedido está pronto. Venha retirar no balcão.", "✅"],
    rota: ["Saiu para entrega!", "O entregador está a caminho do seu endereço.", "🛵"],
    entregue: ["Pedido finalizado", "Obrigado pela preferência! Bom apetite.", "💜"],
    cancelado: ["Pedido cancelado", "Fale com a loja pelo WhatsApp.", "❌"],
  };
  let db = null, auth = null, usuario = null, authPronto = false;
  let unsubCliente = null, unsubAdmin = null, idAtual = null, dados = null, visivel = false, mapa = {};
  let lojaAberta = true, aba = "andamento", alertaTimer = null, wake = null, docsAtuais = [];
  const tituloPagina = document.title, ALERTA_MS = window.ALERTA_MS || 10000;
  try {
    if (window.FIREBASE_CONFIG && window.firebase) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
      db = firebase.firestore();
      auth = firebase.auth();
    }
  } catch (erro) { console.error("Firebase:", erro); }

  const root = document.body.appendChild(document.createElement("div"));
  root.id = "auto-root";
  root.innerHTML = '<div id="auto-pill"></div><div id="auto-layer"></div><div id="comanda"></div>';
  const camada = (html) => { root.querySelector("#auto-layer").innerHTML = html ? `<div class="auto-layer">${html}</div>` : ""; };
  const pill = (html) => { root.querySelector("#auto-pill").innerHTML = html; };
  const topo = (rotulo, titulo) => `<header class="auto-top"><div><span>${rotulo}</span><h2>${titulo}</h2></div><button type="button" class="close-cart" data-fechar aria-label="Fechar">×</button></header>`;

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)(), osc = ctx.createOscillator();
      osc.connect(ctx.destination); osc.frequency.value = 880; osc.start(); setTimeout(() => osc.stop(), 450);
    } catch {}
  }
  function avisar(titulo, texto) {
    beep();
    navigator.vibrate?.([300, 150, 300]);
    try { if (Notification.permission === "granted") new Notification(titulo, { body: texto, icon: "favicon.svg" }); } catch {}
  }

  // ---------- Envio do pedido ----------
  async function enviar(pedido, linkWhats) {
    const aba = window.open("", "_blank"); // abre no clique para o navegador não bloquear
    let id = null;
    if (db) {
      const ref = db.collection("pedidos").doc();
      id = ref.id; // o código existe antes de salvar: se a internet falhar, o pedido entra quando ela voltar
      try {
        await Promise.race([ref.set({ ...pedido, status: "novo", criadoEm: Date.now() }), new Promise((_, rej) => setTimeout(() => rej(new Error("tempo esgotado")), 8000))]);
      } catch (erro) { console.error("Pedido não salvo:", erro); if (erro.message !== "tempo esgotado") id = null; }
    }
    const url = linkWhats(id);
    if (id) { localStorage.setItem(KEY, id); localStorage.setItem("acai.wa." + id, url); }
    if (aba) aba.location.href = url;
    else if (!id) window.location.href = url;
    if (id) { history.replaceState(null, "", location.pathname + location.search); acompanhar(id, true); }
    return true;
  }

  // ---------- Acompanhamento do cliente ----------
  function acompanhar(id, abrir) {
    unsubCliente?.();
    idAtual = id; dados = null; visivel = Boolean(abrir);
    localStorage.setItem(KEY, id);
    let ultimo = null;
    if (visivel) camada(`<div class="auto-wrap">${topo("SEU PEDIDO", "Acompanhe")}<p class="auto-resumo">Carregando…</p></div>`);
    unsubCliente = db.collection("pedidos").doc(id).onSnapshot((doc) => {
      if (!doc.exists) { localStorage.removeItem(KEY); pill(""); if (visivel) camada(`<div class="auto-wrap">${topo("SEU PEDIDO", "Pedido não encontrado")}<button class="auto-btn ghost" data-fechar>Voltar ao cardápio</button></div>`); return; }
      dados = doc.data();
      if (ultimo && ultimo !== dados.status) { const t = TEXTO[dados.status] || TEXTO.novo; avisar(t[0], t[1]); }
      ultimo = dados.status;
      if (["entregue", "cancelado"].includes(dados.status)) localStorage.removeItem(KEY);
      if (visivel) telaCliente(); else atualizarPill();
    }, (erro) => console.error("Acompanhamento:", erro));
  }
  function atualizarPill() {
    pill(dados && localStorage.getItem(KEY) ? `<button type="button" class="track-pill" data-abrir>Pedido #${codigo(idAtual)} · ${(TEXTO[dados.status] || TEXTO.novo)[0]}</button>` : "");
  }
  function telaCliente() {
    const o = dados, fluxo = FLUXO[o.tipo] || FLUXO.retirada;
    const indice = fluxo.findIndex(([s]) => s === o.status);
    const [titulo, texto, emoji] = TEXTO[o.status] || TEXTO.novo;
    const wa = localStorage.getItem("acai.wa." + idAtual) || "";
    const taxa = o.tipo === "entrega" ? (o.taxa == null ? " · taxa de entrega a confirmar" : ` (inclui entrega de ${money.format(o.taxa)})`) : "";
    pill("");
    camada(`<div class="auto-wrap">${topo("PEDIDO #" + codigo(idAtual), "Acompanhe")}
      <section class="status-card ${esc(o.status)}" role="status" aria-live="polite"><div class="emoji" aria-hidden="true">${emoji}</div><h3>${titulo}</h3><p>${texto}${o.status === "pronto" ? "<br>" + LOJA : ""}</p></section>
      ${o.status === "cancelado" ? "" : `<ol class="steps">${fluxo.map(([, nome], i) => `<li class="step ${i <= indice ? "done" : ""}"><i>${i <= indice ? "✓" : ""}</i>${nome}</li>`).join("")}</ol>`}
      <p class="auto-resumo">${o.itens.map((i) => `${i.qtd}x ${esc(i.nome)}`).join("<br>")}<br><strong>Total ${money.format(o.total)}</strong>${taxa}</p>
      ${wa.startsWith("https://wa.me/") && o.status === "novo" ? `<a class="auto-btn" href="${esc(wa)}" target="_blank" rel="noopener">Enviar pedido no WhatsApp <span>→</span></a>` : ""}
      ${"Notification" in window && Notification.permission === "default" ? `<button type="button" class="auto-btn ghost" data-avisos>Ativar avisos neste aparelho</button>` : ""}
      <button type="button" class="auto-btn ghost" data-fechar>Voltar ao cardápio</button></div>`);
  }

  // ---------- Painel da loja (#painel) ----------
  const molde = (conteudo) => `<div class="auto-wrap">${topo("ÁREA DA LOJA", "Pedidos de hoje")}${conteudo}</div>`;
  const rotuloLoja = () => (lojaAberta ? "🟢 Loja ABERTA · toque para fechar" : "🔴 Loja FECHADA · toque para abrir");
  const emAndamento = (o) => ["novo", "preparo", "pronto", "rota"].includes(o.status);
  function pararAlertas() {
    clearInterval(alertaTimer); alertaTimer = null; document.title = tituloPagina;
    wake?.release?.().catch(() => {}); wake = null;
  }
  async function manterTela() { try { wake = await navigator.wakeLock?.request("screen"); } catch {} }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && unsubAdmin) manterTela(); });
  function painel() {
    unsubAdmin?.(); pararAlertas(); visivel = false; pill("");
    if (!db) return camada(molde('<p class="auto-vazio">O Firebase ainda não foi configurado (arquivo firebase-config.js).</p>'));
    if (!authPronto) return camada(molde('<p class="auto-vazio">Carregando…</p>'));
    if (!usuario) return camada(molde(`<form data-login><label class="order-field"><span>E-mail</span><input name="email" type="email" required autocomplete="username"></label><label class="order-field"><span>Senha</span><input name="senha" type="password" required autocomplete="current-password"></label><button class="auto-btn" style="justify-content:center">Entrar</button></form>`));
    camada(molde(`<button type="button" class="auto-btn toggle-loja" data-loja>${rotuloLoja()}</button><div class="resumo" id="resumo"></div><div class="abas" id="abas"></div><div id="lista-pedidos"></div><button type="button" class="auto-btn ghost" data-sair>Sair</button>`));
    manterTela();
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    let primeiro = true;
    unsubAdmin = db.collection("pedidos").where("criadoEm", ">", hoje.getTime()).orderBy("criadoEm", "desc").onSnapshot((snap) => {
      if (!primeiro && snap.docChanges().some((c) => c.type === "added")) avisar("Novo pedido!", "Confira o painel.");
      primeiro = false; mapa = {}; docsAtuais = snap.docs;
      snap.forEach((d) => { mapa[d.id] = d.data(); });
      const novos = snap.docs.filter((d) => d.data().status === "novo").length;
      document.title = novos ? `(${novos}) Novos pedidos` : "Painel · " + tituloPagina;
      if (novos && !alertaTimer) alertaTimer = setInterval(() => avisar("Pedido aguardando!", "Há pedido novo sem resposta."), ALERTA_MS);
      if (!novos && alertaTimer) { clearInterval(alertaTimer); alertaTimer = null; }
      desenhar();
    }, (erro) => { console.error("Painel:", erro); const el = document.getElementById("lista-pedidos"); if (el) el.innerHTML = '<p class="auto-vazio">Não foi possível carregar. Confira as regras do Firestore.</p>'; });
  }
  function desenhar() {
    const el = document.getElementById("lista-pedidos"); if (!el) return;
    const validos = docsAtuais.filter((d) => d.data().status !== "cancelado");
    const soma = validos.reduce((t, d) => t + d.data().total, 0);
    document.getElementById("resumo").innerHTML = `<div><b>${validos.length}</b><span>pedidos hoje</span></div><div><b>${money.format(soma)}</b><span>total dos pedidos</span></div><div><b>${validos.length ? money.format(soma / validos.length) : "—"}</b><span>ticket médio</span></div>`;
    const em = docsAtuais.filter((d) => emAndamento(d.data())), fim = docsAtuais.filter((d) => !emAndamento(d.data()));
    document.getElementById("abas").innerHTML = [["andamento", `Em andamento (${em.length})`], ["finalizados", `Finalizados (${fim.length})`]].map(([k, t]) => `<button type="button" class="${aba === k ? "on" : ""}" data-aba="${k}">${t}</button>`).join("");
    const lista = aba === "andamento" ? em : fim;
    el.innerHTML = lista.length ? lista.map(cartao).join("") : `<p class="auto-vazio" style="margin-top:12px">Nenhum pedido ${aba === "andamento" ? "em andamento" : "finalizado"}.</p>`;
  }
  function cartao(doc) {
    const o = doc.data(), id = doc.id, entrega = o.tipo === "entrega";
    const hora = new Date(o.criadoEm).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const proximo = { novo: ["preparo", "Aceitar e preparar"], preparo: entrega ? ["rota", "Saiu para entrega"] : ["pronto", "Pronto para retirar"], pronto: ["entregue", "Retirado"], rota: ["entregue", "Entregue"] }[o.status];
    const [titulo, texto] = TEXTO[o.status] || TEXTO.novo;
    const fone = digitos(o.telefone), numero = fone.length <= 11 ? "55" + fone : fone;
    const msg = `Olá, ${o.nome}! Pedido #${codigo(id)}: ${titulo} ${texto}`;
    const pedirTaxa = entrega && o.taxa == null && ["novo", "preparo"].includes(o.status);
    return `<article class="ord ${esc(o.status)}">
      <header><strong>#${codigo(id)} · ${esc(o.nome)}</strong><span>${hora}</span></header>
      <p class="ord-meta">${entrega ? "Entrega: " + esc(o.endereco) : "Retirada no balcão"} · ${esc(o.pagamento)}${o.troco ? " (troco para " + esc(o.troco) + ")" : ""} · ${esc(o.telefone)}</p>
      <ul>${o.itens.map((i) => `<li><b>${i.qtd}x ${esc(i.nome)}</b>${(i.detalhes || []).map((x) => `<br><small>${esc(x)}</small>`).join("")}</li>`).join("")}</ul>
      <p class="ord-total">${money.format(o.total)}${entrega && o.taxa == null ? " + taxa de entrega" : ""}</p>
      <p class="ord-status">${esc(titulo)}</p>
      ${pedirTaxa ? `<div class="ord-taxa"><input type="number" min="0" step="0.5" inputmode="decimal" placeholder="Taxa de entrega (R$)" data-taxa-input="${id}"><button type="button" data-taxa="${id}">Definir taxa</button></div>` : ""}
      <div class="ord-actions">
        ${proximo ? `<button type="button" data-status="${id}" data-para="${proximo[0]}">${proximo[1]}</button>` : ""}
        <a href="https://wa.me/${numero}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">WhatsApp do cliente</a>
        <button type="button" class="neutro" data-imprimir="${id}">Imprimir comanda</button>
        ${["entregue", "cancelado"].includes(o.status) ? "" : `<button type="button" class="perigo" data-status="${id}" data-para="cancelado">Cancelar</button>`}
      </div></article>`;
  }
  function imprimir(id) {
    const o = mapa[id]; if (!o) return;
    root.querySelector("#comanda").innerHTML = `<h1>Açaí no Copo</h1><p>Pedido #${codigo(id)} · ${new Date(o.criadoEm).toLocaleString("pt-BR")}</p><hr><p><b>${esc(o.nome)}</b> · ${esc(o.telefone)}</p><p>${o.tipo === "entrega" ? "ENTREGA: " + esc(o.endereco) : "RETIRADA NO BALCÃO"}</p><hr>${o.itens.map((i) => `<p><b>${i.qtd}x ${esc(i.nome)}</b>${(i.detalhes || []).map((x) => `<br>&nbsp;&nbsp;${esc(x)}`).join("")}</p>`).join("")}<hr><p>Pagamento: ${esc(o.pagamento)}${o.troco ? " (troco para " + esc(o.troco) + ")" : ""}</p><p><b>TOTAL: ${money.format(o.total)}</b>${o.tipo === "entrega" && o.taxa == null ? " + taxa de entrega" : ""}</p>`;
    window.print();
  }

  // ---------- Eventos e rotas ----------
  const fechar = () => { unsubAdmin?.(); unsubAdmin = null; pararAlertas(); visivel = false; camada(""); history.replaceState(null, "", location.pathname + location.search); atualizarPill(); };
  root.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const d = b.dataset;
    if ("fechar" in d) fechar();
    else if ("abrir" in d) { visivel = true; telaCliente(); }
    else if ("avisos" in d) Notification.requestPermission().then(telaCliente);
    else if ("sair" in d) auth.signOut();
    else if ("loja" in d) db.collection("config").doc("loja").set({ aberta: !lojaAberta, atualizadoEm: Date.now() }).catch(() => alert("Não foi possível alterar. Verifique a conexão."));
    else if (d.aba) { aba = d.aba; desenhar(); }
    else if (d.imprimir) imprimir(d.imprimir);
    else if (d.status) {
      if (d.para === "cancelado" && !confirm("Cancelar este pedido?")) return;
      db.collection("pedidos").doc(d.status).update({ status: d.para, atualizadoEm: Date.now() }).catch(() => alert("Não foi possível atualizar. Verifique a conexão."));
    } else if (d.taxa) {
      const valor = parseFloat(String(root.querySelector(`[data-taxa-input="${d.taxa}"]`).value).replace(",", "."));
      if (!(valor >= 0)) return alert("Informe um valor válido para a taxa.");
      db.collection("pedidos").doc(d.taxa).update({ taxa: valor, total: (mapa[d.taxa]?.subtotal || 0) + valor }).catch(() => alert("Não foi possível definir a taxa."));
    }
  });
  root.addEventListener("submit", (e) => {
    if (!e.target.matches("[data-login]")) return;
    e.preventDefault();
    const f = e.target.elements;
    auth.signInWithEmailAndPassword(f.email.value, f.senha.value).catch(() => alert("E-mail ou senha incorretos."));
  });
  if (auth) auth.onAuthStateChanged((u) => { usuario = u; authPronto = true; if (location.hash === "#painel") painel(); });
  const aviso = document.body.insertBefore(document.createElement("div"), document.body.firstChild);
  aviso.id = "loja-aviso"; aviso.hidden = true; aviso.setAttribute("role", "status");
  aviso.textContent = "Estamos fechados no momento. Você pode ver o cardápio, mas só recebemos pedidos quando abrirmos.";
  if (db) db.collection("config").doc("loja").onSnapshot((doc) => {
    lojaAberta = !doc.exists || doc.data().aberta !== false; aviso.hidden = lojaAberta;
    const botao = root.querySelector("[data-loja]"); if (botao) botao.textContent = rotuloLoja();
  }, (erro) => console.error("Loja:", erro));
  function rota() {
    const h = location.hash;
    if (h === "#painel") painel();
    else if (db && h.startsWith("#pedido=")) acompanhar(h.slice(8).replace(/[^\w-]/g, ""), true);
    else if (db && localStorage.getItem(KEY) && !idAtual) acompanhar(localStorage.getItem(KEY), false);
  }
  addEventListener("hashchange", rota);
  window.Pedidos = { enviar, ativo: Boolean(db), lojaAberta: () => lojaAberta };
  rota();
})();

/* Roteiro · motor da página de evento.
   Lê /eventos/<slug>/evento.json e, se houver, a planilha publicada do Google Sheets (planilha_csv). */
(function () {
  "use strict";

  const COLS = ["atividade","titulo","tipo","trilhas","com","descricao","local","data","inicio","fim","entrada","classificacao","acessibilidade","como_participar"];
  const REFRESH_UI_MS = 30000;      // recalcula "Agora", "Em 20 min" etc.
  const REFRESH_SHEET_MS = 60000;   // busca a planilha de novo

  /* ---------- utilidades ---------- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const pad = n => String(n).padStart(2, "0");
  const slugify = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "atividade";
  const validDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
  const validTime = s => /^\d{2}:\d{2}$/.test(s || "");
  const noon = iso => new Date(iso + "T12:00:00Z");
  const fmtDay = iso => noon(iso).toLocaleDateString("pt-BR", {weekday:"long", day:"numeric", month:"long", timeZone:"UTC"});
  const wd = iso => noon(iso).toLocaleDateString("pt-BR", {weekday:"short", timeZone:"UTC"}).replace(".", "");
  const hfmt = hm => hm ? hm.replace(":", "h").replace(/h00$/, "h") : "";

  /* ---------- estado ---------- */
  let CFG = null, SESS = [], slug = null, lastSheetOk = null;
  const E = () => CFG.evento;
  const tz = () => E().tz || "America/Sao_Paulo";
  const mk = (iso, hm) => new Date(`${iso}T${hm}:00${E().fuso || "-03:00"}`);
  const fmtT = d => d.toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit", timeZone: tz()});
  const state = {tab:"programacao", dia:"todos", trilha:"all", fav:false, q:"", past:false, local:null};
  let favs = new Set();
  const store = {
    get(k, def) { try { const v = localStorage.getItem("roteiro:" + slug + ":" + k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem("roteiro:" + slug + ":" + k, JSON.stringify(v)); } catch (e) {} }
  };
  const now = () => new Date();
  const todayISO = () => new Intl.DateTimeFormat("en-CA", {timeZone: tz(), year:"numeric", month:"2-digit", day:"2-digit"}).format(now());

  function dayList() {
    const out = [];
    if (!validDate(E().inicio) || !validDate(E().fim)) return out;
    let t = +noon(E().inicio); const end = +noon(E().fim);
    while (t <= end && out.length < 370) { out.push(new Date(t).toISOString().slice(0, 10)); t += 86400000; }
    return out;
  }
  function trilhaColor(name) { const i = CFG.trilhas.indexOf(name); return i < 0 ? "var(--muted)" : `var(--c${i % 8 + 1})`; }

  function buildSessions(rows) {
    return rows.filter(s => s.titulo && validDate(s.data) && validTime(s.inicio)).map((s, i) => {
      const start = mk(s.data, s.inicio);
      let end = validTime(s.fim) ? mk(s.data, s.fim) : new Date(+start + 90 * 60000);
      if (end <= start) end = new Date(+start + 90 * 60000);
      const trilhas = Array.isArray(s.trilhas) ? s.trilhas : String(s.trilhas || "").split(/[;|]/).map(x => x.trim()).filter(Boolean);
      trilhas.forEach(t => { if (!CFG.trilhas.includes(t)) CFG.trilhas.push(t); });
      const atividade = s.atividade || slugify(s.titulo);
      const id = s.id || `${atividade}-${s.data}-${s.inicio}`;
      return {...s, id, atividade, trilhas, start, end};
    }).sort((a, b) => a.start - b.start || a.titulo.localeCompare(b.titulo));
  }
  function signup(s) {
    const txt = s.como_participar || "";
    const link = s.link_inscricao || (CFG.inscricao && CFG.inscricao.link && /inscri[cç]/i.test(txt) ? CFG.inscricao.link : "");
    if (link) return {link: /^https?:\/\//.test(link) ? link : "https://" + link, rotulo: (CFG.inscricao && CFG.inscricao.rotulo) || "Inscreva-se"};
    if (/retirada de senha/i.test(txt)) return {senha: true};
    return null;
  }
  const lastEnd = () => SESS.length ? Math.max(...SESS.map(x => +x.end)) : 0;

  /* ---------- planilha (CSV/TSV) ---------- */
  function parseTable(text) {
    text = text.replace(/^﻿/, "");
    const first = text.split(/\r?\n/)[0] || "";
    const sep = first.includes("\t") ? "\t" : (first.split(";").length > first.split(",").length ? ";" : ",");
    const rows = []; let row = [], f = "", inq = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inq) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else inq = false; } else f += c; }
      else if (c === '"' && f === "") inq = true;
      else if (c === sep) { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
      else f += c;
    }
    if (f !== "" || row.length) { row.push(f); rows.push(row); }
    return rows.filter(r => r.some(v => v.trim() !== ""));
  }
  const norm = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const ALIAS = {titulo:"titulo",title:"titulo",nome:"titulo",atividade:"atividade",codigo:"atividade",tipo:"tipo",formato:"tipo",trilha:"trilhas",trilhas:"trilhas",com:"com",artistas:"com",creditos:"com",descricao:"descricao",local:"local",espaco:"local",data:"data",dia:"data",inicio:"inicio",hora:"inicio",horario:"inicio",fim:"fim",termino:"fim",entrada:"entrada",preco:"entrada",classificacao:"classificacao",idade:"classificacao",acessibilidade:"acessibilidade",como_participar:"como_participar",inscricao:"como_participar",link_inscricao:"link_inscricao",link:"link_inscricao",obs:"como_participar",observacoes:"como_participar",id:"id"};
  function normDate(v) {
    v = String(v).trim(); let m;
    if ((m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    if ((m = v.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/))) { const y = m[3] ? (m[3].length === 2 ? "20" + m[3] : m[3]) : (E().inicio || "").slice(0, 4); return `${y}-${pad(m[2])}-${pad(m[1])}`; }
    return v;
  }
  function normTime(v) {
    v = String(v).trim().toLowerCase(); if (!v) return "";
    const m = v.match(/^(\d{1,2})\s*(?:[:h]\s*(\d{2})?)?(?::\d{2})?\s*$/);
    return m && +m[1] < 24 ? `${pad(m[1])}:${m[2] || "00"}` : v;
  }
  function rowsFromTable(text) {
    const rows = parseTable(text);
    if (rows.length < 2) return [];
    const head = rows[0].map(h => ALIAS[norm(h)] || null);
    return rows.slice(1).map(r => {
      const o = {};
      head.forEach((k, ci) => { if (k) o[k] = (r[ci] || "").trim(); });
      o.data = normDate(o.data || ""); o.inicio = normTime(o.inicio || ""); o.fim = normTime(o.fim || "");
      return o;
    });
  }
  async function loadSheet() {
    if (!CFG.planilha_csv) return false;
    try {
      const url = CFG.planilha_csv + (CFG.planilha_csv.includes("?") ? "&" : "?") + "_=" + Date.now();
      const r = await fetch(url, {cache: "no-store"});
      if (!r.ok) throw new Error(r.status);
      const rows = rowsFromTable(await r.text());
      if (!rows.length) throw new Error("vazia");
      SESS = buildSessions(rows); lastSheetOk = new Date();
      return true;
    } catch (e) { console.warn("Planilha indisponível, usando dados do evento.json", e); return false; }
  }

  /* ---------- filtros ---------- */
  function status(s) {
    const n = now();
    if (n >= s.start && n < s.end) return {k:"live", l:"Agora"};
    const m = Math.round((s.start - n) / 60000);
    if (m > 0 && m <= 60) return {k:"soon", l:`Em ${m} min`};
    if (n >= s.end) return {k:"past", l:"Encerrada"};
    return null;
  }
  function filtered(ignorePast) {
    const q = state.q.trim().toLowerCase(), n = now();
    return SESS.filter(s => {
      if (state.trilha !== "all" && !s.trilhas.includes(state.trilha)) return false;
      if (state.fav && !favs.has(s.id)) return false;
      if (state.local && s.local !== state.local) return false;
      if (state.dia !== "todos" && s.data !== state.dia) return false;
      if (q && !(s.titulo + " " + (s.com||"") + " " + (s.tipo||"") + " " + (s.local||"") + " " + (s.descricao||"")).toLowerCase().includes(q)) return false;
      if (!ignorePast && !state.past && n >= s.end) return false;
      return true;
    });
  }

  /* ---------- telas ---------- */
  const TABS = [["programacao","Programação"],["em-cartaz","Em cartaz"],["locais","Locais"],["info","Informações"]];
  function shell() {
    const tabs = TABS.filter(([id]) => id !== "em-cartaz" || (CFG.emcartaz || []).length).filter(([id]) => id !== "info" || (CFG.info || []).length);
    document.getElementById("root").innerHTML = `
      ${E().aviso ? `<div class="proto"><div class="wrap">${esc(E().aviso)}</div></div>` : ""}
      <header class="top"><div class="wrap">
        ${E().eyebrow ? `<div class="eyebrow">${esc(E().eyebrow)}</div>` : ""}
        <h1>${esc(E().nome)}</h1>
        <div class="meta">${[E().periodo && `<span><b>${esc(E().periodo)}</b></span>`, E().local && `<span>${esc(E().local)}</span>`, E().funcionamento && `<span>${esc(E().funcionamento)}</span>`].filter(Boolean).join("")}</div>
      </div></header>
      <nav class="tabs" aria-label="Seções"><div class="wrap">${tabs.map(([id, l]) => `<a href="#${id}" data-tab="${id}">${l}</a>`).join("")}</div></nav>
      <main><div class="wrap" id="view"></div></main>
      <footer>Feito com <a href="/">${esc(window.ROTEIRO_NOME || "Roteiro")}</a></footer>
      <div id="sheet" hidden></div>`;
    document.title = `${E().nome} · Programação`;
  }

  function renderProg() {
    const all = filtered(true), list = filtered(false), hidden = all.length - list.length;
    const tISO = todayISO(), n = now(), over = SESS.length && +n > lastEnd();
    const counts = {}; SESS.forEach(s => s.trilhas.forEach(t => counts[t] = (counts[t] || 0) + 1));
    const fech = E().fechados || [];
    let days = `<button class="day wide" data-dia="todos" aria-pressed="${state.dia === "todos"}"><span class="d" style="font-size:15px">Todos</span></button>`;
    dayList().forEach(d => { const c = fech.includes(d); days += `<button class="day${c ? " closed" : ""}${d === tISO ? " today" : ""}" data-dia="${d}" aria-pressed="${state.dia === d}" aria-label="${fmtDay(d)}"><span class="wd">${wd(d)}</span><span class="d">${+d.slice(8)}</span><span class="tg">${d === tISO ? "hoje" : c ? "fechado" : ""}</span></button>`; });
    let chips = `<button class="chip" data-trilha="all" aria-pressed="${state.trilha === "all"}">Todas <span class="n">${SESS.length}</span></button>`;
    CFG.trilhas.forEach(t => chips += `<button class="chip" data-trilha="${esc(t)}" aria-pressed="${state.trilha === t}"><span class="dot" style="--c:${trilhaColor(t)}"></span>${esc(t)} <span class="n">${counts[t] || 0}</span></button>`);
    let body = "";
    if (over) body += `<div class="banner"><b>Programação encerrada.</b> ${esc(E().mensagem_final || "Obrigado pela participação.")}</div>`;
    if (state.dia !== "todos" && fech.includes(state.dia)) body += `<div class="empty">Fechado neste dia.</div>`;
    else if (!list.length) body += `<div class="empty">${state.fav && !favs.size ? "Toque na estrela de uma sessão para guardá-la aqui." : "Nenhuma sessão com esses filtros."}</div>`;
    else {
      const g = {}; list.forEach(s => (g[s.data] = g[s.data] || []).push(s));
      Object.keys(g).sort().forEach(d => body += `<section class="group"><h2 class="gh">${fmtDay(d)}${d === tISO ? '<span class="today">Hoje</span>' : ""}</h2>${g[d].map(card).join("")}</section>`);
    }
    if (hidden > 0 && !state.past) body += `<button class="ghost" data-act="past">Mostrar ${hidden} ${hidden > 1 ? "sessões que já passaram" : "sessão que já passou"}</button>`;
    else if (state.past && hidden > 0) body += `<button class="ghost" data-act="past">Esconder o que já passou</button>`;
    return `<div class="tools">
      <div class="row">
        <label class="search"><span aria-hidden="true">⌕</span><input id="q" type="search" placeholder="Buscar atividade, artista ou local" value="${esc(state.q)}" aria-label="Buscar"></label>
        <div class="seg" role="group" aria-label="Mostrar"><button data-fav="0" aria-pressed="${!state.fav}">Todas</button><button data-fav="1" aria-pressed="${state.fav}">★ Favoritos (${favs.size})</button></div>
      </div>
      <div class="days" role="group" aria-label="Dia">${days}</div>
      <div class="scroller" role="group" aria-label="Trilha">${chips}</div>
      ${state.local ? `<div class="row"><span class="chip" aria-pressed="true">Local: ${esc(state.local)}</span><button class="ghost" data-act="clearlocal">Limpar local</button></div>` : ""}
      <div class="status"><span class="pulse"></span>Atualiza sozinho · atualizado às ${fmtT(lastSheetOk || n)}</div>
    </div>${body}`;
  }
  function card(s) {
    const st = status(s), tags = [];
    if (st && st.k !== "past") tags.push(`<span class="tag ${st.k}">${st.l}</span>`);
    s.trilhas.forEach(t => tags.push(`<span class="tag"><span class="dot" style="--c:${trilhaColor(t)}"></span>${esc(t)}</span>`));
    if (s.entrada) tags.push(`<span class="tag">${/gr[aá]tis/i.test(s.entrada) ? "Grátis" : "Pago"}</span>`);
    if (s.classificacao) tags.push(`<span class="tag">${esc(s.classificacao)}</span>`);
    if (s.acessibilidade) tags.push(`<span class="tag">${esc(s.acessibilidade)}</span>`);
    const su = signup(s), ended = st && st.k === "past";
    if (su && su.senha && !ended) tags.push(`<span class="tag">Senha no local</span>`);
    const cta = su && su.link && !ended ? `<a class="cta" href="${esc(su.link)}" target="_blank" rel="noopener">${esc(su.rotulo)} <span aria-hidden="true">↗</span></a>` : "";
    return `<article class="card${st && st.k === "past" ? " past" : ""}${st && st.k === "live" ? " live" : ""}" style="--c:${trilhaColor(s.trilhas[0])}">
      <div class="time">${hfmt(s.inicio)}${s.fim ? `<small>até ${hfmt(s.fim)}</small>` : ""}</div>
      <div class="body"><button class="open" data-open="${esc(s.id)}"><span class="kind">${esc(s.tipo)}</span><span class="title">${esc(s.titulo)}</span>${s.com ? `<span class="who">${esc(s.com)}</span>` : ""}<span class="who">${esc(s.local)}</span></button><div class="tags">${tags.join("")}</div>${cta}</div>
      <button class="star" data-star="${esc(s.id)}" aria-pressed="${favs.has(s.id)}" aria-label="${favs.has(s.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}">${favs.has(s.id) ? "★" : "☆"}</button>
    </article>`;
  }
  function renderCartaz() {
    const it = CFG.emcartaz || [];
    return `<div class="panel"><h2>Em cartaz</h2><p>Atividades contínuas, sem horário único de sessão.</p></div>` +
      it.map(e => `<div class="panel"><div class="row"><span class="dot" style="--c:${trilhaColor(e.trilha)}"></span><span class="kind">${esc(e.trilha || "")}</span></div><h2>${esc(e.titulo)}</h2><p class="who">${esc(e.quando)}</p><p>${esc(e.descricao)}</p></div>`).join("");
  }
  function renderLocais() {
    const m = {}; SESS.forEach(s => { if (s.local) m[s.local] = (m[s.local] || 0) + 1; });
    const rows = Object.entries(m).sort((a, b) => b[1] - a[1]).map(([l, c]) => `<div class="li"><span>${esc(l)}</span><button class="go" data-local="${esc(l)}">${c} ${c > 1 ? "sessões" : "sessão"} →</button></div>`).join("");
    return `<div class="panel"><h2>Locais</h2><p>Toque em um local para ver a programação dele.</p><div class="list">${rows}</div></div>`;
  }
  function renderInfo() {
    const link = t => esc(t).replace(/\b((?:https?:\/\/)?[a-z0-9.-]+\.(?:org|com|gov)(?:\.br)?(?:\/[^\s<]*)?)/gi, m => `<a href="${m.startsWith("http") ? m : "https://" + m}" target="_blank" rel="noopener">${m}</a>`);
    return (CFG.info || []).map(b => `<div class="panel"><h2>${esc(b.titulo)}</h2><p class="pre">${link(b.texto)}</p></div>`).join("");
  }

  function openSheet(id) {
    const s = SESS.find(x => x.id === id); if (!s) return;
    const list = SESS.filter(x => x.atividade === s.atividade), n = now();
    const el = document.getElementById("sheet");
    const fact = (l, v) => v ? `<div><span>${l}</span><span>${esc(v)}</span></div>` : "";
    el.innerHTML = `<div class="sheet-bg" data-bg="1"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t">
      <button class="close" data-act="close">Fechar</button>
      <span class="kind">${esc(s.tipo)}</span><h2 id="sh-t">${esc(s.titulo)}</h2>
      ${s.com ? `<p class="who" style="margin:0">${esc(s.com)}</p>` : ""}
      ${s.descricao ? `<p style="margin:0">${esc(s.descricao)}</p>` : ""}
      <div class="facts">${fact("Local", s.local)}${fact("Entrada", s.entrada)}${fact("Classificação", s.classificacao)}${fact("Acessibilidade", s.acessibilidade)}${fact("Como participar", s.como_participar)}${fact("Trilhas", s.trilhas.join(", "))}</div>
      <div class="facts"><span class="kind">${list.length > 1 ? "Todas as datas" : "Data"}</span>
        <div class="occ">${list.map(o => `<span class="${n >= o.start && n < o.end ? "now" : ""}">${fmtDay(o.data)} · ${o.inicio}${o.fim ? "–" + o.fim : ""}${n >= o.end ? " · encerrada" : ""}</span>`).join("")}</div></div>
      ${(() => { const su = signup(s); if (!su || n >= list[list.length - 1].end) return ""; return su.link ? `<a class="cta big" href="${esc(su.link)}" target="_blank" rel="noopener">${esc(su.rotulo)} <span aria-hidden="true">↗</span></a>` : `<p class="hint" style="margin:0">Sem inscrição prévia: retire sua senha no local, ${esc(s.como_participar.replace(/^retirada de senhas?\s*/i, ""))}.</p>`; })()}
      <div class="row"><button class="ghost" data-star="${esc(s.id)}" aria-pressed="${favs.has(s.id)}">${favs.has(s.id) ? "★ Nos favoritos" : "☆ Adicionar aos favoritos"}</button></div>
    </div></div>`;
    el.hidden = false; el.querySelector(".close").focus();
  }
  function closeSheet() { const el = document.getElementById("sheet"); if (el) { el.hidden = true; el.innerHTML = ""; } }

  function render() {
    document.querySelectorAll("nav.tabs a").forEach(a => a.setAttribute("aria-current", a.dataset.tab === state.tab ? "page" : "false"));
    const v = document.getElementById("view"), ae = document.activeElement, keep = ae && ae.id === "q", pos = keep ? ae.selectionStart : 0;
    v.innerHTML = state.tab === "em-cartaz" ? renderCartaz() : state.tab === "locais" ? renderLocais() : state.tab === "info" ? renderInfo() : renderProg();
    if (keep) { const q = document.getElementById("q"); q.focus(); q.setSelectionRange(pos, pos); }
  }
  function route() { const h = location.hash.slice(1); state.tab = TABS.some(t => t[0] === h) ? h : "programacao"; render(); }

  function bind() {
    document.addEventListener("click", e => {
      const bg = e.target.closest("[data-bg]"); if (bg && e.target === bg) { closeSheet(); return; }
      const t = e.target.closest("[data-dia],[data-trilha],[data-fav],[data-star],[data-open],[data-local],[data-act]"); if (!t) return;
      const d = t.dataset;
      if (d.dia) state.dia = d.dia;
      else if (d.trilha) state.trilha = d.trilha;
      else if (d.fav) state.fav = d.fav === "1";
      else if (d.star) { favs.has(d.star) ? favs.delete(d.star) : favs.add(d.star); store.set("favs", [...favs]); if (!document.getElementById("sheet").hidden) openSheet(d.star); }
      else if (d.open) { openSheet(d.open); return; }
      else if (d.local) { state.local = d.local; state.dia = "todos"; state.past = true; if (location.hash !== "#programacao") { location.hash = "programacao"; return; } }
      else if (d.act === "past") state.past = !state.past;
      else if (d.act === "clearlocal") state.local = null;
      else if (d.act === "close") { closeSheet(); return; }
      render();
    });
    document.addEventListener("input", e => { if (e.target.id === "q") { state.q = e.target.value; render(); } });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });
    window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });
  }

  function fail(msg) {
    document.title = "Evento não encontrado";
    document.getElementById("root").innerHTML = `<main><div class="wrap" style="padding-block:64px"><div class="panel"><h2>${esc(msg)}</h2><p>Confira o endereço ou volte para a <a href="/">página inicial</a>.</p></div></div></main>`;
  }

  async function start() {
    const m = location.pathname.match(/\/e\/([a-z0-9-]+)/i);
    slug = m ? m[1] : new URLSearchParams(location.search).get("e");
    if (!slug) return fail("Nenhum evento indicado no endereço.");
    try {
      const r = await fetch(`/eventos/${slug}/evento.json`, {cache: "no-cache"});
      if (!r.ok) throw new Error(r.status);
      CFG = await r.json();
    } catch (e) { return fail("Não encontramos esse evento."); }
    CFG.trilhas = CFG.trilhas || [];
    favs = new Set(store.get("favs", []));
    const fromSheet = await loadSheet();
    if (!fromSheet) SESS = buildSessions(CFG.sessoes || []);
    shell(); bind(); route();
    setInterval(() => { if (state.tab === "programacao" && document.getElementById("sheet").hidden) render(); }, REFRESH_UI_MS);
    if (CFG.planilha_csv) setInterval(async () => { if (await loadSheet() && document.getElementById("sheet").hidden) render(); }, REFRESH_SHEET_MS);
  }
  start();
})();

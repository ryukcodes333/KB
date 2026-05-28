// ─── CONFIG ───────────────────────────────────────────────────
const BASE = "/api";
const TOKEN_KEY = "konosuba_token";
const PHONE_KEY = "konosuba_phone";

// ─── STATE ────────────────────────────────────────────────────
let currentUser = null;
let currentPage = null;

// ─── UTILS ────────────────────────────────────────────────────
function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(phone) { localStorage.setItem(TOKEN_KEY, btoa(phone)); localStorage.setItem(PHONE_KEY, phone); }
function clearToken() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(PHONE_KEY); }

async function api(path, opts = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function toast(msg, type = "info") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = ""; }, 3000);
}

function tierSymbol(tier) {
  return { T1:"○", T2:"◇", T3:"◈", T4:"★", T5:"✦", T6:"❋", T7:"⬡", T8:"▲" }[tier] || "🃏";
}

function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n ?? 0);
}

function avatar(name) {
  return (name || "?").charAt(0).toUpperCase();
}

function loading(id) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
}

function empty(id, msg = "Nothing here yet") {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="empty"><p>${msg}</p></div>`;
}

// ─── ROUTING ──────────────────────────────────────────────────
const ROUTES = {
  home: renderHome,
  shop: renderShop,
  leaderboard: renderLeaderboard,
  cards: renderCards,
  pokemon: renderPokemon,
  membership: renderMembership,
  profile: renderProfile,
  login: renderLogin,
  register: renderRegister,
};

function navigate(page, push = true) {
  if (currentPage === page) return;
  currentPage = page;
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const el = document.getElementById(`page-${page}`);
  if (el) el.classList.add("active");
  document.querySelectorAll(".nav-links a, #mobile-menu a").forEach(a => {
    a.classList.toggle("active", a.dataset.page === page);
  });
  closeMobileMenu();
  if (push) history.pushState({ page }, "", `#${page}`);
  window.scrollTo(0, 0);
  if (ROUTES[page]) ROUTES[page]();
}

// ─── AUTH STATE ───────────────────────────────────────────────
async function loadUser() {
  const token = getToken();
  if (!token) return null;
  try {
    const user = await api("/auth?action=me");
    currentUser = user;
    updateNavAuth();
    return user;
  } catch {
    clearToken();
    currentUser = null;
    updateNavAuth();
    return null;
  }
}

function updateNavAuth() {
  const loggedIn = !!currentUser;
  document.getElementById("nav-login").style.display    = loggedIn ? "none" : "";
  document.getElementById("nav-register").style.display = loggedIn ? "none" : "";
  document.getElementById("nav-profile").style.display  = loggedIn ? "" : "none";
  document.getElementById("nav-logout").style.display   = loggedIn ? "" : "none";
  document.getElementById("mob-login").style.display    = loggedIn ? "none" : "";
  document.getElementById("mob-register").style.display = loggedIn ? "none" : "";
  document.getElementById("mob-profile").style.display  = loggedIn ? "" : "none";
  document.getElementById("mob-logout").style.display   = loggedIn ? "" : "none";
}

function logout() {
  clearToken();
  currentUser = null;
  updateNavAuth();
  navigate("home");
  toast("Logged out", "info");
}

// ─── MOBILE MENU ──────────────────────────────────────────────
function openMobileMenu() {
  document.getElementById("mobile-menu").classList.add("open");
  document.getElementById("mobile-overlay").classList.add("open");
}
function closeMobileMenu() {
  document.getElementById("mobile-menu").classList.remove("open");
  document.getElementById("mobile-overlay").classList.remove("open");
}

// ─── HOME PAGE ────────────────────────────────────────────────
const COMMANDS = [
  { name: ".daily",        desc: "Claim daily coin reward",           cat: "economy" },
  { name: ".bal",          desc: "Check wallet & bank balance",       cat: "economy" },
  { name: ".deposit [n]",  desc: "Move coins to your bank",           cat: "economy" },
  { name: ".withdraw [n]", desc: "Take coins from your bank",         cat: "economy" },
  { name: ".richlist",     desc: "See the top coin earners",          cat: "economy" },
  { name: ".transfer @u",  desc: "Send coins to another player",      cat: "economy" },
  { name: ".loan",         desc: "Borrow coins from the bank",        cat: "economy" },
  { name: ".shop",         desc: "Browse the item shop",              cat: "economy" },
  { name: ".buy [item]",   desc: "Purchase an item from the shop",    cat: "economy" },
  { name: ".cards",        desc: "View your card collection",         cat: "cards"   },
  { name: ".roll",         desc: "Roll a random card pack",           cat: "cards"   },
  { name: ".trade @u",     desc: "Trade cards with another player",   cat: "cards"   },
  { name: ".burn [card]",  desc: "Burn a card for bonus rewards",     cat: "cards"   },
  { name: ".cardinfo",     desc: "See full details of any card",      cat: "cards"   },
  { name: ".search [name]",desc: "Search for a specific card",        cat: "cards"   },
  { name: ".inventory",    desc: "View your item inventory",          cat: "cards"   },
  { name: "#hunt",         desc: "Spawn a wild Pokémon",              cat: "pokemon" },
  { name: "#catch",        desc: "Throw a Pokéball",                  cat: "pokemon" },
  { name: "#party",        desc: "View your Pokémon party",           cat: "pokemon" },
  { name: "#battle @u",    desc: "Challenge to a Pokémon battle",     cat: "pokemon" },
  { name: "#dex [name]",   desc: "Look up Pokédex info",              cat: "pokemon" },
  { name: "#evolve",       desc: "Evolve your Pokémon if eligible",   cat: "pokemon" },
  { name: "#trainer",      desc: "View your trainer card & stats",    cat: "pokemon" },
  { name: "#release",      desc: "Release a Pokémon from your party", cat: "pokemon" },
  { name: ".profile",      desc: "View your profile card",            cat: "social"  },
  { name: ".top",          desc: "Group XP leaderboard",              cat: "social"  },
  { name: ".guild",        desc: "Create or join a guild",            cat: "social"  },
  { name: ".afk [msg]",    desc: "Set away status with a message",    cat: "social"  },
  { name: ".myid",         desc: "Get your unique bot ID number",     cat: "social"  },
  { name: ".achievements", desc: "View your milestone badges",        cat: "social"  },
  { name: ".bio [text]",   desc: "Set your public profile bio",       cat: "social"  },
  { name: ".dungeon",      desc: "Enter the dungeon raid",            cat: "rpg"     },
  { name: ".equip [item]", desc: "Equip a weapon or armor piece",     cat: "rpg"     },
  { name: ".class [name]", desc: "Choose or change your RPG class",   cat: "rpg"     },
  { name: ".attack",       desc: "Attack in an active dungeon battle",cat: "rpg"     },
  { name: ".heal",         desc: "Use a health potion",               cat: "rpg"     },
  { name: ".skills",       desc: "View your RPG skill tree",          cat: "rpg"     },
  { name: ".stats",        desc: "See your combat stats",             cat: "rpg"     },
];
let cmdActiveTab = "all";

async function renderHome() {
  renderCmdGrid();
  try {
    const stats = await api("/stats");
    if (document.getElementById("stat-users"))   document.getElementById("stat-users").textContent   = fmtNum(stats.users);
    if (document.getElementById("stat-pokemon")) document.getElementById("stat-pokemon").textContent = fmtNum(stats.pokemons);
    if (document.getElementById("stat-guilds"))  document.getElementById("stat-guilds").textContent  = fmtNum(stats.guilds);
  } catch { /* show dashes */ }
}

function renderCmdGrid(search = "", tab = cmdActiveTab) {
  const grid = document.getElementById("cmd-grid");
  if (!grid) return;
  const q = search.toLowerCase();
  const cmds = COMMANDS.filter(c =>
    (tab === "all" || c.cat === tab) &&
    (!q || c.name.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q))
  );
  if (!cmds.length) { grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><p>No commands match your search.</p></div>`; return; }
  const CAT_LABELS = { economy:"Economy", cards:"Cards", pokemon:"Pokémon", social:"Social", rpg:"RPG" };
  grid.innerHTML = cmds.map(c => `
    <div class="cmd-card">
      <div class="cmd-card-body">
        <div class="cmd-name">${c.name}</div>
        <div class="cmd-desc">${c.desc}</div>
      </div>
      <div class="cmd-badge">${CAT_LABELS[c.cat] || c.cat}</div>
    </div>`).join("");
}

function filterCmds(val) { renderCmdGrid(val, cmdActiveTab); }

function setCmdTab(tab, el) {
  cmdActiveTab = tab;
  document.querySelectorAll(".cmd-tab").forEach(t => t.classList.remove("active"));
  if (el) el.classList.add("active");
  const search = document.querySelector(".cmd-search");
  renderCmdGrid(search ? search.value : "", tab);
}

// ─── SHOP ─────────────────────────────────────────────────────
let shopItems = [], shopFilter = "all";

async function renderShop() {
  if (shopItems.length === 0) {
    try { shopItems = await api("/shop"); }
    catch { empty("shop-grid", "Failed to load shop"); return; }
  }
  const chip = document.getElementById("shop-balance-chip");
  if (chip && currentUser) { chip.textContent = `🪙 ${fmtNum(currentUser.wallet || 0)} coins`; chip.style.display = "inline-flex"; }
  renderShopGrid();
}

function renderShopGrid() {
  const items = shopFilter === "all" ? shopItems : shopItems.filter(i => i.type === shopFilter);
  const grid = document.getElementById("shop-grid");
  if (!items.length) { empty("shop-grid", "No items in this category"); return; }
  grid.innerHTML = items.map(item => `
    <div class="card shop-card">
      <div class="shop-emoji">${item.emoji}</div>
      <div class="shop-meta"><span class="type-badge type-${item.type}">${item.type}</span></div>
      <div class="shop-name">${item.name}</div>
      <div class="shop-desc">${item.description || ""}</div>
      <div class="shop-footer">
        <span class="shop-price">🪙 ${fmtNum(item.price)}</span>
        ${currentUser ? `<button class="btn btn-primary btn-sm" onclick="buyItem('${item.key}','${item.name}')">Buy</button>` : `<span style="font-size:0.75rem;color:var(--muted)">Login to buy</span>`}
      </div>
    </div>`).join("");
}

function setShopFilter(f) {
  shopFilter = f;
  document.querySelectorAll("#shop-filters .filter-pill").forEach(p => p.classList.toggle("active", p.dataset.f === f));
  renderShopGrid();
}

async function buyItem(key, name) {
  if (!currentUser) { toast("Login to buy items!", "error"); return; }
  const btn = document.querySelector(`button[onclick="buyItem('${key}','${name}')"]`);
  if (btn) { btn.disabled = true; btn.textContent = "…"; }
  try {
    const data = await api("/shop?action=buy", { method: "POST", body: JSON.stringify({ key }) });
    toast(`${data.item?.emoji || ""} ${data.message}`, "success");
    currentUser.wallet = data.newBalance;
    if (btn) { btn.textContent = "Bought ✓"; btn.style.background = "rgba(16,185,129,0.2)"; btn.style.color = "#34d399"; }
  } catch (e) {
    toast(e.message, "error");
    if (btn) { btn.disabled = false; btn.textContent = "Buy"; }
  }
}

// ─── LEADERBOARD ──────────────────────────────────────────────
let lbType = "xp";

async function renderLeaderboard() {
  loading("lb-body");
  try {
    const data = await api(`/leaderboard?type=${lbType}&limit=20`);
    const body = document.getElementById("lb-body");
    if (!data.length) { empty("lb-body", "No players yet"); return; }
    body.innerHTML = data.map(p => {
      const rankClass = p.rank === 1 ? "rank-1" : p.rank === 2 ? "rank-2" : p.rank === 3 ? "rank-3" : "rank-n";
      const val = lbType === "xp" ? `${fmtNum(p.xp)} XP` : lbType === "wallet" ? `🪙 ${fmtNum(p.wallet)}` : lbType === "bank" ? `🏦 ${fmtNum(p.bank)}` : `Lv ${p.level}`;
      return `
        <div class="lb-row">
          <div><div class="rank-badge ${rankClass}">${p.rank}</div></div>
          <div class="lb-avatar">${avatar(p.name)}</div>
          <div><div class="lb-name">${p.name}</div><div class="lb-phone">${p.phone || ""}</div></div>
          <div class="lb-val">${val}</div>
          <div class="lb-level">Lv ${p.level}</div>
        </div>`;
    }).join("");
  } catch { empty("lb-body", "Failed to load leaderboard"); }
}

function setLbType(type) {
  lbType = type;
  document.querySelectorAll("#lb-tabs .filter-pill").forEach(p => p.classList.toggle("active", p.dataset.t === type));
  renderLeaderboard();
}

// ─── CARDS PAGE ───────────────────────────────────────────────
let cardsPage = 1, cardsTier = "all", cardsSearch = "", cardsSearchTimer;

async function renderCards(page = 1) {
  cardsPage = page;
  loading("cards-grid");
  try {
    const params = new URLSearchParams({ page, limit: 24 });
    if (cardsTier !== "all") params.set("tier", cardsTier);
    if (cardsSearch) params.set("search", cardsSearch);
    const data = await api(`/cards?${params}`);
    const grid = document.getElementById("cards-grid");
    if (!data.cards.length) { empty("cards-grid", "No cards found"); renderPagination(0, 0); return; }
    grid.innerHTML = data.cards.map(c => {
      const tierClass = `tier-${c.tier || "T1"}`;
      return `
        <div class="anime-card anime-card-noimg ${tierClass}-card" title="${c.name}">
          <div class="anime-card-shine"></div>
          <div class="anime-card-symbol">${tierSymbol(c.tier)}</div>
          <div class="anime-card-center-name">${c.name}</div>
          <div class="anime-card-info">
            <div class="anime-card-name">${c.name}</div>
            <span class="tier-badge ${tierClass}">${c.rarity || c.tier}</span>
          </div>
        </div>`;
    }).join("");
    renderPagination(data.total, data.limit);
  } catch { empty("cards-grid", "Failed to load cards"); }
}

function renderPagination(total, limit) {
  const totalPages = Math.ceil(total / limit);
  const wrap = document.getElementById("cards-pagination");
  if (totalPages <= 1) { wrap.innerHTML = ""; return; }
  let html = "";
  const start = Math.max(1, cardsPage - 2), end = Math.min(totalPages, cardsPage + 2);
  if (start > 1) html += `<button class="page-btn" onclick="renderCards(1)">1</button>`;
  if (start > 2) html += `<span style="color:var(--muted);align-self:center">…</span>`;
  for (let i = start; i <= end; i++)
    html += `<button class="page-btn${i === cardsPage ? " active" : ""}" onclick="renderCards(${i})">${i}</button>`;
  if (end < totalPages - 1) html += `<span style="color:var(--muted);align-self:center">…</span>`;
  if (end < totalPages) html += `<button class="page-btn" onclick="renderCards(${totalPages})">${totalPages}</button>`;
  wrap.innerHTML = html;
}

function setCardsTier(t) {
  cardsTier = t;
  document.querySelectorAll("#cards-tiers .filter-pill").forEach(p => p.classList.toggle("active", p.dataset.t === t));
  renderCards(1);
}

function onCardsSearch(val) {
  clearTimeout(cardsSearchTimer); cardsSearch = val;
  cardsSearchTimer = setTimeout(() => renderCards(1), 400);
}

// ─── POKEMON PAGE ─────────────────────────────────────────────
const POKE_PAGE_SIZE = 24;
let _pokePage = 1, _pokeTypeFilter = "all", _pokeSearchQuery = "", _pokeTimer = null;
const _pokeCache = {};

const TYPE_COLORS = {
  fire:"#f97316",water:"#3b82f6",grass:"#22c55e",electric:"#eab308",
  psychic:"#ec4899",dragon:"#7c3aed",ghost:"#6b21a8",dark:"#374151",
  normal:"#6b7280",fighting:"#b45309",poison:"#9333ea",ground:"#d97706",
  flying:"#38bdf8",bug:"#65a30d",rock:"#78716c",ice:"#67e8f9",
  steel:"#94a3b8",fairy:"#f472b6",
};

function _tc(type) { return TYPE_COLORS[type] || "#6b7280"; }

async function _fetchPokeDetail(nameOrId) {
  const key = `d_${nameOrId}`;
  if (_pokeCache[key]) return _pokeCache[key];
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${nameOrId}`);
  if (!res.ok) return null;
  const d = await res.json();
  _pokeCache[key] = d;
  return d;
}

async function _fetchPokeList(offset, limit) {
  const key = `l_${offset}_${limit}`;
  if (_pokeCache[key]) return _pokeCache[key];
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${limit}&offset=${offset}`);
  const d = await res.json();
  _pokeCache[key] = d;
  return d;
}

function _getStat(stats, name) {
  const s = (stats || []).find(x => x.stat.name === name);
  return s ? s.base_stat : 0;
}

function _ownedIds() {
  if (!currentUser || !currentUser.pokemons) return new Set();
  return new Set((currentUser.pokemons).map(p => p.pokemon_id));
}

function _buildPokeCard(p) {
  const id = p.id;
  const name = p.name.charAt(0).toUpperCase() + p.name.slice(1).replace(/-/g, " ");
  const art = p.sprites?.other?.["official-artwork"]?.front_default
    || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
  const types = (p.types || []).map(t => t.type.name);
  const primary = types[0] || "normal";
  const tc = _tc(primary);
  const hp  = _getStat(p.stats, "hp");
  const atk = _getStat(p.stats, "attack");
  const def = _getStat(p.stats, "defense");
  const spd = _getStat(p.stats, "speed");
  const owned = _ownedIds().has(id);
  const typePills = types.map(t =>
    `<span class="poke-type-pill" style="background:${_tc(t)}22;color:${_tc(t)};border-color:${_tc(t)}44">${t}</span>`
  ).join("");
  return `
    <div class="poke-card-new" style="--tc:${tc}">
      ${owned ? `<div class="poke-owned-pin">Owned</div>` : ""}
      <div class="poke-card-top" style="background:linear-gradient(135deg,${tc}18,${tc}06)">
        <div class="poke-card-id">#${String(id).padStart(3,"0")}</div>
        <img class="poke-card-art" src="${art}" alt="${name}"
          onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png'">
        <div class="poke-card-name">${name}</div>
        <div class="poke-type-row">${typePills}</div>
      </div>
      <div class="poke-card-stats">
        <div class="poke-stat-row"><span class="poke-stat-lbl">❤️ HP</span><span class="poke-stat-num" style="color:#f87171">${hp}</span></div>
        <div class="poke-stat-row"><span class="poke-stat-lbl">⚔️ ATK</span><span class="poke-stat-num" style="color:#fbbf24">${atk}</span></div>
        <div class="poke-stat-row"><span class="poke-stat-lbl">🛡️ DEF</span><span class="poke-stat-num" style="color:#60a5fa">${def}</span></div>
        <div class="poke-stat-row"><span class="poke-stat-lbl">💨 SPD</span><span class="poke-stat-num" style="color:#34d399">${spd}</span></div>
      </div>
    </div>`;
}

async function renderPokemon(page = 1) {
  _pokePage = page;
  const grid = document.getElementById("poke-grid");
  const pagEl = document.getElementById("poke-pagination");
  if (!grid) return;
  grid.className = "";
  grid.innerHTML = `<div class="loading" style="grid-column:1/-1"><div class="spinner"></div></div>`;
  if (pagEl) pagEl.innerHTML = "";
  try {
    let pokemons = [], total = 0;
    if (_pokeSearchQuery) {
      const d = await _fetchPokeDetail(_pokeSearchQuery.toLowerCase()).catch(() => null);
      if (d) { pokemons = [d]; total = 1; }
      else { grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><p>No Pokémon found for "${_pokeSearchQuery}"</p></div>`; return; }
    } else if (_pokeTypeFilter !== "all") {
      const key = `type_${_pokeTypeFilter}`;
      if (!_pokeCache[key]) {
        const r = await fetch(`https://pokeapi.co/api/v2/type/${_pokeTypeFilter}`);
        const td = await r.json();
        _pokeCache[key] = (td.pokemon || []).map(p => ({ name: p.pokemon.name, url: p.pokemon.url }));
      }
      const list = _pokeCache[key];
      total = list.length;
      const offset = (page - 1) * POKE_PAGE_SIZE;
      const sl = list.slice(offset, offset + POKE_PAGE_SIZE);
      pokemons = (await Promise.all(sl.map(p => _fetchPokeDetail(p.name).catch(() => null)))).filter(Boolean);
    } else {
      const offset = (page - 1) * POKE_PAGE_SIZE;
      const ld = await _fetchPokeList(offset, POKE_PAGE_SIZE);
      total = Math.min(ld.count, 1025);
      pokemons = (await Promise.all(ld.results.map(p => _fetchPokeDetail(p.name).catch(() => null)))).filter(Boolean);
    }
    if (!pokemons.length) { grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><p>No Pokémon found.</p></div>`; return; }
    grid.className = "poke-grid-wrap";
    grid.innerHTML = pokemons.map(_buildPokeCard).join("");
    if (!_pokeSearchQuery && total > POKE_PAGE_SIZE && pagEl) {
      const pages = Math.ceil(total / POKE_PAGE_SIZE);
      let html = "";
      if (page > 1) html += `<button class="btn btn-ghost btn-sm" onclick="renderPokemon(${page-1})">← Prev</button>`;
      html += `<span style="font-size:.82rem;color:var(--muted);padding:0 12px;align-self:center">Page ${page} of ${pages}</span>`;
      if (page < pages) html += `<button class="btn btn-ghost btn-sm" onclick="renderPokemon(${page+1})">Next →</button>`;
      pagEl.innerHTML = html;
    }
  } catch { grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><p>Failed to load Pokédex. Check your connection.</p></div>`; }
}

function setPokeType(type) {
  _pokeTypeFilter = type;
  _pokeSearchQuery = "";
  const s = document.getElementById("poke-search");
  if (s) s.value = "";
  document.querySelectorAll("#poke-type-filters .filter-pill").forEach(b => b.classList.toggle("active", b.dataset.pt === type));
  renderPokemon(1);
}

function onPokeSearch(val) {
  clearTimeout(_pokeTimer);
  _pokeSearchQuery = val.trim();
  _pokeTimer = setTimeout(() => renderPokemon(1), 500);
}

// ─── MEMBERSHIP ───────────────────────────────────────────────
async function renderMembership() {}
function buyMembership(tier) { toast(`Send ".premium ${tier}" on WhatsApp to upgrade!`, "success"); }

// ─── PROFILE PAGE ─────────────────────────────────────────────
async function renderProfile() {
  if (!currentUser) { navigate("login"); return; }
  const wrap = document.getElementById("profile-content");
  if (wrap) wrap.innerHTML = `<div class="loading" style="padding:4rem"><div class="spinner"></div></div>`;
  try {
    const profile = await api("/profile");
    currentUser = profile;
    renderProfileData(profile);
  } catch {
    if (wrap) wrap.innerHTML = `<div class="empty" style="padding:4rem"><p>Failed to load profile. Please try again.</p></div>`;
  }
}

function renderProfileData(u) {
  const xpForNext = (u.level || 1) * 100;
  const xpPct = Math.min(100, Math.round(((u.xp || 0) % xpForNext) / xpForNext * 100));
  const phone = u.phone ? String(u.phone) : (u.jid ? u.jid.replace("@s.whatsapp.net","") : "");
  const pokeCount = (u.pokemons || []).length;
  const invCount  = (u.inventory || []).length;
  const achCount  = (u.achievements || []).length;

  document.getElementById("profile-content").innerHTML = `
  <div class="profile-page-wrap">
    <!-- Banner -->
    <div class="profile-cover-banner"></div>

    <!-- Identity Card -->
    <div class="profile-identity">
      <div class="profile-avatar-row">
        <div class="profile-avatar-big">${avatar(u.name)}</div>
        <div class="profile-name-block">
          <div class="profile-display-name">${u.name || u.username || "Adventurer"}</div>
          <div class="profile-sub">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.18 8.93a2 2 0 0 1 1.99-2.18h3A2 2 0 0 1 11.14 8c.167.93.44 1.84.82 2.71a2 2 0 0 1-.45 2.11L10.09 14.1a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.87.38 1.78.65 2.71.82A2 2 0 0 1 24 21.17"/></svg>
            +${phone}
          </div>
          <div class="profile-badges-row">
            <span class="profile-badge badge-class">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>
              ${u.rpg?.class || "Adventurer"}
            </span>
            ${u.isMod   ? `<span class="profile-badge badge-mod"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Mod</span>` : ""}
            ${u.isAdmin ? `<span class="profile-badge badge-admin"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> Admin</span>` : ""}
          </div>
        </div>
      </div>

      <!-- XP Bar -->
      <div class="profile-xp-section">
        <div class="profile-xp-labels">
          <span>Level ${u.level || 1}</span>
          <span>${fmtNum(u.xp || 0)} / ${fmtNum(xpForNext)} XP</span>
        </div>
        <div class="profile-xp-track">
          <div class="profile-xp-fill" style="width:${xpPct}%"></div>
        </div>
      </div>
    </div>

    <!-- Stats Row -->
    <div class="profile-stats-row">
      <div class="profile-stat-box">
        <div class="ps-icon">🪙</div>
        <div class="ps-val">${fmtNum(u.wallet || 0)}</div>
        <div class="ps-lbl">Wallet</div>
      </div>
      <div class="profile-stat-box">
        <div class="ps-icon">🏦</div>
        <div class="ps-val">${fmtNum(u.bank || 0)}</div>
        <div class="ps-lbl">Bank</div>
      </div>
      <div class="profile-stat-box">
        <div class="ps-icon">⚡</div>
        <div class="ps-val">${u.level || 1}</div>
        <div class="ps-lbl">Level</div>
      </div>
      <div class="profile-stat-box">
        <div class="ps-icon">✨</div>
        <div class="ps-val">${fmtNum(u.xp || 0)}</div>
        <div class="ps-lbl">Total XP</div>
      </div>
      <div class="profile-stat-box">
        <div class="ps-icon">🔥</div>
        <div class="ps-val">${u.streak || 0}</div>
        <div class="ps-lbl">Streak</div>
      </div>
      <div class="profile-stat-box">
        <div class="ps-icon">🎱</div>
        <div class="ps-val">${u.pokeBalls || 0}</div>
        <div class="ps-lbl">Pokéballs</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="profile-tabs">
      <button class="ptab-btn active" onclick="switchPTab('overview',this)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        Overview
      </button>
      <button class="ptab-btn" onclick="switchPTab('pokemon',this)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 8a4 4 0 0 1 0 8"/></svg>
        Pokémon
        <span class="ptab-count">${pokeCount}</span>
      </button>
      <button class="ptab-btn" onclick="switchPTab('inventory',this)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        Inventory
        <span class="ptab-count">${invCount}</span>
      </button>
      <button class="ptab-btn" onclick="switchPTab('rpg',this)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/><path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/><path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/><path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/><path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/><path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/><path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z"/><path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"/></svg>
        RPG
      </button>
    </div>

    <!-- Overview Tab -->
    <div id="ptab-overview" class="ptab-content active">
      <div class="profile-overview-grid">
        <div class="poc">
          <div class="poc-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>
            Achievements <span class="ptab-count" style="font-size:.68rem">${achCount}</span>
          </div>
          ${achCount ? `<div style="display:flex;flex-direction:column;gap:7px">${(u.achievements).slice(0,6).map(a=>`
            <div class="achievement-chip">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="gold" stroke="none"><path d="M12 2l2.4 5.4H20l-4.8 3.6 1.8 5.4-5-3.6-5 3.6 1.8-5.4L4 7.4h5.6z"/></svg>
              ${a}
            </div>`).join("")}</div>` :
            `<div class="empty" style="padding:1.5rem 0;justify-content:flex-start"><p>No achievements yet. Keep playing!</p></div>`}
        </div>
        <div class="poc">
          <div class="poc-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            Pet Companion
          </div>
          <div class="pet-card">
            <div class="pet-icon">🐾</div>
            <div>
              <div class="pet-name">${u.pet?.name || "No pet yet"}</div>
              <div class="pet-meta">${u.pet?.type ? `${u.pet.type} · Lv ${u.pet.level || 1} · Hunger ${u.pet.hunger || 0}%` : "Adopt a pet via WhatsApp"}</div>
            </div>
          </div>
          ${u.bio ? `<div style="margin-top:12px;padding:10px 12px;background:rgba(255,255,255,.03);border-radius:8px;border:1px solid var(--border);font-size:.83rem;color:var(--muted);line-height:1.6">"${u.bio}"</div>` : ""}
        </div>
      </div>
    </div>

    <!-- Pokemon Tab -->
    <div id="ptab-pokemon" class="ptab-content">
      ${pokeCount ? `<div class="profile-poke-grid">
        ${(u.pokemons).map(p => `
          <div class="profile-poke-card">
            <img class="profile-poke-sprite" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.pokemon_id}.png" alt="${p.name}" onerror="this.src=''">
            <div class="profile-poke-name">${p.name}</div>
            <div class="profile-poke-meta">#${p.pokemon_id} · Lv ${p.level || 1}</div>
            <div class="poke-tags">
              ${p.in_party ? `<span class="in-party">Party</span>` : ""}
              ${p.is_shiny ? `<span class="poke-shiny">✨ Shiny</span>` : ""}
            </div>
          </div>`).join("")}
      </div>` :
      `<div class="empty" style="padding:3rem"><p>No Pokémon yet.<br>Send <strong>#hunt</strong> in WhatsApp to catch one!</p></div>`}
    </div>

    <!-- Inventory Tab -->
    <div id="ptab-inventory" class="ptab-content">
      ${invCount ? `<div class="profile-inv-grid">
        ${(u.inventory).map(i => `
          <div class="profile-inv-card">
            <div class="inv-emoji">${i.emoji || "📦"}</div>
            <div class="inv-name">${i.item || i.name}</div>
            <div class="inv-qty">×${i.quantity || 1}</div>
          </div>`).join("")}
      </div>` :
      `<div class="empty" style="padding:3rem"><p>Inventory empty.<br>Visit the <a href="#shop" data-page="shop" style="color:var(--accent)">Shop</a> to gear up!</p></div>`}
    </div>

    <!-- RPG Tab -->
    <div id="ptab-rpg" class="ptab-content">
      <div class="rpg-stats-grid">
        <div class="rpg-stat-card"><div class="rpg-icon">❤️</div><div><div class="rpg-key">HP</div><div class="rpg-val" style="color:#f87171">${u.rpg?.hp||100}/${u.rpg?.maxHp||100}</div></div></div>
        <div class="rpg-stat-card"><div class="rpg-icon">⚔️</div><div><div class="rpg-key">Attack</div><div class="rpg-val" style="color:#fbbf24">${u.rpg?.attack||10}</div></div></div>
        <div class="rpg-stat-card"><div class="rpg-icon">🛡️</div><div><div class="rpg-key">Defense</div><div class="rpg-val" style="color:#60a5fa">${u.rpg?.defense||5}</div></div></div>
        <div class="rpg-stat-card"><div class="rpg-icon">💨</div><div><div class="rpg-key">Speed</div><div class="rpg-val" style="color:#34d399">${u.rpg?.speed||8}</div></div></div>
        <div class="rpg-stat-card"><div class="rpg-icon">🏅</div><div><div class="rpg-key">Gold</div><div class="rpg-val" style="color:gold">${u.rpg?.gold||0}</div></div></div>
        <div class="rpg-stat-card"><div class="rpg-icon">🗺️</div><div><div class="rpg-key">Dungeon</div><div class="rpg-val">Floor ${u.rpg?.dungeonLevel||1}</div></div></div>
      </div>
      <div class="rpg-equip-row">
        <div class="rpg-equip-card"><div class="rpg-equip-icon">⚔️</div><div><div class="rpg-equip-label">Weapon</div><div class="rpg-equip-val">${u.rpg?.weapon||"Iron Sword"}</div></div></div>
        <div class="rpg-equip-card"><div class="rpg-equip-icon">🛡️</div><div><div class="rpg-equip-label">Armor</div><div class="rpg-equip-val">${u.rpg?.armor||"Leather Armor"}</div></div></div>
      </div>
    </div>
  </div>`;

  // Wire up nav links inside the rendered profile
  document.querySelectorAll("#profile-content [data-page]").forEach(el => {
    el.addEventListener("click", e => { e.preventDefault(); navigate(el.dataset.page); });
  });
}

function switchPTab(id, btn) {
  document.querySelectorAll(".ptab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".ptab-content").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  const el = document.getElementById(`ptab-${id}`);
  if (el) el.classList.add("active");
}

// Legacy compat for older tab calls
function switchTab(id, btn) { switchPTab(id, btn); }

// ─── LOGIN PAGE ───────────────────────────────────────────────
function renderLogin() { if (currentUser) { navigate("profile"); return; } }

async function handleLogin(e) {
  e.preventDefault();
  const phone = document.getElementById("login-phone").value.trim();
  const password = document.getElementById("login-password").value;
  const err = document.getElementById("login-error");
  const btn = document.getElementById("login-btn");
  err.style.display = "none";
  btn.textContent = "Logging in…"; btn.disabled = true;
  try {
    const data = await api("/auth?action=login", { method: "POST", body: JSON.stringify({ phone, password }) });
    setToken(String(data.user.phone));
    currentUser = data.user;
    updateNavAuth();
    toast("Welcome back, " + (data.user.name || "adventurer") + "!", "success");
    navigate("profile");
  } catch (e2) {
    err.textContent = e2.message;
    err.style.display = "block";
  } finally {
    btn.textContent = "Login"; btn.disabled = false;
  }
}

// ─── REGISTER PAGE ────────────────────────────────────────────
function renderRegister() { if (currentUser) { navigate("profile"); return; } }

async function handleRegister(e) {
  e.preventDefault();
  const name     = document.getElementById("reg-name").value.trim();
  const phone    = document.getElementById("reg-phone").value.trim();
  const password = document.getElementById("reg-password").value;
  const confirm  = document.getElementById("reg-confirm").value;
  const err = document.getElementById("reg-error");
  const btn = document.getElementById("reg-btn");
  err.style.display = "none";
  btn.textContent = "Creating account…"; btn.disabled = true;
  try {
    await api("/auth?action=register", { method: "POST", body: JSON.stringify({ name, phone, password, confirm }) });
    toast("Account created! You can now login.", "success");
    navigate("login");
  } catch (e2) {
    err.textContent = e2.message;
    err.style.display = "block";
  } finally {
    btn.innerHTML = `Create Account <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>`;
    btn.disabled = false;
  }
}

// ─── INIT ─────────────────────────────────────────────────────
async function init() {
  document.querySelectorAll("[data-page]").forEach(el => {
    el.addEventListener("click", e => { e.preventDefault(); navigate(el.dataset.page); });
  });
  document.getElementById("hamburger").addEventListener("click", openMobileMenu);
  document.getElementById("mobile-overlay").addEventListener("click", closeMobileMenu);
  document.getElementById("mobile-close").addEventListener("click", closeMobileMenu);
  document.getElementById("nav-logout").addEventListener("click", logout);
  document.getElementById("mob-logout").addEventListener("click", logout);
  window.addEventListener("popstate", e => { const page = e.state?.page || "home"; navigate(page, false); });
  await loadUser();
  const hash = location.hash.replace("#","") || "home";
  navigate(ROUTES[hash] ? hash : "home", false);
  history.replaceState({ page: currentPage }, "", `#${currentPage}`);
}

document.addEventListener("DOMContentLoaded", init);

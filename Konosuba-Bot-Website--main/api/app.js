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

function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n ?? 0);
}

function avatar(name) {
  return (name || "?").charAt(0).toUpperCase();
}

function loading(id) {
  document.getElementById(id).innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
}

function empty(id, msg = "Nothing here yet") {
  document.getElementById(id).innerHTML = `<div class="empty"><p>${msg}</p></div>`;
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
  document.getElementById("nav-login").style.display = loggedIn ? "none" : "";
  document.getElementById("nav-register").style.display = loggedIn ? "none" : "";
  document.getElementById("nav-profile").style.display = loggedIn ? "" : "none";
  document.getElementById("nav-logout").style.display = loggedIn ? "" : "none";
  document.getElementById("mob-login").style.display = loggedIn ? "none" : "";
  document.getElementById("mob-register").style.display = loggedIn ? "none" : "";
  document.getElementById("mob-profile").style.display = loggedIn ? "" : "none";
  document.getElementById("mob-logout").style.display = loggedIn ? "" : "none";
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
async function renderHome() {
  // Load live stats
  try {
    const stats = await api("/stats");
    document.getElementById("stat-users").textContent = fmtNum(stats.users);
    document.getElementById("stat-cards").textContent = fmtNum(stats.cards);
    document.getElementById("stat-pokemon").textContent = fmtNum(stats.pokemons);
    document.getElementById("stat-guilds").textContent = fmtNum(stats.guilds);
  } catch { /* show dashes */ }
}

// ─── SHOP PAGE ────────────────────────────────────────────────
let shopItems = [];
let shopFilter = "all";

async function renderShop() {
  if (shopItems.length === 0) {
    try {
      shopItems = await api("/shop");
    } catch (e) {
      empty("shop-grid", "Failed to load shop");
      return;
    }
  }
  renderShopGrid();
}

function renderShopGrid() {
  const items = shopFilter === "all" ? shopItems : shopItems.filter(i => i.type === shopFilter);
  const grid = document.getElementById("shop-grid");
  if (!items.length) { empty("shop-grid", "No items in this category"); return; }
  grid.innerHTML = items.map(item => `
    <div class="card shop-card">
      <div class="shop-emoji">${item.emoji}</div>
      <div class="shop-meta">
        <span class="type-badge type-${item.type}">${item.type}</span>
      </div>
      <div class="shop-name">${item.name}</div>
      <div class="shop-desc">${item.description || ""}</div>
      <div class="shop-footer">
        <span class="shop-price">🪙 ${fmtNum(item.price)}</span>
        ${currentUser ? `<button class="btn btn-primary btn-sm" onclick="buyItem('${item.key}','${item.name}')">Buy</button>` : `<span style="font-size:0.75rem;color:var(--muted)">Login to buy</span>`}
      </div>
    </div>
  `).join("");
}

function setShopFilter(f) {
  shopFilter = f;
  document.querySelectorAll("#shop-filters .filter-pill").forEach(p => p.classList.toggle("active", p.dataset.f === f));
  renderShopGrid();
}

function buyItem(key, name) {
  toast(`Send ".buy ${key}" on WhatsApp to purchase ${name}!`, "success");
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
          <div>
            <div class="lb-name">${p.name}</div>
            <div class="lb-phone">${p.phone}</div>
          </div>
          <div class="lb-val">${val}</div>
          <div class="lb-level">Lv ${p.level}</div>
        </div>`;
    }).join("");
  } catch (e) {
    empty("lb-body", "Failed to load leaderboard");
  }
}

function setLbType(type) {
  lbType = type;
  document.querySelectorAll("#lb-tabs .filter-pill").forEach(p => p.classList.toggle("active", p.dataset.t === type));
  renderLeaderboard();
}

// ─── CARDS PAGE ───────────────────────────────────────────────
let cardsPage = 1;
let cardsTier = "all";
let cardsSearch = "";
let cardsSearchTimer;

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
        <div class="anime-card">
          <img src="${c.image_url}" alt="${c.name}" loading="lazy"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div class="anime-card-fallback" style="display:none;background:var(--bg3)">🃏</div>
          <div class="anime-card-info">
            <div class="anime-card-name">${c.name}</div>
            <span class="tier-badge ${tierClass}">${c.rarity || c.tier}</span>
          </div>
        </div>`;
    }).join("");
    renderPagination(data.total, data.limit);
  } catch {
    empty("cards-grid", "Failed to load cards");
  }
}

function renderPagination(total, limit) {
  const totalPages = Math.ceil(total / limit);
  const wrap = document.getElementById("cards-pagination");
  if (totalPages <= 1) { wrap.innerHTML = ""; return; }
  let html = "";
  const start = Math.max(1, cardsPage - 2);
  const end = Math.min(totalPages, cardsPage + 2);
  if (start > 1) html += `<button class="page-btn" onclick="renderCards(1)">1</button>`;
  if (start > 2) html += `<span style="color:var(--muted);align-self:center">…</span>`;
  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn${i === cardsPage ? " active" : ""}" onclick="renderCards(${i})">${i}</button>`;
  }
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
  clearTimeout(cardsSearchTimer);
  cardsSearch = val;
  cardsSearchTimer = setTimeout(() => renderCards(1), 400);
}

// ─── POKEMON PAGE ─────────────────────────────────────────────
const POKE_PAGE_SIZE = 24;
let pokeOffset = 0;
let pokeTypeFilter = 'all';
let pokeSearchQuery = '';
let pokeSearchTimer = null;
let pokeCache = {};

const TYPE_COLORS = {
  fire: '#f97316', water: '#3b82f6', grass: '#22c55e', electric: '#eab308',
  psychic: '#ec4899', dragon: '#7c3aed', ghost: '#6b21a8', dark: '#1f2937',
  normal: '#6b7280', fighting: '#b45309', poison: '#9333ea', ground: '#d97706',
  flying: '#38bdf8', bug: '#65a30d', rock: '#78716c', ice: '#67e8f9',
  steel: '#94a3b8', fairy: '#f472b6',
};

async function fetchPokeList(offset, limit) {
  const key = `list_${offset}_${limit}`;
  if (pokeCache[key]) return pokeCache[key];
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${limit}&offset=${offset}`);
  const data = await res.json();
  pokeCache[key] = data;
  return data;
}

async function fetchPokeDetail(nameOrId) {
  const key = `detail_${nameOrId}`;
  if (pokeCache[key]) return pokeCache[key];
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${nameOrId}`);
  if (!res.ok) return null;
  const data = await res.json();
  pokeCache[key] = data;
  return data;
}

function getStatVal(stats, name) {
  const s = (stats || []).find(s => s.stat.name === name);
  return s ? s.base_stat : 0;
}

function buildPokeCard(p) {
  const id = p.id;
  const name = p.name.charAt(0).toUpperCase() + p.name.slice(1).replace(/-/g, ' ');
  const sprite = p.sprites?.other?.['official-artwork']?.front_default
    || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
  const types = (p.types || []).map(t => t.type.name);
  const primaryType = types[0] || 'normal';
  const typeColor = TYPE_COLORS[primaryType] || '#6b7280';

  const hp  = Math.round(getStatVal(p.stats, 'hp')      * 1.5);
  const atk = Math.round(getStatVal(p.stats, 'attack')  * 1.5);
  const def = Math.round(getStatVal(p.stats, 'defense') * 1.5);
  const spd = Math.round(getStatVal(p.stats, 'speed')   * 1.5);

  const typeBadges = types.map(t =>
    `<span style="background:${TYPE_COLORS[t] || '#6b7280'}22;color:${TYPE_COLORS[t] || '#6b7280'};border:1px solid ${TYPE_COLORS[t] || '#6b7280'}44;border-radius:99px;padding:2px 8px;font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">${t}</span>`
  ).join('');

  return `
    <div class="card" style="padding:0;overflow:hidden;cursor:default;transition:transform 0.2s" onmouseenter="this.style.transform='translateY(-4px)'" onmouseleave="this.style.transform=''">
      <div style="background:linear-gradient(135deg,${typeColor}18,${typeColor}08);padding:1.25rem 1rem 0.75rem;text-align:center;border-bottom:1px solid var(--border)">
        <div style="font-size:0.68rem;color:var(--muted);font-weight:600;margin-bottom:6px">#${String(id).padStart(3,'0')}</div>
        <img src="${sprite}" alt="${name}" width="96" height="96" style="image-rendering:auto;display:block;margin:0 auto 8px" onerror="this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png'">
        <div style="font-weight:800;font-size:0.95rem;margin-bottom:6px">${name}</div>
        <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap">${typeBadges}</div>
      </div>
      <div style="padding:10px 14px;display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <div style="font-size:0.7rem;display:flex;justify-content:space-between"><span style="color:var(--muted)">❤️ HP</span><strong>${hp}</strong></div>
        <div style="font-size:0.7rem;display:flex;justify-content:space-between"><span style="color:var(--muted)">⚔️ ATK</span><strong>${atk}</strong></div>
        <div style="font-size:0.7rem;display:flex;justify-content:space-between"><span style="color:var(--muted)">🛡️ DEF</span><strong>${def}</strong></div>
        <div style="font-size:0.7rem;display:flex;justify-content:space-between"><span style="color:var(--muted)">💨 SPD</span><strong>${spd}</strong></div>
      </div>
    </div>`;
}

async function renderPokemon(page = 1) {
  const grid = document.getElementById('poke-grid');
  const pagEl = document.getElementById('poke-pagination');
  if (!grid) return;

  grid.innerHTML = `<div class="loading" style="grid-column:1/-1"><div class="spinner"></div></div>`;
  if (pagEl) pagEl.innerHTML = '';

  try {
    let pokemons = [];
    let total = 0;

    if (pokeSearchQuery) {
      const detail = await fetchPokeDetail(pokeSearchQuery.toLowerCase().trim()).catch(() => null);
      if (detail) {
        pokemons = [detail];
        total = 1;
      } else {
        grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><p>No Pokémon found for "${pokeSearchQuery}"</p></div>`;
        return;
      }
    } else if (pokeTypeFilter !== 'all') {
      const key = `type_${pokeTypeFilter}`;
      if (!pokeCache[key]) {
        const res = await fetch(`https://pokeapi.co/api/v2/type/${pokeTypeFilter}`);
        const data = await res.json();
        pokeCache[key] = (data.pokemon || []).map(p => ({ name: p.pokemon.name, url: p.pokemon.url }));
      }
      const typeList = pokeCache[key];
      total = typeList.length;
      const offset = (page - 1) * POKE_PAGE_SIZE;
      const slice = typeList.slice(offset, offset + POKE_PAGE_SIZE);
      pokemons = await Promise.all(slice.map(p => fetchPokeDetail(p.name).catch(() => null)));
      pokemons = pokemons.filter(Boolean);
    } else {
      const offset = (page - 1) * POKE_PAGE_SIZE;
      const listData = await fetchPokeList(offset, POKE_PAGE_SIZE);
      total = Math.min(listData.count, 1025);
      pokemons = await Promise.all(listData.results.map(p => fetchPokeDetail(p.name).catch(() => null)));
      pokemons = pokemons.filter(Boolean);
    }

    if (!pokemons.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><p>No Pokémon found.</p></div>`;
      return;
    }

    grid.innerHTML = pokemons.map(buildPokeCard).join('');

    if (!pokeSearchQuery && total > POKE_PAGE_SIZE && pagEl) {
      const pages = Math.ceil(total / POKE_PAGE_SIZE);
      let html = '';
      if (page > 1) html += `<button class="btn btn-ghost btn-sm" onclick="renderPokemon(${page - 1})">← Prev</button>`;
      html += `<span style="font-size:0.85rem;color:var(--muted);padding:0 12px">Page ${page} of ${pages}</span>`;
      if (page < pages) html += `<button class="btn btn-ghost btn-sm" onclick="renderPokemon(${page + 1})">Next →</button>`;
      pagEl.innerHTML = html;
    }
  } catch (err) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><p>Failed to load Pokédex. Check your connection.</p></div>`;
  }
}

function setPokeType(type) {
  pokeTypeFilter = type;
  pokeSearchQuery = '';
  const searchEl = document.getElementById('poke-search');
  if (searchEl) searchEl.value = '';
  document.querySelectorAll('#poke-type-filters .filter-pill').forEach(b => {
    b.classList.toggle('active', b.dataset.pt === type);
  });
  renderPokemon(1);
}

function onPokeSearch(val) {
  clearTimeout(pokeSearchTimer);
  pokeSearchQuery = val.trim();
  pokeSearchTimer = setTimeout(() => renderPokemon(1), 500);
}

// ─── MEMBERSHIP PAGE ──────────────────────────────────────────
async function renderMembership() {
  // static content, no API needed
}

function buyMembership(tier) {
  toast(`Send ".premium ${tier}" on WhatsApp to upgrade!`, "success");
}

// ─── PROFILE PAGE ─────────────────────────────────────────────
async function renderProfile() {
  if (!currentUser) { navigate("login"); return; }
  loading("profile-content");
  try {
    const profile = await api("/profile");
    currentUser = profile;
    renderProfileData(profile);
  } catch {
    document.getElementById("profile-content").innerHTML = `<div class="empty"><p>Failed to load profile</p></div>`;
  }
}

function renderProfileData(u) {
  const xpForNext = (u.level || 1) * 100;
  const xpPct = Math.min(100, Math.round(((u.xp || 0) % xpForNext) / xpForNext * 100));
  const phone = u.jid ? u.jid.replace("@s.whatsapp.net", "") : "";

  document.getElementById("profile-content").innerHTML = `
    <div class="profile-cover"></div>
    <div style="display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap">
      <div class="profile-avatar-wrap">
        <div class="profile-avatar">${avatar(u.name)}</div>
      </div>
    </div>
    <div class="profile-header-content">
      <div class="profile-name">${u.name || u.username || "User"}</div>
      <div class="profile-phone">+${phone}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap">
        <span class="type-badge type-weapon">${u.rpg?.class || "Adventurer"}</span>
        ${u.isMod ? `<span class="type-badge type-tool">Mod</span>` : ""}
        ${u.isAdmin ? `<span class="type-badge type-accessory">Admin</span>` : ""}
      </div>
      <div style="margin-top:10px">
        <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--muted)">
          <span>Level ${u.level || 1}</span><span>${u.xp || 0} XP</span>
        </div>
        <div class="xp-bar-wrap"><div class="xp-bar" style="width:${xpPct}%"></div></div>
      </div>
    </div>
    <div class="profile-stats">
      <div class="profile-stat"><div class="ps-val">🪙 ${fmtNum(u.wallet)}</div><div class="ps-lbl">Wallet</div></div>
      <div class="profile-stat"><div class="ps-val">🏦 ${fmtNum(u.bank)}</div><div class="ps-lbl">Bank</div></div>
      <div class="profile-stat"><div class="ps-val">⚡ ${u.level || 1}</div><div class="ps-lbl">Level</div></div>
      <div class="profile-stat"><div class="ps-val">✨ ${fmtNum(u.xp)}</div><div class="ps-lbl">XP</div></div>
      <div class="profile-stat"><div class="ps-val">🎯 ${u.streak || 0}</div><div class="ps-lbl">Streak</div></div>
      <div class="profile-stat"><div class="ps-val">🎱 ${u.pokeBalls || 0}</div><div class="ps-lbl">Pokéballs</div></div>
    </div>
    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('overview',this)">Overview</button>
      <button class="tab-btn" onclick="switchTab('pokemon',this)">Pokémon (${(u.pokemons||[]).length})</button>
      <button class="tab-btn" onclick="switchTab('inventory',this)">Inventory (${(u.inventory||[]).length})</button>
      <button class="tab-btn" onclick="switchTab('rpg',this)">RPG</button>
    </div>
    <div id="tab-overview" class="tab-content active">
      <div class="section-title" style="font-size:1rem;margin-bottom:1rem">Achievements</div>
      ${(u.achievements||[]).length ? `<div class="grid grid-3">${(u.achievements).map(a=>`<div class="card" style="padding:12px;font-size:0.85rem">🏆 ${a}</div>`).join("")}</div>` : `<div class="empty" style="padding:2rem"><p>No achievements yet. Keep playing!</p></div>`}
      <div style="margin-top:1.5rem">
        <div class="section-title" style="font-size:1rem;margin-bottom:1rem">Pet</div>
        <div class="card" style="display:flex;align-items:center;gap:16px;max-width:300px">
          <div style="font-size:2.5rem">🐾</div>
          <div>
            <div style="font-weight:700">${u.pet?.name || "No pet"}</div>
            <div style="font-size:0.78rem;color:var(--muted)">${u.pet?.type ? `${u.pet.type} · Lv ${u.pet.level} · Hunger ${u.pet.hunger}%` : "Adopt a pet in WhatsApp!"}</div>
          </div>
        </div>
      </div>
    </div>
    <div id="tab-pokemon" class="tab-content">
      ${(u.pokemons||[]).length ? `<div class="grid grid-2">${(u.pokemons).map(p=>`
        <div class="poke-card">
          <img class="poke-sprite" src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.pokemon_id}.png" alt="${p.name}" onerror="this.src=''">
          <div>
            <div class="poke-name">${p.name} <span style="font-size:0.75rem;color:var(--muted)">#${p.pokemon_id}</span></div>
            <div class="poke-meta">Lv ${p.level} · ${p.base_xp} XP</div>
            <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
              ${p.in_party ? `<span class="in-party">In Party</span>` : ""}
              ${p.is_shiny ? `<span class="poke-shiny">✨ Shiny</span>` : ""}
            </div>
          </div>
        </div>`).join("")}</div>` : `<div class="empty" style="padding:2rem"><p>No Pokémon yet. Send .catch on WhatsApp!</p></div>`}
    </div>
    <div id="tab-inventory" class="tab-content">
      ${(u.inventory||[]).length ? `<div class="grid grid-2">${(u.inventory).map(i=>`
        <div class="card inv-item">
          <div class="inv-emoji">${i.emoji || "📦"}</div>
          <div><div class="inv-name">${i.item || i.name}</div><div class="inv-qty">Qty: <span>${i.quantity || 1}</span></div></div>
        </div>`).join("")}</div>` : `<div class="empty" style="padding:2rem"><p>Inventory empty. Visit the shop!</p></div>`}
    </div>
    <div id="tab-rpg" class="tab-content">
      <div class="rpg-grid">
        <div class="rpg-stat"><div class="rpg-stat-icon">❤️</div><div class="rpg-stat-info"><div class="val">${u.rpg?.hp||100}/${u.rpg?.maxHp||100}</div><div class="key">HP</div></div></div>
        <div class="rpg-stat"><div class="rpg-stat-icon">⚔️</div><div class="rpg-stat-info"><div class="val">${u.rpg?.attack||10}</div><div class="key">Attack</div></div></div>
        <div class="rpg-stat"><div class="rpg-stat-icon">🛡️</div><div class="rpg-stat-info"><div class="val">${u.rpg?.defense||5}</div><div class="key">Defense</div></div></div>
        <div class="rpg-stat"><div class="rpg-stat-icon">💨</div><div class="rpg-stat-info"><div class="val">${u.rpg?.speed||8}</div><div class="key">Speed</div></div></div>
        <div class="rpg-stat"><div class="rpg-stat-icon">🏅</div><div class="rpg-stat-info"><div class="val">${u.rpg?.gold||0}</div><div class="key">Gold</div></div></div>
        <div class="rpg-stat"><div class="rpg-stat-icon">🗺️</div><div class="rpg-stat-info"><div class="val">Floor ${u.rpg?.dungeonLevel||1}</div><div class="key">Dungeon</div></div></div>
      </div>
      <div style="margin-top:1.25rem;display:flex;gap:10px;flex-wrap:wrap">
        <div class="card" style="display:flex;align-items:center;gap:10px;flex:1;min-width:200px">
          <span style="font-size:1.5rem">⚔️</span><div><div style="font-weight:700;font-size:0.9rem">${u.rpg?.weapon||"Iron Sword"}</div><div style="font-size:0.75rem;color:var(--muted)">Weapon</div></div>
        </div>
        <div class="card" style="display:flex;align-items:center;gap:10px;flex:1;min-width:200px">
          <span style="font-size:1.5rem">🛡️</span><div><div style="font-weight:700;font-size:0.9rem">${u.rpg?.armor||"Leather Armor"}</div><div style="font-size:0.75rem;color:var(--muted)">Armor</div></div>
        </div>
      </div>
    </div>
  `;
}

function switchTab(id, btn) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
  btn.classList.add("active");
  const el = document.getElementById(`tab-${id}`);
  if (el) el.classList.add("active");
}

// ─── LOGIN PAGE ───────────────────────────────────────────────
function renderLogin() {
  if (currentUser) { navigate("profile"); return; }
}

async function handleLogin(e) {
  e.preventDefault();
  const phone = document.getElementById("login-phone").value.trim();
  const password = document.getElementById("login-password").value;
  const err = document.getElementById("login-error");
  const btn = document.getElementById("login-btn");
  err.style.display = "none";
  btn.textContent = "Logging in…"; btn.disabled = true;
  try {
    const data = await api("/auth?action=login", {
      method: "POST",
      body: JSON.stringify({ phone, password })
    });
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
function renderRegister() {
  if (currentUser) { navigate("profile"); return; }
}

function handleRegister(e) {
  e.preventDefault();
  const err = document.getElementById("reg-error");
  err.style.display = "none";
  err.textContent = "";
  toast("To register, send .register on WhatsApp to the Konosuba bot. Then login here!", "info");
  setTimeout(() => navigate("login"), 2500);
}

// ─── INIT ─────────────────────────────────────────────────────
async function init() {
  // Nav click handlers
  document.querySelectorAll("[data-page]").forEach(el => {
    el.addEventListener("click", e => { e.preventDefault(); navigate(el.dataset.page); });
  });

  document.getElementById("hamburger").addEventListener("click", openMobileMenu);
  document.getElementById("mobile-overlay").addEventListener("click", closeMobileMenu);
  document.getElementById("mobile-close").addEventListener("click", closeMobileMenu);
  document.getElementById("nav-logout").addEventListener("click", logout);
  document.getElementById("mob-logout").addEventListener("click", logout);

  // Handle browser back/forward
  window.addEventListener("popstate", e => {
    const page = e.state?.page || "home";
    navigate(page, false);
  });

  // Load user session
  await loadUser();

  // Determine initial page from hash
  const hash = location.hash.replace("#", "") || "home";
  navigate(ROUTES[hash] ? hash : "home", false);
  history.replaceState({ page: currentPage }, "", `#${currentPage}`);
}

document.addEventListener("DOMContentLoaded", init);

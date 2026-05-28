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
const COMMANDS = [
  { name: ".daily",       desc: "Claim daily coin reward",           cat: "economy" },
  { name: ".bal",         desc: "Check wallet & bank balance",       cat: "economy" },
  { name: ".deposit [n]", desc: "Move coins to your bank",           cat: "economy" },
  { name: ".withdraw [n]",desc: "Take coins from your bank",         cat: "economy" },
  { name: ".richlist",    desc: "See the top coin earners",          cat: "economy" },
  { name: ".transfer @u",  desc: "Send coins to another player",     cat: "economy" },
  { name: ".loan",        desc: "Borrow coins from the bank",        cat: "economy" },
  { name: ".shop",        desc: "Browse the item shop",              cat: "economy" },
  { name: ".buy [item]",  desc: "Purchase an item from the shop",    cat: "economy" },
  { name: ".cards",       desc: "View your card collection",         cat: "cards"   },
  { name: ".roll",        desc: "Roll a random card pack",           cat: "cards"   },
  { name: ".trade @u",    desc: "Trade cards with another player",   cat: "cards"   },
  { name: ".burn [card]", desc: "Burn a card for bonus rewards",     cat: "cards"   },
  { name: ".cardinfo",    desc: "See full details of any card",      cat: "cards"   },
  { name: ".search [name]",desc: "Search for a specific card",       cat: "cards"   },
  { name: ".inventory",   desc: "View your item inventory",          cat: "cards"   },
  { name: "#hunt",        desc: "Spawn a wild Pokémon",              cat: "pokemon" },
  { name: "#catch",       desc: "Throw a Pokéball",                  cat: "pokemon" },
  { name: "#party",       desc: "View your Pokémon party",           cat: "pokemon" },
  { name: "#battle @u",   desc: "Challenge to a Pokémon battle",     cat: "pokemon" },
  { name: "#dex [name]",  desc: "Look up Pokédex info",              cat: "pokemon" },
  { name: "#evolve",      desc: "Evolve your Pokémon if eligible",   cat: "pokemon" },
  { name: "#trainer",     desc: "View your trainer card & stats",    cat: "pokemon" },
  { name: "#release",     desc: "Release a Pokémon from your party", cat: "pokemon" },
  { name: ".profile",     desc: "View your profile card",            cat: "social"  },
  { name: ".top",         desc: "Group XP leaderboard",              cat: "social"  },
  { name: ".guild",       desc: "Create or join a guild",            cat: "social"  },
  { name: ".afk [msg]",   desc: "Set away status with a message",    cat: "social"  },
  { name: ".myid",        desc: "Get your unique bot ID number",     cat: "social"  },
  { name: ".achievements",desc: "View your milestone badges",        cat: "social"  },
  { name: ".bio [text]",  desc: "Set your public profile bio",       cat: "social"  },
  { name: ".dungeon",     desc: "Enter the dungeon raid",            cat: "rpg"     },
  { name: ".equip [item]",desc: "Equip a weapon or armor piece",     cat: "rpg"     },
  { name: ".class [name]",desc: "Choose or change your RPG class",   cat: "rpg"     },
  { name: ".attack",      desc: "Attack in an active dungeon battle",cat: "rpg"     },
  { name: ".heal",        desc: "Use a health potion",               cat: "rpg"     },
  { name: ".skills",      desc: "View your RPG skill tree",          cat: "rpg"     },
  { name: ".stats",       desc: "See your combat stats",             cat: "rpg"     },
];

let cmdActiveTab = "all";

async function renderHome() {
  renderCmdGrid();
  // Load live stats
  try {
    const stats = await api("/stats");
    if (document.getElementById("stat-users"))  document.getElementById("stat-users").textContent  = fmtNum(stats.users);
    if (document.getElementById("stat-pokemon"))document.getElementById("stat-pokemon").textContent = fmtNum(stats.pokemons);
    if (document.getElementById("stat-guilds")) document.getElementById("stat-guilds").textContent  = fmtNum(stats.guilds);
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
  if (!cmds.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><p>No commands match your search.</p></div>`;
    return;
  }
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

function filterCmds(val) {
  renderCmdGrid(val, cmdActiveTab);
}

function setCmdTab(tab, el) {
  cmdActiveTab = tab;
  document.querySelectorAll(".cmd-tab").forEach(t => t.classList.remove("active"));
  if (el) el.classList.add("active");
  const search = document.querySelector(".cmd-search");
  renderCmdGrid(search ? search.value : "", tab);
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
  const chip = document.getElementById("shop-balance-chip");
  if (chip && currentUser) {
    chip.textContent = `🪙 ${fmtNum(currentUser.wallet || 0)} coins`;
    chip.style.display = "inline-flex";
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

async function buyItem(key, name) {
  if (!currentUser) { toast("Login to buy items!", "error"); return; }
  const btn = document.querySelector(`button[onclick="buyItem('${key}','${name}')"]`);
  if (btn) { btn.disabled = true; btn.textContent = "…"; }
  try {
    const data = await api("/shop?action=buy", {
      method: "POST",
      body: JSON.stringify({ key }),
    });
    toast(`${data.item?.emoji || ""} ${data.message}`, "success");
    currentUser.wallet = data.newBalance;
    document.querySelectorAll(".shop-balance").forEach(el => el.textContent = `🪙 ${fmtNum(data.newBalance)}`);
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
let _allPoke = [];
let _pokePage = 1;
let _pokeSearch = "";
let _pokeType = "all";
const POKE_PER_PAGE = 20;

async function renderPokemon() {
  if (_allPoke.length === 0) {
    loading("poke-grid");
    try {
      const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=898");
      const data = await res.json();
      _allPoke = data.results.map((p, i) => ({
        id: i + 1,
        name: p.name.charAt(0).toUpperCase() + p.name.slice(1).replace(/-/g, " "),
        sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${i + 1}.png`,
      }));
    } catch {
      empty("poke-grid", "Failed to load Pokédex. Check your internet connection.");
      return;
    }
  }
  _renderPokeGrid();
}

function _filteredPoke() {
  return _allPoke.filter(p => {
    if (_pokeSearch && !p.name.toLowerCase().includes(_pokeSearch)) return false;
    return true;
  });
}

function _renderPokeGrid() {
  const filtered = _filteredPoke();
  const totalPages = Math.ceil(filtered.length / POKE_PER_PAGE);
  if (_pokePage > totalPages) _pokePage = 1;
  const slice = filtered.slice((_pokePage - 1) * POKE_PER_PAGE, _pokePage * POKE_PER_PAGE);
  const grid = document.getElementById("poke-grid");
  if (!slice.length) { empty("poke-grid", "No Pokémon found"); document.getElementById("poke-pagination").innerHTML = ""; return; }
  grid.innerHTML = slice.map(p => `
    <div class="poke-card">
      <img class="poke-sprite" src="${p.sprite}" alt="${p.name}" loading="lazy"
           onerror="this.style.display='none'">
      <div>
        <div class="poke-name">${p.name}</div>
        <div class="poke-meta">#${String(p.id).padStart(3, "0")}</div>
      </div>
    </div>
  `).join("");
  const paginEl = document.getElementById("poke-pagination");
  if (totalPages <= 1) { paginEl.innerHTML = ""; return; }
  const start = Math.max(1, _pokePage - 2), end = Math.min(totalPages, _pokePage + 2);
  let html = _pokePage > 1 ? `<button class="page-btn" onclick="_goToPokePage(1)">«</button>` : "";
  if (start > 2) html += `<span style="color:var(--muted);align-self:center">…</span>`;
  for (let i = start; i <= end; i++)
    html += `<button class="page-btn${i === _pokePage ? " active" : ""}" onclick="_goToPokePage(${i})">${i}</button>`;
  if (end < totalPages - 1) html += `<span style="color:var(--muted);align-self:center">…</span>`;
  if (_pokePage < totalPages) html += `<button class="page-btn" onclick="_goToPokePage(${totalPages})">»</button>`;
  paginEl.innerHTML = html;
}

function _goToPokePage(page) { _pokePage = page; _renderPokeGrid(); window.scrollTo(0, 0); }

function onPokeSearch(val) {
  _pokeSearch = val.toLowerCase().trim();
  _pokePage = 1;
  if (_allPoke.length) _renderPokeGrid();
}

function setPokeType(type) {
  _pokeType = type;
  document.querySelectorAll("#poke-type-filters .filter-pill").forEach(p =>
    p.classList.toggle("active", p.dataset.pt === type));
  _pokePage = 1;
  if (_allPoke.length) _renderPokeGrid();
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
  const phone = u.phone ? String(u.phone) : "";

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

async function handleRegister(e) {
  e.preventDefault();
  const name    = document.getElementById("reg-name").value.trim();
  const phone   = document.getElementById("reg-phone").value.trim();
  const password = document.getElementById("reg-password").value;
  const confirm  = document.getElementById("reg-confirm").value;
  const err = document.getElementById("reg-error");
  const btn = document.getElementById("reg-btn");
  err.style.display = "none";
  btn.textContent = "Creating account…"; btn.disabled = true;
  try {
    await api("/auth?action=register", {
      method: "POST",
      body: JSON.stringify({ name, phone, password, confirm })
    });
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

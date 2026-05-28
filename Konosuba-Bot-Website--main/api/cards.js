import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TIER_MAP = {
  Common:    "1",
  Uncommon:  "2",
  Rare:      "3",
  Epic:      "4",
  Legendary: "5",
  Mythic:    "6",
  Shadow:    "7",
  Void:      "8",
};

const TIER_NAME = {
  "1": "Common",
  "2": "Uncommon",
  "3": "Rare",
  "4": "Epic",
  "5": "Legendary",
  "6": "Mythic",
  "7": "Shadow",
  "8": "Void",
};

let _cards = null;
function loadCards() {
  if (!_cards) {
    const raw = readFileSync(join(__dirname, "../card.json"), "utf8");
    _cards = JSON.parse(raw);
  }
  return _cards;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    let cards = loadCards();

    const tierFilter = req.query.tier;
    const search     = (req.query.search || "").trim().toLowerCase();
    const page       = Math.max(1, parseInt(req.query.page  || "1"));
    const limit      = Math.min(48, parseInt(req.query.limit || "24"));

    if (tierFilter && tierFilter !== "all") {
      const numericTier = TIER_MAP[tierFilter] || tierFilter;
      cards = cards.filter(c => c.tier === numericTier);
    }

    if (search) {
      cards = cards.filter(c => (c.title || c.name || "").toLowerCase().includes(search));
    }

    const total = cards.length;
    const slice = cards.slice((page - 1) * limit, page * limit).map(c => ({
      name:   c.title || c.name || "Unknown",
      rarity: TIER_NAME[c.tier] || `T${c.tier}`,
      tier:   `T${c.tier}`,
      shoob_url: c.url,
    }));

    return res.json({ cards: slice, total, page, limit });
  } catch (err) {
    return res.status(500).json({ error: "Failed to load cards", detail: err.message });
  }
}

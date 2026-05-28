import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
let client;

async function getDb() {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  return client.db("test");
}

const SHOP_ITEMS = [
  { key: "sword",     name: "Sword",         price: 500,  type: "weapon",    emoji: "⚔️",  description: "A sharp blade for close combat." },
  { key: "shield",    name: "Shield",        price: 400,  type: "armor",     emoji: "🛡️",  description: "Protect yourself from enemy attacks." },
  { key: "bow",       name: "Bow",           price: 350,  type: "weapon",    emoji: "🏹",  description: "Strike from a distance." },
  { key: "dagger",    name: "Dagger",        price: 300,  type: "weapon",    emoji: "🗡️",  description: "Quick and deadly at close range." },
  { key: "staff",     name: "Magic Staff",   price: 600,  type: "weapon",    emoji: "🪄",  description: "Channel arcane power." },
  { key: "trident",   name: "Trident",       price: 550,  type: "weapon",    emoji: "🔱",  description: "Command the seas." },
  { key: "chainmail", name: "Chain Mail",    price: 450,  type: "armor",     emoji: "🥋",  description: "Flexible yet tough armor." },
  { key: "helmet",    name: "Helmet",        price: 300,  type: "armor",     emoji: "⛑️",  description: "Protect your head." },
  { key: "boots",     name: "Speed Boots",   price: 250,  type: "armor",     emoji: "👢",  description: "+5 speed in dungeons." },
  { key: "potion",    name: "Health Potion", price: 100,  type: "consumable",emoji: "🧪",  description: "Restore 50 HP instantly." },
  { key: "elixir",    name: "Elixir",        price: 300,  type: "consumable",emoji: "✨",  description: "Full HP restore." },
  { key: "bomb",      name: "Bomb",          price: 200,  type: "consumable",emoji: "💣",  description: "Deal AOE damage in dungeons." },
  { key: "antidote",  name: "Antidote",      price: 80,   type: "consumable",emoji: "💊",  description: "Cure poison status." },
  { key: "pickaxe",   name: "Pickaxe",       price: 400,  type: "tool",      emoji: "⛏️",  description: "Mine resources for crafting." },
  { key: "fishingrod",name: "Fishing Rod",   price: 350,  type: "tool",      emoji: "🎣",  description: "Catch rare fish for XP." },
  { key: "shovel",    name: "Shovel",        price: 280,  type: "tool",      emoji: "🪛",  description: "Dig for buried loot." },
  { key: "map",       name: "Dungeon Map",   price: 500,  type: "tool",      emoji: "🗺️",  description: "Navigate dungeons safely." },
  { key: "ring",      name: "Power Ring",    price: 700,  type: "accessory", emoji: "💍",  description: "+10 attack permanently." },
  { key: "amulet",    name: "Amulet",        price: 650,  type: "accessory", emoji: "📿",  description: "+10 defense permanently." },
  { key: "cape",      name: "Shadow Cape",   price: 800,  type: "accessory", emoji: "🧣",  description: "+8 speed, rare drop boost." },
  { key: "gloves",    name: "Combat Gloves", price: 400,  type: "accessory", emoji: "🥊",  description: "+5 attack, crit chance." },
  { key: "pokeball",  name: "Pokéball",      price: 150,  type: "tool",      emoji: "🎱",  description: "Catch wild Pokémon." },
  { key: "greatball", name: "Great Ball",    price: 300,  type: "tool",      emoji: "🔵",  description: "1.5x catch rate." },
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    const type = req.query.type;
    const items = type && type !== "all" ? SHOP_ITEMS.filter(i => i.type === type) : SHOP_ITEMS;
    return res.json(items);
  }

  if (req.method === "POST" && req.query.action === "buy") {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: "Login required to buy items." });

    const phone = Buffer.from(auth.replace("Bearer ", ""), "base64").toString();
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) return res.status(401).json({ error: "Invalid session. Please login again." });

    const { key } = req.body || {};
    if (!key) return res.status(400).json({ error: "No item specified." });

    const item = SHOP_ITEMS.find(i => i.key === key);
    if (!item) return res.status(404).json({ error: "Item not found in shop." });

    try {
      const db = await getDb();
      const user = await db.collection("users").findOne({ phone: cleanPhone });
      if (!user) return res.status(401).json({ error: "Account not found. Please login again." });
      if (user.banned) return res.status(403).json({ error: "Your account is banned." });

      const wallet = user.wallet || 0;
      if (wallet < item.price) {
        return res.status(400).json({
          error: `Not enough coins. You need ${item.price.toLocaleString()} 🪙 but only have ${wallet.toLocaleString()} 🪙.`
        });
      }

      const newWallet = wallet - item.price;
      await db.collection("users").updateOne(
        { phone: cleanPhone },
        { $inc: { wallet: -item.price } }
      );

      const inventory = user.inventory || [];
      const existingIdx = inventory.findIndex(i => (i.item || i.name) === item.name);

      if (existingIdx >= 0) {
        await db.collection("users").updateOne(
          { phone: cleanPhone, [`inventory.${existingIdx}.item`]: item.name },
          { $inc: { [`inventory.${existingIdx}.quantity`]: 1 } }
        );
        try {
          await db.collection("users").updateOne(
            { phone: cleanPhone, "inventory.item": item.name },
            { $inc: { "inventory.$.quantity": 1 } }
          );
        } catch {}
      } else {
        await db.collection("users").updateOne(
          { phone: cleanPhone },
          { $push: { inventory: { item: item.name, emoji: item.emoji, quantity: 1, type: item.type } } }
        );
      }

      return res.json({
        success: true,
        message: `Purchased ${item.emoji} ${item.name} for ${item.price.toLocaleString()} coins!`,
        newBalance: newWallet,
        item: { key: item.key, name: item.name, emoji: item.emoji, type: item.type },
      });
    } catch (err) {
      return res.status(500).json({ error: "Purchase failed. Please try again.", detail: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

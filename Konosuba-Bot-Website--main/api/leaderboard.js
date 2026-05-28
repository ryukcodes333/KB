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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const db = await getDb();
  const type = req.query.type || "xp";
  const limit = Math.min(parseInt(req.query.limit || "20"), 50);

  const sortField = ["xp", "wallet", "bank", "level"].includes(type) ? type : "xp";
  const sort = { [sortField]: -1 };

  const users = await db.collection("users")
    .find({ banned: { $ne: true } })
    .sort(sort)
    .limit(limit)
    .project({ name: 1, phone: 1, xp: 1, level: 1, wallet: 1, bank: 1, rank: 1, country: 1 })
    .toArray();

  const result = users.map((u, i) => ({
    rank: i + 1,
    name: u.name || "Unknown",
    phone: u.phone ? String(u.phone).replace(/(\d{3})\d+(\d{3})/, "$1****$2") : "***",
    xp: u.xp || 0,
    level: u.level || 1,
    wallet: u.wallet || 0,
    bank: u.bank || 0,
    country: u.country || ""
  }));

  return res.json(result);
}

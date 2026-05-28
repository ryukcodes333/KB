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

  const [users, cards, pokemons, guilds] = await Promise.all([
    db.collection("users").countDocuments({ bio: { $exists: true, $ne: "" } }),
    db.collection("cards").countDocuments(),
    db.collection("userpokemons").countDocuments(),
    db.collection("guilds").countDocuments()
  ]);

  return res.json({ users, cards, pokemons, guilds });
}

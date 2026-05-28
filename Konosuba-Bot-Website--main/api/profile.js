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

function getPhone(auth) {
  return Buffer.from(auth.replace("Bearer ", ""), "base64").toString();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "Unauthorized" });

  const db = await getDb();
  const phone = getPhone(auth);
  const cleanPhone = phone.replace(/\D/g, "");
  const user = await db.collection("users").findOne({ phone: cleanPhone });
  if (!user) return res.status(401).json({ error: "User not found" });

  if (req.method === "GET") {
    const [inventory, pokemons, cards] = await Promise.all([
      db.collection("inventories").find({ phone: cleanPhone }).toArray(),
      db.collection("userpokemons").find({ phone: cleanPhone }).toArray(),
      db.collection("usercards").find({ phone: cleanPhone }).toArray()
    ]);

    const { password: _p, ...safeUser } = user;
    return res.json({ ...safeUser, inventory, pokemons, cards });
  }

  if (req.method === "POST") {
    const { name, username } = req.body;
    const update = {};
    if (name) update.name = name;
    if (username) update.username = username;
    await db.collection("users").updateOne({ _id: user._id }, { $set: update });
    const updated = await db.collection("users").findOne({ _id: user._id });
    const { password: _p, ...safeUser } = updated;
    return res.json(safeUser);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

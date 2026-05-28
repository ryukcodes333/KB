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
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const db = await getDb();
  const { action } = req.query;

  if (action === "register" && req.method === "POST") {
    const { phone, name, password, confirm } = req.body;
    if (!phone || !name || !password) return res.status(400).json({ error: "Name, phone and password are required" });
    if (password !== confirm) return res.status(400).json({ error: "Passwords do not match" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 7 || cleanPhone.length > 15) return res.status(400).json({ error: "Enter a valid phone number with country code (e.g. 2348012345678)" });

    const existing = await db.collection("users").findOne({ phone: cleanPhone });
    if (existing) return res.status(409).json({ error: "Phone already registered. Please login instead." });

    const newUser = {
      phone: cleanPhone,
      name: name.trim().slice(0, 32),
      password,
      bio: "Web Member",
      wallet: 0,
      bank: 500,
      gems: 0,
      xp: 0,
      level: 1,
      streak: 0,
      banned: false,
      premium: false,
      role: "member",
      title: "Newcomer",
      created_at: new Date(),
    };

    await db.collection("users").insertOne(newUser);
    const { password: _p, ...safeUser } = newUser;
    return res.json({ success: true, user: safeUser });
  }

  if (action === "login" && req.method === "POST") {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ error: "Phone and password required" });

    const cleanPhone = phone.replace(/\D/g, "");
    const user = await db.collection("users").findOne({ phone: cleanPhone });

    if (!user) return res.status(401).json({ error: "No account found with that number. Please sign up first." });
    if (!user.password) return res.status(401).json({ error: "No password set. Register again with a password." });
    if (user.password !== password) return res.status(401).json({ error: "Wrong password. Try again." });
    if (user.banned) return res.status(403).json({ error: "Your account has been banned." });

    const { password: _p, ...safeUser } = user;
    return res.json({ success: true, user: safeUser });
  }

  if (action === "me" && req.method === "GET") {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: "No token" });

    const phone = Buffer.from(auth.replace("Bearer ", ""), "base64").toString();
    const cleanPhone = phone.replace(/\D/g, "");
    const user = await db.collection("users").findOne({ phone: cleanPhone });
    if (!user) return res.status(401).json({ error: "Session expired. Please login again." });

    const { password: _p, ...safeUser } = user;
    return res.json(safeUser);
  }

  return res.status(404).json({ error: "Unknown action" });
}

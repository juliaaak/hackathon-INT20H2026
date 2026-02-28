// Entry point: sets up Express app, auth routes, and starts the server
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDb } from "./db";
import ordersRouter from "./orders";
import { generateToken, createSession, destroySession } from "./auth";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Login: returns a session token on correct password
app.post("/api/login", (req, res) => {
  const { password } = req.body;
  if (!password || password !== ADMIN_PASSWORD) {
    res.status(403).json({ error: "Wrong password" });
    return;
  }
  const token = generateToken();
  createSession(token);
  res.json({ token });
});

// Logout: invalidates the session token
app.post("/api/logout", (req, res) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    destroySession(auth.slice(7));
  }
  res.json({ ok: true });
});

app.use("/api/orders", ordersRouter);

// Health check endpoint
app.get("/api/health", (_, res) => res.json({ ok: true }));

// Initialize DB then start server
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
});
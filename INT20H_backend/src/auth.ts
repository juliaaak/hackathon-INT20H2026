// Simple token-based auth: generates random tokens stored in memory
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

// In-memory session store (tokens are lost on server restart)
const sessions = new Set<string>();

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function createSession(token: string) {
  sessions.add(token);
}

export function destroySession(token: string) {
  sessions.delete(token);
}

// Middleware: checks Bearer token on every protected route
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = auth.slice(7);
  if (!sessions.has(token)) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }
  next();
}
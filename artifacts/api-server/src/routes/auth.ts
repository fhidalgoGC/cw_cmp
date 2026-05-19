import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { LoginBody } from "@workspace/api-zod";
import {
  generateToken,
  loadUserFromToken,
  requireAuth,
  verifyPassword,
} from "../lib/auth";

const router: IRouter = Router();
const SESSION_DAYS = 30;

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()))
    .limit(1);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "Credenciales incorrectas" });
    return;
  }
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400 * 1000);
  await db.insert(sessionsTable).values({ token, userId: user.id, expiresAt });
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      companyId: user.companyId,
    },
  });
});

router.get("/auth/me", requireAuth(), async (req, res): Promise<void> => {
  res.json(req.user);
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const auth = req.headers["authorization"];
  let token: string | null = null;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    token = auth.slice(7).trim();
  } else if (typeof req.headers["token"] === "string") {
    token = req.headers["token"] as string;
  }
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  }
  res.json({ message: "Sesión cerrada" });
});

export default router;

import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startScheduler } from "./scheduler";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: '20mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '20mb' }));

// Setup session + passport for simple local auth
const MemoryStoreClass = MemoryStore(session as any);
const sessionSecret = process.env.SESSION_SECRET || 'dev-secret';
app.use(session({
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  },
  store: new MemoryStoreClass({ checkPeriod: 86400000 }),
  resave: false,
  saveUninitialized: false,
  secret: sessionSecret,
}) as any);

// Configure passport local strategy to authenticate against `users` table
passport.use(new LocalStrategy((username, password, done) => {
  // find user in DB
  db.select()
    .from(users)
    .where(eq(users.username, username))
    .then(async (rows: any[]) => {
      let user = rows[0];
      if (!user) {
        // try by email
        const rows2: any[] = await db.select().from(users).where(eq(users.email, username));
        user = rows2[0];
      }
      if (!user) return done(null, false, { message: 'Invalid credentials' });
      try {
        const iterations = user.iterations || 100000;
        const hash = crypto.pbkdf2Sync(password, user.salt, iterations, 64, 'sha512').toString('hex');
        console.log(`[LOGIN] User: ${user.username}, Email: ${user.email}, Hash match: ${hash === user.passwordHash || hash === user.password_hash}`);
        // Check both camelCase and snake_case field names for compatibility
        const storedHash = user.passwordHash || user.password_hash;
        if (hash === storedHash) {
          const permissions = user.permissions ? JSON.parse(user.permissions) : [];
          return done(null, { id: user.id, username: user.username, role: user.role, displayName: user.display_name || user.displayName || null, email: user.email || null, permissions });
        }
        return done(null, false, { message: 'Invalid credentials' });
      } catch (e) {
        console.error('[LOGIN] Error during password verification:', e);
        return done(e as any);
      }
    }).catch((err: any) => done(err));
}));

passport.serializeUser((user: any, done) => done(null, user.id));
passport.deserializeUser((id: any, done) => {
  db.select().from(users).where(eq(users.id, id)).then((rows: any[]) => {
    const user = rows[0];
    if (!user) return done(null, false);
    const permissions = user.permissions ? JSON.parse(user.permissions) : [];
    return done(null, { id: user.id, username: user.username, role: user.role, displayName: user.display_name || user.displayName || null, email: user.email || null, permissions });
  }).catch((err: any) => done(err));
});

app.use(passport.initialize() as any);
app.use(passport.session() as any);

// CORS middleware removed per request.
// Previously the server set Access-Control headers here; it has been disabled.

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Ensure local uploads directory exists (APP_DATA_DIR or default `public/uploads`)
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const APP_DATA_DIR = process.env.APP_DATA_DIR ? path.resolve(String(process.env.APP_DATA_DIR)) : path.resolve(process.cwd(), 'public', 'uploads');
    await fs.mkdir(APP_DATA_DIR, { recursive: true });
    log(`Using APP_DATA_DIR=${APP_DATA_DIR}`);
  } catch (err) {
    console.error('Failed to ensure APP_DATA_DIR:', err);
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
    cors: false,
  }, () => {
    log(`serving on port ${port}`);
    try {
      startScheduler();
      log('scheduler started');
    } catch (err) {
      console.error('Failed to start scheduler', err);
    }
  });
})();

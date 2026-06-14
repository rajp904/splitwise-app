// App entry point.
// Sets up Express, registers all routes, and starts the server.

import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';

// Route modules
import authRoutes from './modules/auth/auth.routes';
import groupRoutes from './modules/groups/groups.routes';
import expenseRoutes from './modules/expenses/expenses.routes';
import settlementRoutes from './modules/settlements/settlements.routes';
import importRoutes from './modules/import/import.routes';
import { groupBalancesRouter } from './modules/balances/balances.routes';
import userRoutes from './modules/users/users.routes';

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json());

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);

// Nested under /api/groups/:id
app.use('/api/groups/:id/expenses', expenseRoutes);
app.use('/api/groups/:id/settlements', settlementRoutes);
app.use('/api/groups/:id/import', importRoutes);
app.use('/api/groups/:id/balances', groupBalancesRouter);

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Error handler (must be last) ────────────────────────────────────────────
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port}`);
  console.log(`Environment: ${env.nodeEnv}`);
});

export default app;

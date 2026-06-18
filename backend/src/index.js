require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');

const { testConnection } = require('./db');
const authRoutes     = require('./routes/auth');
const realEstateRoutes  = require('./routes/realEstate');
const documentsRoutes   = require('./routes/documents');
const nomineesRoutes = require('./routes/nominees');
const vaultRoutes    = require('./routes/vault');
const policiesRoutes = require('./routes/policies');
const logger       = require('./utils/logger');
const router = require('./routes/auth');

const app  = express();
const PORT = process.env.PORT || 4000;

// ─── Security middleware ──────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.set('trust proxy', 1);

// ─── CORS ─────────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Parsers ──────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Logger ───────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) }
  }));
}

// ─── Global rate limit ────────────────────────────────────────────
app.use(rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max:      parseInt(process.env.RATE_LIMIT_MAX || '100'),
  message:  { success: false, message: 'Too many requests from this IP.' },
  standardHeaders: true,
}));


// ─── Routes ───────────────────────────────────────────────────────
const policyAnalysisRoutes = require("./routes/policyAnalysis");
app.use("/api/policy-analysis", policyAnalysisRoutes);

app.use('/api/auth',      authRoutes);
app.use('/api/properties', realEstateRoutes);
app.use('/api/documents',  documentsRoutes);
app.use('/api/nominees', nomineesRoutes);
app.use('/api/vault',    vaultRoutes);
app.use('/api/policies', policiesRoutes);


// Health
app.get('/api/health', async (req, res) => {
  const dbOk = await testConnection().catch(() => false);
  res.json({
    success: true,
    service: 'VaultLife Auth API',
    version: '1.0.0',
    database: dbOk ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()) + 's',
  });
});

// ─── 404 ──────────────────────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// ─── Error handler ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('[Server Error]', err.message, { stack: err.stack });
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message,
  });
});

// ─── Start ───────────────────────────────────────────────────────
const start = async () => {
  await testConnection();
  app.listen(PORT, () => {
    logger.info(`[Server] 🚀 VaultLife Auth API running on http://localhost:${PORT}`);
    logger.info(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`[Server] CORS origin: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
  });
};

start();

module.exports = app;

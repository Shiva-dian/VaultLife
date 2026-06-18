// backend/src/routes/policyAnalysis.js

const express = require("express");
const multer = require("multer");
const { authenticate } = require("../middleware/auth");
const {
  uploadAndAnalyse,
  getAnalysis,
  deleteAnalysis,
} = require("../controllers/policyAnalysisController");

const router = express.Router();

// Store file in memory (no disk writes needed — we only send to Gemini)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are accepted."));
    }
  },
});

// All routes require auth
router.use(authenticate);

// POST   /api/policy-analysis/upload   — upload PDF + run Claude extraction
router.post("/upload", upload.single("pdf"), uploadAndAnalyse);

// GET    /api/policy-analysis           — fetch latest analysis for current user
router.get("/", getAnalysis);

// DELETE /api/policy-analysis           — clear analysis
router.delete("/", deleteAnalysis);

module.exports = router;

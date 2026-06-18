const { query } = require('../db');
const logger    = require('../utils/logger');
const path      = require('path');
const fs        = require('fs');

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME  = new Set([
  'application/pdf',
  'image/jpeg','image/jpg','image/png','image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const ALLOWED_EXT = new Set(['.pdf','.jpg','.jpeg','.png','.webp','.doc','.docx']);

// ── GET /api/documents?module=&recordId= ─────────────────────────
const getDocuments = async (req, res) => {
  const { module: mod, recordId } = req.query;
  try {
    let sql = `SELECT id, module, record_id, doc_type, doc_label,
                      file_name, file_size_bytes, mime_type, storage_url,
                      notes, created_at
               FROM vault_documents
               WHERE user_id = $1 AND active = TRUE`;
    const params = [req.user.id];
    if (mod)      { params.push(mod);      sql += ` AND module = $${params.length}`; }
    if (recordId) { params.push(recordId); sql += ` AND record_id = $${params.length}`; }
    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);

    // Group by record_id for easy frontend consumption
    const grouped = result.rows.reduce((acc, doc) => {
      const key = doc.record_id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(doc);
      return acc;
    }, {});

    return res.json({
      success: true,
      data: { documents: result.rows, grouped, count: result.rows.length },
    });
  } catch (err) {
    logger.error('[getDocuments]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to fetch documents.' });
  }
};

// ── GET /api/documents/stats ─────────────────────────────────────
const getDocumentStats = async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM v_document_stats WHERE user_id = $1`,
      [req.user.id]
    );
    const stats = result.rows[0] || {
      total_documents:0, total_size_bytes:0, total_size_mb:0,
      bank_docs:0, investment_docs:0, policy_docs:0,
      property_docs:0, liability_docs:0, commodity_docs:0,
    };
    return res.json({ success: true, data: { stats } });
  } catch (err) {
    logger.error('[getDocumentStats]', err.message);
    return res.status(500).json({ success: false, message: 'Failed.' });
  }
};

// ── POST /api/documents (multipart not yet - metadata only) ───────
// In production: use multer + S3. For now: store metadata + base64 preview
const addDocument = async (req, res) => {
  const {
    module: mod, recordId, docType, docLabel,
    fileName, fileSizeBytes, mimeType, storageUrl, fileHash, notes,
  } = req.body;

  if (!mod || !recordId || !fileName || !fileSizeBytes || !mimeType) {
    return res.status(400).json({
      success: false,
      message: 'module, recordId, fileName, fileSizeBytes and mimeType are required.',
    });
  }

  // File size validation
  const sizeNum = parseInt(fileSizeBytes);
  if (sizeNum > MAX_FILE_SIZE) {
    return res.status(400).json({
      success: false,
      message: `File too large: ${(sizeNum/1048576).toFixed(2)} MB. Maximum allowed size is 2 MB.`,
      data: { maxSizeMB: 2, fileSizeMB: parseFloat((sizeNum/1048576).toFixed(2)) },
    });
  }

  // MIME type validation
  const normalizedMime = mimeType.toLowerCase();
  if (!ALLOWED_MIME.has(normalizedMime)) {
    return res.status(400).json({
      success: false,
      message: `File type "${mimeType}" is not allowed. Accepted: PDF, JPG, PNG, WEBP, DOC, DOCX.`,
    });
  }

  // Extension validation
  const ext = path.extname(fileName).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return res.status(400).json({
      success: false,
      message: `File extension "${ext}" is not allowed.`,
    });
  }

  try {
    // Build storage path (actual file upload handled by frontend → S3)
    const storagePath = `documents/${req.user.id}/${mod}/${Date.now()}_${fileName}`;

    const result = await query(
      `INSERT INTO vault_documents
         (user_id, module, record_id, doc_type, doc_label,
          file_name, file_size_bytes, mime_type, storage_path, storage_url, file_hash, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id, module, record_id, doc_type, doc_label,
                 file_name, file_size_bytes, mime_type, storage_url, created_at`,
      [
        req.user.id, mod, recordId, docType || 'other', docLabel?.trim() || null,
        fileName.trim(), sizeNum, normalizedMime, storagePath,
        storageUrl?.trim() || null, fileHash?.trim() || null, notes?.trim() || null,
      ]
    );

    logger.info(`[addDocument] User ${req.user.id}: ${mod}/${recordId} — ${fileName} (${(sizeNum/1024).toFixed(0)} KB)`);
    return res.status(201).json({
      success: true,
      message: 'Document stored successfully.',
      data: { document: result.rows[0] },
    });
  } catch (err) {
    logger.error('[addDocument]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to store document.' });
  }
};

// ── DELETE /api/documents/:id ─────────────────────────────────────
const deleteDocument = async (req, res) => {
  const { id } = req.params;
  try {
    const r = await query(
      `UPDATE vault_documents SET active = FALSE WHERE id = $1 AND user_id = $2 RETURNING id, file_name`,
      [id, req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ success: false, message: 'Document not found.' });
    logger.info(`[deleteDocument] User ${req.user.id} deleted: ${r.rows[0].file_name}`);
    return res.json({ success: true, message: 'Document removed.' });
  } catch (err) {
    logger.error('[deleteDocument]', err.message);
    return res.status(500).json({ success: false, message: 'Failed.' });
  }
};

// ── GET /api/documents/validate-size ─────────────────────────────
// Frontend calls this before upload to get size limit info
const getUploadLimits = async (_req, res) => {
  return res.json({
    success: true,
    data: {
      maxFileSizeBytes: MAX_FILE_SIZE,
      maxFileSizeMB: 2,
      allowedMimeTypes: [...ALLOWED_MIME],
      allowedExtensions: [...ALLOWED_EXT],
      description: 'Documents must be under 2MB. Accepted formats: PDF, JPG, PNG, WEBP, DOC, DOCX.',
    },
  });
};

module.exports = { getDocuments, getDocumentStats, addDocument, deleteDocument, getUploadLimits };

const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getDocuments, getDocumentStats, addDocument, deleteDocument, getUploadLimits,
} = require('../controllers/documentsController');

router.use(authenticate);

router.get('/limits',  getUploadLimits);   // public info — no file needed
router.get('/stats',   getDocumentStats);
router.get('/',        getDocuments);
router.post('/',       addDocument);
router.delete('/:id',  deleteDocument);

module.exports = router;

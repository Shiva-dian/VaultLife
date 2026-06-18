const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const { getPolicies, getNotifications, addPolicy, updatePolicy, deletePolicy } = require('../controllers/policiesController');

router.use(authenticate);
router.get('/notifications', getNotifications);
router.get('/',              getPolicies);
router.post('/',             addPolicy);
router.put('/:id',           updatePolicy);
router.delete('/:id',        deletePolicy);

module.exports = router;

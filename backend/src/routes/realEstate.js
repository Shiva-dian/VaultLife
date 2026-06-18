const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getRealEstate, addRealEstate, updateRealEstate, deleteRealEstate,
  getLiabilities, addLiability, updateLiability, deleteLiability,
  getCommodities, addCommodity, updateCommodity, deleteCommodity,
} = require('../controllers/realEstateController');

router.use(authenticate);

router.get('/real-estate',        getRealEstate);
router.post('/real-estate',       addRealEstate);
router.put('/real-estate/:id',    updateRealEstate);
router.delete('/real-estate/:id', deleteRealEstate);

router.get('/liabilities',        getLiabilities);
router.post('/liabilities',       addLiability);
router.put('/liabilities/:id',    updateLiability);
router.delete('/liabilities/:id', deleteLiability);

router.get('/commodities',        getCommodities);
router.post('/commodities',       addCommodity);
router.put('/commodities/:id',    updateCommodity);
router.delete('/commodities/:id', deleteCommodity);

module.exports = router;

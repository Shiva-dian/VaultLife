const express  = require('express');
const router   = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getProfile, updateProfile,
  getBankAccounts, addBankAccount, updateBankAccount, deleteBankAccount,
  getInvestments, addInvestment, updateInvestment, deleteInvestment,
  getDashboardSummary,
} = require('../controllers/vaultController');

router.use(authenticate);

// Profile
router.get('/profile',        getProfile);
router.patch('/profile',      updateProfile);

// Dashboard summary
router.get('/dashboard',      getDashboardSummary);

// Bank accounts
router.get('/bank-accounts',           getBankAccounts);
router.post('/bank-accounts',          addBankAccount);
router.put('/bank-accounts/:id',       updateBankAccount);
router.delete('/bank-accounts/:id',    deleteBankAccount);

// Investments
router.get('/investments',             getInvestments);
router.post('/investments',            addInvestment);
router.put('/investments/:id',         updateInvestment);
router.delete('/investments/:id',      deleteInvestment);

module.exports = router;

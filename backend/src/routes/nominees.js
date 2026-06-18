const express  = require('express');
const router   = express.Router();
const { authenticate } = require('../middleware/auth');
const { getNominees, addNominee, updateNominee, deleteNominee } = require('../controllers/nomineesController');

router.use(authenticate);

router.get('/',       getNominees);
router.post('/',      addNominee);
router.put('/:id',    updateNominee);
router.delete('/:id', deleteNominee);

module.exports = router;

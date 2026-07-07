const express = require('express');
const router = express.Router();
const { createGestion, getGestiones, updateGestion } = require('../controllers/gestionController');
const { verificarToken, esAdminODirector } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, getGestiones);

router.post('/', verificarToken, esAdminODirector, createGestion);
router.put('/:id', verificarToken, esAdminODirector, updateGestion);

module.exports = router;

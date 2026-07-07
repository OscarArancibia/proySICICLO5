const express = require('express');
const router = express.Router();
const { getBitacora, getBitacoraFiltros } = require('../controllers/bitacoraController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { requierePermiso } = require('../middlewares/permissionMiddleware');

router.get('/', verificarToken, requierePermiso('ver_bitacora'), getBitacora);
router.get('/filtros', verificarToken, requierePermiso('ver_bitacora'), getBitacoraFiltros);

module.exports = router;

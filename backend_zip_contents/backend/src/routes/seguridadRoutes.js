const express = require('express');
const router = express.Router();
const { getModulosFuncionalidades } = require('../controllers/seguridadController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { requierePermiso } = require('../middlewares/permissionMiddleware');

router.get('/modulos-funcionalidades', verificarToken, requierePermiso('gestionar_roles'), getModulosFuncionalidades);

module.exports = router;

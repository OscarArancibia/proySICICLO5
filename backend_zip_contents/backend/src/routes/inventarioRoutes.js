const express = require('express');
const router = express.Router();
const {
    getMateriales,
    getMovimientos,
    createMaterial,
    updateMaterial,
    registrarMovimiento
} = require('../controllers/inventarioController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { requierePermiso } = require('../middlewares/permissionMiddleware');

router.get('/materiales', verificarToken, requierePermiso('ver_inventario'), getMateriales);
router.post('/materiales', verificarToken, requierePermiso('gestionar_inventario'), createMaterial);
router.put('/materiales/:id', verificarToken, requierePermiso('gestionar_inventario'), updateMaterial);
router.get('/movimientos', verificarToken, requierePermiso('ver_inventario'), getMovimientos);
router.post('/movimientos', verificarToken, requierePermiso('gestionar_inventario'), registrarMovimiento);

module.exports = router;

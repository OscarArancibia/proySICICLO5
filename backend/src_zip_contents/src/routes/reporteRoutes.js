const express = require('express');
const router = express.Router();
const {
    reporteEstudiantes,
    reportePagos,
    reporteInventario,
    reporteCalificaciones,
    reporteEntregas,
    reporteGeneral,
    obtenerFiltros,
    reportesRecientes,
} = require('../controllers/reporteController');
const { verificarToken, esAdminDirectorOSecretaria } = require('../middlewares/authMiddleware');

// Acceso: SuperUsuario (1), Director (2), Administrativo (4)
router.use(verificarToken, esAdminDirectorOSecretaria);

router.get('/filtros', obtenerFiltros);
router.get('/recientes', reportesRecientes);

router.get('/estudiantes', reporteEstudiantes);
router.get('/pagos', reportePagos);
router.get('/inventario', reporteInventario);
router.get('/calificaciones', reporteCalificaciones);
router.get('/entregas', reporteEntregas);
router.get('/general', reporteGeneral);

module.exports = router;

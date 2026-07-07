const express = require('express');
const router = express.Router();
const {
    validarCalificaciones,
    generarLibreta,
    remitirLibreta,
    aprobarLibreta,
    listarLibretas,
    obtenerLibretaPorId
} = require('../controllers/libretaController');
const { 
    exportarLibretaPdf,
    exportarLibretaCsv,
    exportarLibretaWord
} = require('../controllers/libretaExportController');
const { verificarToken } = require('../middlewares/authMiddleware');
const { requierePermiso } = require('../middlewares/permissionMiddleware');

router.use(verificarToken);

router.get('/validar', requierePermiso('generar_libretas'), validarCalificaciones);
router.post('/generar', requierePermiso('generar_libretas'), generarLibreta);
router.post('/:id/remitir', requierePermiso('revisar_libretas'), remitirLibreta);
router.post('/:id/aprobar', requierePermiso('aprobar_libretas'), aprobarLibreta);
router.get('/', requierePermiso('consultar_libretas'), listarLibretas);
router.get('/:id', requierePermiso('consultar_libretas'), obtenerLibretaPorId);
router.get('/:id/pdf', requierePermiso('exportar_libretas'), exportarLibretaPdf);
router.get('/:id/csv', requierePermiso('exportar_libretas'), exportarLibretaCsv);
router.get('/:id/word', requierePermiso('exportar_libretas'), exportarLibretaWord);

module.exports = router;


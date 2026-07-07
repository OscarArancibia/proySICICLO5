const express = require('express');
const router = express.Router();
const {
    getMisDatos,
    getMisCalificaciones,
    getMisDeudas,
    getMisPagos,
} = require('../controllers/estudianteMeController');
const { verificarToken, esEstudiante } = require('../middlewares/authMiddleware');

router.get('/datos',          verificarToken, esEstudiante, getMisDatos);
router.get('/calificaciones', verificarToken, esEstudiante, getMisCalificaciones);
router.get('/deudas',         verificarToken, esEstudiante, getMisDeudas);
router.get('/pagos',          verificarToken, esEstudiante, getMisPagos);

module.exports = router;

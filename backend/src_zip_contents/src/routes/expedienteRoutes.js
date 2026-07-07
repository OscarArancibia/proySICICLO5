const express = require('express');
const router = express.Router();
const { consultarExpediente } = require('../controllers/expedienteController');
const { exportarExpedientePdf } = require('../controllers/pdfController');
const { verificarToken } = require('../middlewares/authMiddleware');

router.get('/:id_estudiante', verificarToken, consultarExpediente);
router.get('/:id_estudiante/pdf', verificarToken, exportarExpedientePdf);

module.exports = router;

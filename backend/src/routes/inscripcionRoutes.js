const express = require('express');
const router = express.Router();
const { inscribirEstudiante, getInscripciones, retirarEstudiante, trasladarEstudiante, inscripcionMasivaCsv } = require('../controllers/inscripcionController');
const { verificarToken, esAdminDirectorOSecretaria } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, getInscripciones);
router.post('/', verificarToken, esAdminDirectorOSecretaria, inscribirEstudiante);
router.put('/:id_inscripcion', verificarToken, esAdminDirectorOSecretaria, retirarEstudiante);
router.post('/traslado/:id_inscripcion', verificarToken, esAdminDirectorOSecretaria, trasladarEstudiante);
router.post('/masiva/csv', verificarToken, esAdminDirectorOSecretaria, inscripcionMasivaCsv);

module.exports = router;

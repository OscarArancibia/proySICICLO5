const express = require('express');
const router = express.Router();
const { buscarTutores, registrarTutor, vincularTutor, desvincularTutor, editarTutor, editarVinculo } = require('../controllers/tutorController');
const { verificarToken, esAdminDirectorOSecretaria } = require('../middlewares/authMiddleware');

router.get('/search', verificarToken, buscarTutores);
router.post('/', verificarToken, esAdminDirectorOSecretaria, registrarTutor);
router.put('/:id_tutor', verificarToken, esAdminDirectorOSecretaria, editarTutor);
router.post('/vincular', verificarToken, esAdminDirectorOSecretaria, vincularTutor);
router.put('/vincular/:id_estudiante/:id_tutor', verificarToken, esAdminDirectorOSecretaria, editarVinculo);
router.delete('/desvincular/:id_estudiante/:id_tutor', verificarToken, esAdminDirectorOSecretaria, desvincularTutor);

module.exports = router;

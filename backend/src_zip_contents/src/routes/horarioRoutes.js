const express = require('express');
const router = express.Router();
const { getHorarioCurso, createBloqueHorario, deleteBloqueHorario, getHorarioProfesor, editarBloqueHorario, publicarHorario } = require('../controllers/horarioController');
const { verificarToken, esAdminODirector, esAdminDirectorOSecretaria } = require('../middlewares/authMiddleware');

// ── Rutas específicas PRIMERO (antes de /:id genérico, o Express las intercepta) ──
router.get('/curso/:id_curso', verificarToken, getHorarioCurso);
// CU10 Paso 9: Secretaria (rol 4) también está habilitada para publicar
router.put('/curso/:id_curso/publicar', verificarToken, esAdminDirectorOSecretaria, publicarHorario);
router.get('/profesor/:id_profesor', verificarToken, getHorarioProfesor);

// ── Rutas genéricas DESPUÉS ──
router.post('/', verificarToken, esAdminODirector, createBloqueHorario);
router.put('/:id', verificarToken, esAdminODirector, editarBloqueHorario);
router.delete('/:id', verificarToken, esAdminODirector, deleteBloqueHorario);

module.exports = router;

const express = require('express');
const router = express.Router();
const {
    getEstructura,
    getAulas, createAula, updateAula,
    getNiveles, createNivel, updateNivel,
    getGrados, createGrado, updateGrado
} = require('../controllers/estructuraController');
const { verificarToken, esAdminODirector } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, esAdminODirector, getEstructura);

router.get('/aulas', verificarToken, esAdminODirector, getAulas);
router.post('/aulas', verificarToken, esAdminODirector, createAula);
router.put('/aulas/:id', verificarToken, esAdminODirector, updateAula);

router.get('/niveles', verificarToken, esAdminODirector, getNiveles);
router.post('/niveles', verificarToken, esAdminODirector, createNivel);
router.put('/niveles/:id', verificarToken, esAdminODirector, updateNivel);

router.get('/grados', verificarToken, esAdminODirector, getGrados);
router.post('/grados', verificarToken, esAdminODirector, createGrado);
router.put('/grados/:id', verificarToken, esAdminODirector, updateGrado);

module.exports = router;

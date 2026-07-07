const express = require('express');
const router = express.Router();
const { getCamposSaber, createCampo, getMaterias, createMateria } = require('../controllers/materiaController');
const { verificarToken, esAdminODirector } = require('../middlewares/authMiddleware');

router.get('/campos', verificarToken, esAdminODirector, getCamposSaber);
router.post('/campos', verificarToken, esAdminODirector, createCampo);

router.get('/', verificarToken, esAdminODirector, getMaterias);
router.post('/', verificarToken, esAdminODirector, createMateria);

module.exports = router;

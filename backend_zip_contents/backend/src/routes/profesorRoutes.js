const express = require('express');
const router = express.Router();
const { getProfesores, createProfesor, updateProfesor, linkCuentaProfesor } = require('../controllers/profesorController');
const { verificarToken, esAdminODirector } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, esAdminODirector, getProfesores);
router.post('/', verificarToken, esAdminODirector, createProfesor);
router.put('/:id', verificarToken, esAdminODirector, updateProfesor);
router.patch('/:id/cuenta', verificarToken, esAdminODirector, linkCuentaProfesor);

module.exports = router;

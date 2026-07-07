const express = require('express');
const router = express.Router();
const { getRoles, getPermissions, createRole, deleteRole } = require('../controllers/roleController');
const { verificarToken, esSuperUsuario } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, esSuperUsuario, getRoles);
router.get('/permisos', verificarToken, esSuperUsuario, getPermissions);
router.post('/', verificarToken, esSuperUsuario, createRole);
router.delete('/:id', verificarToken, esSuperUsuario, deleteRole);

module.exports = router;

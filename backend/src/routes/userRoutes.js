const express = require('express');
const router = express.Router();
const { createUser, getUsers, updateUser, deleteUser } = require('../controllers/userController');
const { verificarToken, esSuperUsuario } = require('../middlewares/authMiddleware');

router.post('/', verificarToken, esSuperUsuario, createUser);
router.get('/', verificarToken, esSuperUsuario, getUsers);
router.put('/:id', verificarToken, esSuperUsuario, updateUser);
router.delete('/:id', verificarToken, esSuperUsuario, deleteUser);

module.exports = router;


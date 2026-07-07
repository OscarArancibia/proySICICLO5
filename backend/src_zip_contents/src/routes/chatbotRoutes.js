const express = require('express');
const router = express.Router();
const { consultar, exportar } = require('../controllers/chatbotController');
const { verificarToken, esAdminDirectorOSecretaria } = require('../middlewares/authMiddleware');

// Acceso: SuperUsuario (1), Director (2), Administrativo (4)
router.use(verificarToken, esAdminDirectorOSecretaria);

router.post('/consultar', consultar);
router.post('/exportar', exportar);

module.exports = router;

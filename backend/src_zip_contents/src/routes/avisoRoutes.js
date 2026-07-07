const express = require("express");
const router = express.Router();
const { verificarToken } = require("../middlewares/authMiddleware");
const avisoController = require("../controllers/avisoController");

router.use(verificarToken);
router.get("/", avisoController.listarAvisos);
router.get("/mis-estudiantes", avisoController.listarMisEstudiantes);
router.post("/", avisoController.publicarAviso);
router.get("/panel", avisoController.obtenerAvisosPanel);

module.exports = router;

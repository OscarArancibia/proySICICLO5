// src/routes/entregaRoutes.js
const express = require("express");
const router = express.Router();
const { verificarToken } = require("../middlewares/authMiddleware");
const entregaController = require("../controllers/entregaController");
router.use(verificarToken);
router.get("/mis-cursos", entregaController.listarMisCursos);
router.get("/cursos/:idCurso/estudiantes", entregaController.listarEstudiantes);
router.get(
  "/cursos/:idCurso/registradas",
  entregaController.listarEntregasCurso,
);
router.get(
  "/estudiantes/:idEstudiante/tutores-autorizados",
  entregaController.listarTutoresAutorizados,
);
router.get("/", entregaController.listarTodas);
router.post("/", entregaController.registrar);

module.exports = router;

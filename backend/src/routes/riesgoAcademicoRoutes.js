const express = require("express");
const router = express.Router();
const {
  analizarRiesgo,
  consultarEstudiantesEnRiesgo
} = require("../controllers/riesgoAcademicoController");
const {
  generarRecomendacion,
  notificarTutor
} = require("../controllers/seguimientoAcademicoController");
const { verificarToken } = require("../middlewares/authMiddleware");
const { requierePermiso } = require("../middlewares/permissionMiddleware");

router.use(verificarToken);

// CU29 - Analizar riesgo académico
router.post("/analizar", requierePermiso("ver_evaluaciones"), analizarRiesgo);

// CU30 - Consultar estudiantes en riesgo
router.get(
  "/estudiantes-en-riesgo",
  requierePermiso("ver_evaluaciones"),
  consultarEstudiantesEnRiesgo
);

// CU31 - Generar recomendación
router.post("/recomendacion", requierePermiso("ver_evaluaciones"), generarRecomendacion);

// CU32 - Notificar alerta al tutor
router.post("/notificar-tutor", requierePermiso("ver_evaluaciones"), notificarTutor);

module.exports = router;

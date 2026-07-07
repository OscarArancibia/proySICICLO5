const express = require("express");
const router = express.Router();
const { verificarToken } = require("../middlewares/authMiddleware");
const { requierePermiso } = require("../middlewares/permissionMiddleware");
const {
  buscarInasistencia,
  registrarJustificacion,
  listarPendientes,
  resolverJustificacion,
  listarJustificaciones,
} = require("../controllers/justificacionController");

router.get(
  "/inasistencia",
  verificarToken,
  requierePermiso("gestionar_justificaciones"),
  buscarInasistencia,
);
router.post(
  "/",
  verificarToken,
  requierePermiso("gestionar_justificaciones"),
  registrarJustificacion,
);
router.get(
  "/pendientes",
  verificarToken,
  requierePermiso("gestionar_justificaciones"),
  listarPendientes,
);
router.put(
  "/:id/resolver",
  verificarToken,
  requierePermiso("gestionar_justificaciones"),
  resolverJustificacion,
);
router.get(
  "/",
  verificarToken,
  requierePermiso("gestionar_justificaciones"),
  listarJustificaciones,
);

module.exports = router;

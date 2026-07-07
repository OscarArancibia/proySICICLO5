const express = require("express");
const router = express.Router();
const { verificarToken } = require("../middlewares/authMiddleware");
const { requierePermiso } = require("../middlewares/permissionMiddleware");
const {
  obtenerDimensiones,
  guardarDimensiones,
  actualizarDimension,
} = require("../controllers/dimensionController");

router.get(
  "/",
  verificarToken,
  requierePermiso("gestionar_dimensiones"),
  obtenerDimensiones,
);
router.post(
  "/",
  verificarToken,
  requierePermiso("gestionar_dimensiones"),
  guardarDimensiones,
);
router.put(
  "/:id",
  verificarToken,
  requierePermiso("gestionar_dimensiones"),
  actualizarDimension,
);

module.exports = router;

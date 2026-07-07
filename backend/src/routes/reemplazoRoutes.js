// src/routes/reemplazoRoutes.js
const express = require("express");
const router = express.Router();
const { verificarToken } = require("../middlewares/authMiddleware");
const reemplazoController = require("../controllers/reemplazoController");

router.use(verificarToken);

// Solo Director puede asignar suplentes
router.use((req, res, next) => {
  if (req.usuario.nombre_rol !== "Director") {
    return res
      .status(403)
      .json({ error: "Solo el Director puede asignar suplentes" });
  }
  next();
});

// Obtener materias sin cobertura para una licencia
router.get(
  "/licencias/:idLicencia/materias-sin-cobertura",
  reemplazoController.obtenerMateriasSinCobertura,
);

// Sugerir profesores disponibles para un bloque
router.get(
  "/licencias/:idLicencia/sugerir-suplentes",
  reemplazoController.sugerirSuplentes,
);

// Asignar suplente
router.post("/reemplazos", reemplazoController.asignarSuplente);

// Revertir asignación (cerrar anticipadamente)
router.put(
  "/reemplazos/:idReemplazo/cerrar",
  reemplazoController.cerrarReemplazo,
);

module.exports = router;

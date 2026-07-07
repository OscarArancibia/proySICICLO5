const express = require("express");
const router = express.Router();
const {
  verificarToken,
  esAdminDirectorOSecretaria,
} = require("../middlewares/authMiddleware");
const estadoCuentaController = require("../controllers/estadoCuentaController");

router.use(verificarToken);
router.use(esAdminDirectorOSecretaria);

router.get("/estudiantes", estadoCuentaController.buscarEstudiantes);
router.get("/:idEstudiante", estadoCuentaController.obtenerEstadoCuenta);
router.post(
  "/:idEstudiante/recordatorio",
  estadoCuentaController.enviarRecordatorio,
);

module.exports = router;

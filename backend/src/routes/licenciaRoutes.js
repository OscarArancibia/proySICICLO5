// src/routes/licenciaRoutes.js
const express = require("express");
const router = express.Router();
const { verificarToken } = require("../middlewares/authMiddleware");
const licenciaController = require("../controllers/licenciaController");

// Guard por rol (usa nombre_rol del token).
const soloRol =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.usuario?.nombre_rol)) {
      return res
        .status(403)
        .json({ error: "No tiene el rol necesario para esta acción" });
    }
    next();
  };

// Todas las rutas requieren autenticación
router.use(verificarToken);

// =====================================================
// RUTAS PARA PROFESORES
// =====================================================
// Solicitar licencia
router.post(
  "/solicitar",
  soloRol("Profesor"),
  licenciaController.solicitarLicencia,
);

// Solicitar extensión de licencia (E3)
router.post(
  "/:idLicencia/extender",
  soloRol("Profesor"),
  licenciaController.solicitarExtension,
);

// Historial propio del profesor
router.get(
  "/mis-licencias",
  soloRol("Profesor"),
  licenciaController.listarMisLicencias,
);

// =====================================================
// RUTAS PARA DIRECTOR Y SECRETARIA (Administrativo)
// =====================================================
// Listar solicitudes (Director, Administrativo)
router.get(
  "/solicitudes",
  soloRol("Director", "Administrativo"),
  licenciaController.listarSolicitudes,
);

// Aprobar licencia (Director)
router.put(
  "/:idLicencia/aprobar",
  soloRol("Director"),
  licenciaController.aprobarLicencia,
);

// Rechazar licencia (Director)
router.put(
  "/:idLicencia/rechazar",
  soloRol("Director"),
  licenciaController.rechazarLicencia,
);

// Registrar retorno anticipado (Director)
router.put(
  "/:idLicencia/retornar",
  soloRol("Director"),
  licenciaController.registrarRetorno,
);

// Registrar licencia por secretaría / Administrativo (E5)
router.post(
  "/registrar-por-secretaria",
  soloRol("Administrativo"),
  licenciaController.registrarLicenciaPorSecretaria,
);

// =====================================================
// RUTA PARA DIRECTOR (consultar profesores con licencia)
// =====================================================
router.get(
  "/profesores-con-licencia",
  soloRol("Director"),
  licenciaController.obtenerProfesoresConLicencia,
);

module.exports = router;

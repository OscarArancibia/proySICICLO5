const express = require("express");
const router = express.Router();
const citaController = require("../controllers/citaController");
const { verificarToken } = require("../middlewares/authMiddleware");

// Guard por rol (usa nombre_rol del token). El tutor entra como 'Estudiante'.
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

router.use(verificarToken);

// ── Profesor ──────────────────────────────────────────────
router.post(
  "/horarios-atencion",
  soloRol("Profesor"),
  citaController.registrarHorarioAtencion,
);
router.get(
  "/mis-horarios",
  soloRol("Profesor"),
  citaController.listarMisHorarios,
);
router.put(
  "/citas/:id_cita/confirmar",
  soloRol("Profesor"),
  citaController.confirmarCita,
);
router.put(
  "/citas/:id_cita/alternativa",
  soloRol("Profesor"),
  citaController.proponerAlternativa,
);

// ── Estudiante (tutor por la cuenta del estudiante) ───────
router.get("/mis-profesores", soloRol("Estudiante"), citaController.listarMisProfesores);
router.get("/mis-tutores", soloRol("Estudiante"), citaController.listarMisTutores);
router.get(
  "/profesores/:id_profesor/horarios-disponibles",
  soloRol("Estudiante"),
  citaController.listarHorariosDisponibles,
);
router.post("/citas", soloRol("Estudiante"), citaController.solicitarCita);

// ── Estudiante o Profesor ─────────────────────────────────
router.put(
  "/citas/:id_cita/cancelar",
  soloRol("Estudiante", "Profesor"),
  citaController.cancelarCita,
);

// ── Listar citas (Director: todas; Profesor: suyas; Estudiante: de su hijo) ──
router.get(
  "/citas",
  soloRol("Director", "Profesor", "Estudiante"),
  citaController.listarCitas,
);

module.exports = router;

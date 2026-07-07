const express = require("express");
const router = express.Router();
const {
  verificarToken,
  esAdminODirector,
} = require("../middlewares/authMiddleware");
const {
  validarGestionActiva,
  validarAulaDisponible,
  validarProfesorDisponible,
  validarCursoUnico,
  validarCursoSinInscripciones,
} = require("../middlewares/validationMiddleware");
const {
  crearCurso,
  obtenerDatosFormularioCurso,
  obtenerCursos,
  obtenerCursoPorId,
  editarCurso,
  duplicarCurso,
  eliminarCurso,
  activarCurso,
} = require("../controllers/cursoController");
router.use(verificarToken);

router.get(
  "/cursos/formulario/datos",
  esAdminODirector,
  obtenerDatosFormularioCurso,
);

router.post(
  "/cursos",
  esAdminODirector,
  validarGestionActiva,
  validarCursoUnico,
  validarAulaDisponible,
  validarProfesorDisponible,
  crearCurso,
);

router.get("/cursos", verificarToken, obtenerCursos);

router.get("/cursos/:id_curso", verificarToken, obtenerCursoPorId);

router.put(
  "/cursos/:id_curso",
  esAdminODirector,
  validarGestionActiva,
  validarCursoSinInscripciones,
  validarAulaDisponible,
  validarProfesorDisponible,
  validarCursoUnico,
  editarCurso,
);

router.post("/cursos/:id_curso/duplicar", esAdminODirector, duplicarCurso);

router.delete("/cursos/:id_curso", esAdminODirector, eliminarCurso);

// Activar un curso previamente desactivado
router.patch("/cursos/:id_curso/activar", esAdminODirector, activarCurso);

module.exports = router;

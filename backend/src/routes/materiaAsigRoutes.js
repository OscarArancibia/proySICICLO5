const express = require("express");
const router = express.Router();
const {
  verificarToken,
  esAdminODirector,
} = require("../middlewares/authMiddleware");
const {
  validarMateriaSinCalificaciones,
} = require("../middlewares/validationMiddleware");
const {
  obtenerMateriasDisponibles,
  asignarMaterias,
  cambiarProfesorMateria,
  eliminarAsignacionMateria,
  cargarPlantillaMateriasPorNivel,
} = require("../controllers/materiaAsigController");

router.use(verificarToken);

router.get(
  "/cursos/:id_curso/materias/disponibles",
  verificarToken,
  obtenerMateriasDisponibles,
);

router.post("/cursos/:id_curso/materias", esAdminODirector, asignarMaterias);

router.put(
  "/cursos/materias/:id_curso_materia/profesor",
  esAdminODirector,
  cambiarProfesorMateria,
);

router.delete(
  "/cursos/materias/:id_curso_materia",
  esAdminODirector,
  validarMateriaSinCalificaciones,
  eliminarAsignacionMateria,
);

router.post(
  "/cursos/:id_curso/materias/plantilla",
  esAdminODirector,
  cargarPlantillaMateriasPorNivel,
);

module.exports = router;

const pool = require("../config/db");
const { registrarBitacora, getClientIp } = require("../utils/bitacora");

const crearError = (mensaje, codigoEstado) => {
  const error = new Error(mensaje);
  error.codigoEstado = codigoEstado;
  return error;
};

const convertirEnteroPositivo = (valor) => {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
};

const convertirFechaUtc = (valor) => {
  if (valor instanceof Date) {
    return new Date(
      Date.UTC(
        valor.getUTCFullYear(),
        valor.getUTCMonth(),
        valor.getUTCDate()
      )
    );
  }
  const partes = String(valor).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(partes[0], partes[1] - 1, partes[2]));
};

const formatearFecha = (fecha) => {
  return fecha.toISOString().slice(0, 10);
};

const calcularPeriodoTrimestre = (fechaInicioGestion, fechaFinGestion, trimestre) => {
  const fechaInicio = convertirFechaUtc(fechaInicioGestion);
  const fechaFin = convertirFechaUtc(fechaFinGestion);
  const milisegundosDia = 24 * 60 * 60 * 1000;
  const totalDias = Math.floor((fechaFin.getTime() - fechaInicio.getTime()) / milisegundosDia) + 1;
  const diasPorTrimestre = Math.ceil(totalDias / 3);

  const inicioTrimestre = new Date(fechaInicio);
  inicioTrimestre.setUTCDate(
    inicioTrimestre.getUTCDate() + (trimestre - 1) * diasPorTrimestre
  );

  const finTrimestre = new Date(inicioTrimestre);
  finTrimestre.setUTCDate(finTrimestre.getUTCDate() + diasPorTrimestre - 1);

  if (trimestre === 3 || finTrimestre > fechaFin) {
    finTrimestre.setTime(fechaFin.getTime());
  }

  return {
    fecha_inicio: formatearFecha(inicioTrimestre),
    fecha_fin: formatearFecha(finTrimestre)
  };
};

const determinarNivelRiesgo = (promedio, inasistencias, tardanzas) => {
  const tienePromedio = promedio !== null && promedio !== undefined;

  if (tienePromedio && promedio < 51 && inasistencias >= 5) {
    return "CRITICO";
  }

  if ((tienePromedio && promedio < 51) || inasistencias >= 5) {
    return "ALTO";
  }

  if (
    (tienePromedio && promedio < 70) ||
    inasistencias >= 3 ||
    tardanzas >= 4
  ) {
    return "MEDIO";
  }

  return "BAJO";
};

const identificarCausas = (promedio, inasistencias, tardanzas) => {
  const causas = [];

  if (promedio !== null && promedio < 51) {
    causas.push("Promedio menor a 51 puntos");
  } else if (promedio !== null && promedio < 70) {
    causas.push("Promedio entre 51 y 69 puntos");
  }

  if (inasistencias >= 5) {
    causas.push("Cinco o más inasistencias no justificadas");
  } else if (inasistencias >= 3) {
    causas.push("Tres o cuatro inasistencias no justificadas");
  }

  if (tardanzas >= 4) {
    causas.push("Cuatro o más tardanzas");
  }

  return causas;
};

const ordenarResultados = (resultados) => {
  const prioridad = {
    CRITICO: 4,
    ALTO: 3,
    MEDIO: 2,
    BAJO: 1
  };

  return resultados.sort((primero, segundo) => {
    const diferencia =
      (prioridad[segundo.nivel_riesgo] || 0) -
      (prioridad[primero.nivel_riesgo] || 0);

    if (diferencia !== 0) return diferencia;

    return primero.nombre_completo.localeCompare(segundo.nombre_completo);
  });
};

const obtenerContextoAnalisis = async (idCurso, idMateria, usuario) => {
  const resultado = await pool.query(
    `
      SELECT
        c.id_curso,
        c.id_gestion,
        c.id_profesor AS id_profesor_titular,
        c.paralelo,
        c.turno,
        g.nombre_grado,
        n.nombre_nivel,
        ga.anio,
        ga.fecha_inicio,
        ga.fecha_fin,
        cm.id_curso_materia,
        cm.id_profesor AS id_profesor_materia,
        m.id_materia,
        m.nombre_materia
      FROM curso c
      JOIN grado g ON g.id_grado = c.id_grado
      JOIN nivel n ON n.id_nivel = g.id_nivel
      JOIN gestion_academica ga ON ga.id_gestion = c.id_gestion
      JOIN curso_materia cm ON cm.id_curso = c.id_curso
      JOIN materia m ON m.id_materia = cm.id_materia
      WHERE c.id_curso = $1
        AND m.id_materia = $2
        AND c.estado = TRUE
        AND m.estado = TRUE
        AND ga.estado = 'activa'
      LIMIT 1
    `,
    [idCurso, idMateria]
  );

  if (resultado.rows.length === 0) {
    throw crearError(
      "El curso o la materia no existen, no están relacionados o no pertenecen a la gestión activa",
      404
    );
  }

  const contexto = resultado.rows[0];
  const rolesPermitidos = ["SuperUsuario", "Director", "Profesor", "Docente"];

  if (!rolesPermitidos.includes(usuario.nombre_rol)) {
    throw crearError(
      "No tiene permiso para consultar el monitoreo académico",
      403
    );
  }

  if (["Profesor", "Docente"].includes(usuario.nombre_rol)) {
    const profesor = await pool.query(
      `
        SELECT id_profesor
        FROM profesor
        WHERE id_usuario = $1
          AND estado = TRUE
        LIMIT 1
      `,
      [usuario.id]
    );

    if (profesor.rows.length === 0) {
      throw crearError(
        "La cuenta no está vinculada a un profesor activo",
        403
      );
    }

    const idProfesor = Number(profesor.rows[0].id_profesor);
    const esTitular = idProfesor === Number(contexto.id_profesor_titular);
    const dictaMateria = idProfesor === Number(contexto.id_profesor_materia);

    if (!esTitular && !dictaMateria) {
      throw crearError(
        "Solo puede analizar cursos o materias que tenga asignados",
        403
      );
    }
  }

  return contexto;
};

const obtenerAnalisisCurso = async ({ id_curso, id_materia, trimestre, usuario, id_estudiante = null }) => {
  const idCurso = convertirEnteroPositivo(id_curso);
  const idMateria = convertirEnteroPositivo(id_materia);
  const numeroTrimestre = convertirEnteroPositivo(trimestre);
  const idEstudiante = id_estudiante
    ? convertirEnteroPositivo(id_estudiante)
    : null;

  if (!idCurso || !idMateria || !numeroTrimestre) {
    throw crearError(
      "El curso, la materia y el trimestre son obligatorios",
      400
    );
  }

  if (![1, 2, 3].includes(numeroTrimestre)) {
    throw crearError("El trimestre debe ser 1, 2 o 3", 400);
  }

  if (id_estudiante && !idEstudiante) {
    throw crearError("El estudiante seleccionado no es válido", 400);
  }

  const contexto = await obtenerContextoAnalisis(
    idCurso,
    idMateria,
    usuario
  );

  const periodo = calcularPeriodoTrimestre(
    contexto.fecha_inicio,
    contexto.fecha_fin,
    numeroTrimestre
  );

  const resultado = await pool.query(
    `
      WITH estudiantes_inscritos AS (
        SELECT
          e.id_estudiante,
          e.nombre,
          e.apellido,
          e.ci
        FROM inscripcion i
        JOIN estudiante e ON e.id_estudiante = i.id_estudiante
        WHERE i.id_curso = $1
          AND i.estado = 'inscrito'
          AND e.estado = 'activo'
          AND ($6::integer IS NULL OR e.id_estudiante = $6)
      ),
      promedios_dimension AS (
        SELECT
          cal.id_estudiante,
          ae.id_dimension_eval,
          AVG(cal.nota)::numeric AS promedio_dimension,
          MAX(de.puntaje_maximo)::numeric AS puntaje_maximo,
          COUNT(cal.id_calificacion)::integer AS total_calificaciones
        FROM calificacion cal
        JOIN actividad_evaluacion ae
          ON ae.id_actividad = cal.id_actividad
        JOIN curso_materia cm
          ON cm.id_curso_materia = ae.id_curso_materia
        JOIN dimension_evaluacion de
          ON de.id_dimension_eval = ae.id_dimension_eval
        WHERE cm.id_curso = $1
          AND cm.id_materia = $2
          AND ae.trimestre = $3
          AND cal.id_estudiante IN (
            SELECT id_estudiante FROM estudiantes_inscritos
          )
        GROUP BY cal.id_estudiante, ae.id_dimension_eval
      ),
      resumen_calificaciones AS (
        SELECT
          id_estudiante,
          ROUND(
            (
              SUM(promedio_dimension) /
              NULLIF(SUM(puntaje_maximo), 0) * 100
            )::numeric,
            2
          ) AS promedio,
          SUM(total_calificaciones)::integer AS total_calificaciones,
          COUNT(id_dimension_eval)::integer AS dimensiones_calificadas
        FROM promedios_dimension
        GROUP BY id_estudiante
      ),
      resumen_asistencias AS (
        SELECT
          a.id_estudiante,
          COUNT(a.id_asistencia)::integer AS total_registros_asistencia,
          COUNT(*) FILTER (WHERE a.estado = 'A')::integer AS inasistencias,
          COUNT(*) FILTER (WHERE a.estado = 'T')::integer AS tardanzas,
          COUNT(*) FILTER (WHERE a.estado = 'J')::integer AS justificadas,
          COUNT(*) FILTER (WHERE a.estado = 'L')::integer AS licencias
        FROM asistencia a
        WHERE a.id_curso = $1
          AND a.fecha BETWEEN $4::date AND $5::date
          AND a.id_estudiante IN (
            SELECT id_estudiante FROM estudiantes_inscritos
          )
        GROUP BY a.id_estudiante
      )
      SELECT
        ei.id_estudiante,
        ei.nombre,
        ei.apellido,
        ei.ci,
        rc.promedio,
        COALESCE(rc.total_calificaciones, 0)::integer AS total_calificaciones,
        COALESCE(rc.dimensiones_calificadas, 0)::integer AS dimensiones_calificadas,
        COALESCE(ra.total_registros_asistencia, 0)::integer AS total_registros_asistencia,
        COALESCE(ra.inasistencias, 0)::integer AS inasistencias,
        COALESCE(ra.tardanzas, 0)::integer AS tardanzas,
        COALESCE(ra.justificadas, 0)::integer AS justificadas,
        COALESCE(ra.licencias, 0)::integer AS licencias
      FROM estudiantes_inscritos ei
      LEFT JOIN resumen_calificaciones rc
        ON rc.id_estudiante = ei.id_estudiante
      LEFT JOIN resumen_asistencias ra
        ON ra.id_estudiante = ei.id_estudiante
      ORDER BY ei.apellido, ei.nombre
    `,
    [
      idCurso,
      idMateria,
      numeroTrimestre,
      periodo.fecha_inicio,
      periodo.fecha_fin,
      idEstudiante,
    ]
  );

  if (idEstudiante && resultado.rows.length === 0) {
    throw crearError(
      "El estudiante no está inscrito activamente en el curso seleccionado",
      404
    );
  }

  const estudiantes = resultado.rows.map((fila) => {
    const promedio =
      fila.promedio === null ? null : Number.parseFloat(fila.promedio);
    const inasistencias = Number(fila.inasistencias);
    const tardanzas = Number(fila.tardanzas);
    const tieneDatos =
      Number(fila.total_calificaciones) > 0 ||
      Number(fila.total_registros_asistencia) > 0;
    const nivelRiesgo = tieneDatos
      ? determinarNivelRiesgo(promedio, inasistencias, tardanzas)
      : null;
    const causas = tieneDatos
      ? identificarCausas(promedio, inasistencias, tardanzas)
      : [];

    return {
      id_estudiante: Number(fila.id_estudiante),
      nombre: fila.nombre,
      apellido: fila.apellido,
      nombre_completo: `${fila.nombre} ${fila.apellido}`.trim(),
      ci: fila.ci,
      promedio,
      total_calificaciones: Number(fila.total_calificaciones),
      dimensiones_calificadas: Number(fila.dimensiones_calificadas),
      total_registros_asistencia: Number(fila.total_registros_asistencia),
      inasistencias,
      tardanzas,
      justificadas: Number(fila.justificadas),
      licencias: Number(fila.licencias),
      nivel_riesgo: nivelRiesgo,
      causa_principal: causas[0] || null,
      causas,
      estado_analisis: tieneDatos ? "analizado" : "sin_datos",
    };
  });

  const estudiantesOrdenados = ordenarResultados(estudiantes);
  const resumen = estudiantesOrdenados.reduce(
    (acumulado, estudiante) => {
      acumulado.total_estudiantes += 1;

      if (!estudiante.nivel_riesgo) {
        acumulado.sin_datos += 1;
        return acumulado;
      }

      acumulado[estudiante.nivel_riesgo.toLowerCase()] += 1;

      if (["MEDIO", "ALTO", "CRITICO"].includes(estudiante.nivel_riesgo)) {
        acumulado.total_en_riesgo += 1;
      }

      return acumulado;
    },
    {
      total_estudiantes: 0,
      total_en_riesgo: 0,
      bajo: 0,
      medio: 0,
      alto: 0,
      critico: 0,
      sin_datos: 0,
    }
  );

  return {
    contexto: {
      id_curso: Number(contexto.id_curso),
      curso: `${contexto.nombre_grado} ${contexto.paralelo}`,
      nivel: contexto.nombre_nivel,
      turno: contexto.turno,
      id_materia: Number(contexto.id_materia),
      materia: contexto.nombre_materia,
      id_gestion: Number(contexto.id_gestion),
      gestion: Number(contexto.anio),
      trimestre: numeroTrimestre,
      periodo,
    },
    resumen,
    estudiantes: estudiantesOrdenados,
  };
};

const analizarRiesgo = async (req, res) => {
  try {
    const analisis = await obtenerAnalisisCurso({
      ...req.body,
      usuario: req.usuario,
    });

    await registrarBitacora({
      id_usuario: req.usuario.id,
      nombre_modulo: "evaluaciones",
      accion: "CONSULTA",
      tabla_afectada: "calificacion",
      id_registro_afectado: analisis.contexto.id_curso,
      descripcion: `Análisis de riesgo académico del curso ${analisis.contexto.id_curso}, materia ${analisis.contexto.id_materia}, trimestre ${analisis.contexto.trimestre}`,
      ip_origen: getClientIp(req),
    });

    return res.json({
      message: "Análisis de riesgo académico realizado correctamente",
      ...analisis,
    });
  } catch (error) {
    console.error("Error en analizarRiesgo:", error);
    return res.status(error.codigoEstado || 500).json({
      message: error.codigoEstado === undefined ? "Error interno del servidor" : error.message,
      error: error.message,
    });
  }
};

const consultarEstudiantesEnRiesgo = async (req, res) => {
  try {
    const { nivel_riesgo } = req.query;
    const analisis = await obtenerAnalisisCurso({
      ...req.query,
      usuario: req.usuario,
    });

    let estudiantesEnRiesgo = analisis.estudiantes.filter((estudiante) =>
      ["MEDIO", "ALTO", "CRITICO"].includes(estudiante.nivel_riesgo)
    );

    if (nivel_riesgo) {
      const nivelSolicitado = String(nivel_riesgo).trim().toUpperCase();

      if (!["MEDIO", "ALTO", "CRITICO"].includes(nivelSolicitado)) {
        return res.status(400).json({
          message: "El nivel de riesgo debe ser MEDIO, ALTO o CRITICO",
        });
      }

      estudiantesEnRiesgo = estudiantesEnRiesgo.filter(
        (estudiante) => estudiante.nivel_riesgo === nivelSolicitado
      );
    }

    await registrarBitacora({
      id_usuario: req.usuario.id,
      nombre_modulo: "evaluaciones",
      accion: "CONSULTA",
      tabla_afectada: "calificacion",
      id_registro_afectado: analisis.contexto.id_curso,
      descripcion: `Consulta de estudiantes en riesgo del curso ${analisis.contexto.id_curso}, materia ${analisis.contexto.id_materia}, trimestre ${analisis.contexto.trimestre}`,
      ip_origen: getClientIp(req),
    });

    return res.json({
      message:
        estudiantesEnRiesgo.length > 0
          ? "Estudiantes en riesgo obtenidos correctamente"
          : "No existen estudiantes en riesgo para los criterios seleccionados",
      contexto: analisis.contexto,
      resumen: {
        ...analisis.resumen,
        total_filtrado: estudiantesEnRiesgo.length,
      },
      estudiantes: estudiantesEnRiesgo,
    });
  } catch (error) {
    console.error("Error en consultarEstudiantesEnRiesgo:", error);
    return res.status(error.codigoEstado || 500).json({
      message: error.codigoEstado === undefined ? "Error interno del servidor" : error.message,
      error: error.message,
    });
  }
};

module.exports = {
  analizarRiesgo,
  consultarEstudiantesEnRiesgo,
  obtenerAnalisisCurso,
};
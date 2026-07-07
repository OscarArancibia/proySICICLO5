const pool = require("../config/db");
const { obtenerAnalisisCurso } = require("./riesgoAcademicoController");

const obtenerRecomendaciones = (estudiante, nivelRiesgo) => {
  const recomendaciones = [];
  const promedio = estudiante.promedio;
  const inasistencias = estudiante.inasistencias;
  const tardanzas = estudiante.tardanzas;

  if (promedio !== null && promedio < 51) {
    recomendaciones.push(
      "Realizar una actividad de recuperación y reforzar los contenidos de la materia."
    );
  }

  if (inasistencias >= 5) {
    recomendaciones.push("Contactar al tutor para revisar las inasistencias frecuentes.");
  } else if (inasistencias >= 3) {
    recomendaciones.push(
      "Realizar seguimiento de asistencia y solicitar la justificación correspondiente."
    );
  }

  if (tardanzas >= 4) {
    recomendaciones.push("Realizar seguimiento a la puntualidad del estudiante.");
  }

  if (nivelRiesgo === "CRITICO") {
    recomendaciones.push(
      "Programar una reunión con el tutor y realizar seguimiento académico inmediato."
    );
  }

  return recomendaciones;
};

// CU31 - Generar recomendación de seguimiento
const generarRecomendacion = async (req, res) => {
  try {
    const { id_curso, id_materia, trimestre, id_estudiante } = req.body;

    if (!id_estudiante) {
      return res.status(400).json({
        message: "El estudiante es obligatorio"
      });
    }

    const analisis = await obtenerAnalisisCurso({
      id_curso,
      id_materia,
      trimestre,
      usuario: req.usuario,
      id_estudiante
    });

    const estudiante = analisis.estudiantes.find(
      (e) => e.id_estudiante === Number(id_estudiante)
    );

    if (!estudiante) {
      return res.status(404).json({
        message: "Estudiante no encontrado en el curso y materia seleccionados"
      });
    }

    const nivelRiesgo = estudiante.nivel_riesgo;
    const recomendaciones = obtenerRecomendaciones(estudiante, nivelRiesgo);

    return res.json({
      message: "Recomendaciones generadas correctamente",
      contexto: analisis.contexto,
      estudiante: {
        id_estudiante: estudiante.id_estudiante,
        nombre_completo: estudiante.nombre_completo,
        promedio: estudiante.promedio,
        inasistencias: estudiante.inasistencias,
        tardanzas: estudiante.tardanzas,
        nivel_riesgo: nivelRiesgo,
        causas: estudiante.causas
      },
      recomendaciones
    });
  } catch (error) {
    console.error("Error en generarRecomendacion:", error);
    return res.status(error.codigoEstado || 500).json({
      message: error.codigoEstado === undefined ? "Error interno del servidor" : error.message,
      error: error.message
    });
  }
};

// CU32 - Notificar alerta al tutor
const notificarTutor = async (req, res) => {
  const { id_curso, id_materia, trimestre, id_estudiante, id_tutor } = req.body;
  const idUsuario = req.usuario.id;

  if (!id_estudiante) {
    return res.status(400).json({
      message: "El estudiante es obligatorio"
    });
  }

  try {
    // 1. Volver a analizar al estudiante
    const analisis = await obtenerAnalisisCurso({
      id_curso,
      id_materia,
      trimestre,
      usuario: req.usuario,
      id_estudiante
    });

    const estudiante = analisis.estudiantes.find(
      (e) => e.id_estudiante === Number(id_estudiante)
    );

    if (!estudiante) {
      return res.status(404).json({
        message: "Estudiante no encontrado en el curso y materia seleccionados"
      });
    }

    // 2. Validar que continúe en riesgo
    const nivelRiesgo = estudiante.nivel_riesgo;
    if (!nivelRiesgo || nivelRiesgo === "BAJO") {
      return res.status(400).json({
        message: "El estudiante no se encuentra en un nivel de riesgo académico (su riesgo es BAJO o SIN DATOS)"
      });
    }

    // 3. Consultar los tutores vinculados realmente
    const tutoresResult = await pool.query(
      `
      SELECT t.id_tutor, t.nombre, t.apellido, t.telefono, t.correo_electronico, te.parentesco
      FROM tutor t
      JOIN tutor_estudiante te ON t.id_tutor = te.id_tutor
      WHERE te.id_estudiante = $1
      `,
      [id_estudiante]
    );

    const tutores = tutoresResult.rows;

    if (tutores.length === 0) {
      return res.status(404).json({
        message: "El estudiante no tiene tutores vinculados"
      });
    }

    // 4. Si hay varios tutores y no se especifica uno, devolver la lista
    let tutorDestinatario = null;
    if (!id_tutor) {
      if (tutores.length === 1) {
        tutorDestinatario = tutores[0];
      } else {
        return res.json({
          requiere_seleccion_tutor: true,
          message: "El estudiante tiene varios tutores. Por favor seleccione uno.",
          tutores: tutores.map((t) => ({
            id_tutor: t.id_tutor,
            nombre_completo: `${t.nombre} ${t.apellido}`.trim(),
            parentesco: t.parentesco,
            telefono: t.telefono,
            correo_electronico: t.correo_electronico
          }))
        });
      }
    } else {
      // Validar que el tutor elegido pertenezca al estudiante
      tutorDestinatario = tutores.find((t) => t.id_tutor === Number(id_tutor));
      if (!tutorDestinatario) {
        return res.status(400).json({
          message: "El tutor seleccionado no está vinculado a este estudiante"
        });
      }
    }

    // 5. Generar el mensaje y título del aviso
    const titulo = `Alerta Académica - Trimestre ${trimestre} - ${estudiante.nombre_completo}`;
    const recomendaciones = obtenerRecomendaciones(estudiante, nivelRiesgo);

    const contenido = req.body.mensaje || `Estimado/a tutor/a ${tutorDestinatario.nombre} ${tutorDestinatario.apellido},

Se genera esta alerta académica automática de seguimiento para el estudiante:
Estudiante: ${estudiante.nombre_completo}
Curso: ${analisis.contexto.curso}
Materia: ${analisis.contexto.materia}
Trimestre: ${trimestre}

MÉTRICAS DE RENDIMIENTO:
- Promedio actual en la materia: ${estudiante.promedio !== null ? estudiante.promedio + " puntos" : "Sin calificaciones"}
- Inasistencias no justificadas: ${estudiante.inasistencias}
- Tardanzas: ${estudiante.tardanzas}

NIVEL DE RIESGO DETECTADO: ${nivelRiesgo}

CAUSAS DE ALERTA:
${estudiante.causas.map((c) => `- ${c}`).join("\n") || "- Ninguna causa crítica registrada"}

RECOMENDACIONES SUGERIDAS:
${recomendaciones.map((r) => `- ${r}`).join("\n") || "- Realizar acompañamiento general del estudiante"}`;

    // 6. Registrar en Base de Datos usando transacción
    const client = await pool.connect();
    let idAviso = null;
    try {
      await client.query("BEGIN");

      // Insertar aviso
      const avisoRes = await client.query(
        `
        INSERT INTO aviso (titulo, contenido, id_usuario, destinatario_tipo, 
                          id_curso_destino, id_estudiante_destino, estado, fecha_envio)
        VALUES ($1, $2, $3, 'individual', NULL, $4, 'enviado', NOW())
        RETURNING id_aviso
        `,
        [titulo, contenido, idUsuario, id_estudiante]
      );
      idAviso = avisoRes.rows[0].id_aviso;

      // Insertar notificacion para el tutor
      await client.query(
        `
        INSERT INTO notificacion (id_aviso, id_tutor, canal, estado_envio, fecha_envio)
        VALUES ($1, $2, 'panel', 'enviado', NOW())
        `,
        [idAviso, tutorDestinatario.id_tutor]
      );

      await client.query("COMMIT");
    } catch (txError) {
      await client.query("ROLLBACK");
      throw txError;
    } finally {
      client.release();
    }

    // 10. Registrar la operación en bitácora
    const { registrarBitacora, getClientIp } = require("../utils/bitacora");
    await registrarBitacora({
      id_usuario: idUsuario,
      nombre_modulo: "evaluaciones",
      accion: "INSERT",
      tabla_afectada: "aviso",
      id_registro_afectado: idAviso,
      descripcion: `Notificación de alerta académica enviada al tutor ID ${tutorDestinatario.id_tutor} para el estudiante ID ${id_estudiante}`,
      ip_origen: getClientIp(req)
    });

    // 11. Devolver confirmación al frontend
    return res.json({
      message: "La alerta fue enviada correctamente al tutor.",
      aviso: {
        id_aviso: idAviso,
        titulo,
        destinatario: `${tutorDestinatario.nombre} ${tutorDestinatario.apellido}`.trim(),
        parentesco: tutorDestinatario.parentesco,
        mensaje: contenido
      }
    });
  } catch (error) {
    console.error("Error en notificarTutor:", error);
    return res.status(error.codigoEstado || 500).json({
      message: error.codigoEstado === undefined ? "Error interno del servidor" : error.message,
      error: error.message
    });
  }
};

module.exports = {
  generarRecomendacion,
  notificarTutor
};

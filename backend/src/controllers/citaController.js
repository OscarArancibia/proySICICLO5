const pool = require("../config/db");
const transporter = require("../config/mailer");
const { enviarNotificacion } = require("../services/notificacionService"); // si lo tienes

// El token JWT trae id_usuario (req.usuario.id), no id_profesor.
// Este helper mapea el usuario logueado a su registro de profesor.
async function obtenerIdProfesor(idUsuario) {
  const r = await pool.query(
    "SELECT id_profesor FROM profesor WHERE id_usuario = $1",
    [idUsuario],
  );
  return r.rows[0]?.id_profesor ?? null;
}

// --------------------  PROFESOR: REGISTRAR HORARIO DE ATENCIÓN  --------------------
const registrarHorarioAtencion = async (req, res, next) => {
  try {
    const {
      dia_semana,
      hora_inicio,
      hora_fin,
      modalidad,
      enlace_videollamada,
    } = req.body;

    // Validar que sea profesor
    if (req.usuario.nombre_rol !== "Profesor") {
      return res.status(403).json({
        error: "Solo profesores pueden registrar horarios de atención",
      });
    }

    // Mapear el usuario logueado a su id_profesor
    const idProfesor = await obtenerIdProfesor(req.usuario.id);
    if (!idProfesor) {
      return res
        .status(403)
        .json({ error: "Tu usuario no está vinculado a un profesor" });
    }

    // Validar campos obligatorios
    if (!dia_semana || !hora_inicio || !hora_fin || !modalidad) {
      return res
        .status(400)
        .json({ error: "Debe completar todos los campos obligatorios" });
    }

    // Validar que el bloque no coincida con clases del profesor (desde tabla horario)
    const conflictoQuery = `
  SELECT 1
  FROM horario h
  JOIN curso_materia cm ON h.id_curso = cm.id_curso
  WHERE cm.id_profesor = $1
    AND h.dia_semana = $2
    AND h.hora_inicio < $4
    AND h.hora_fin > $3
  LIMIT 1
`;
    const conflicto = await pool.query(conflictoQuery, [
      idProfesor,
      dia_semana,
      hora_inicio,
      hora_fin,
    ]);
    if (conflicto.rows.length > 0) {
      return res.status(409).json({
        error:
          "Conflicto de horario: ya tiene una clase asignada en ese bloque",
      });
    }

    // Insertar horario de atención
    const insertQuery = `
      INSERT INTO horario_atencion (id_profesor, dia_semana, hora_inicio, hora_fin, modalidad, enlace_videollamada)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id_horario_atencion
    `;
    const result = await pool.query(insertQuery, [
      idProfesor,
      dia_semana,
      hora_inicio,
      hora_fin,
      modalidad,
      enlace_videollamada || null,
    ]);

    // Bitácora
    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, tabla_afectada, descripcion)
       VALUES ($1, 'INSERT', 'horario_atencion', 'Registró horario de atención ID ${result.rows[0].id_horario_atencion}')`,
      [req.usuario.id],
    );

    res.status(201).json({
      mensaje: "Horario de atención registrado correctamente",
      id_horario_atencion: result.rows[0].id_horario_atencion,
    });
  } catch (error) {
    // Bloque duplicado (mismo profesor, día y horas) → violación de UNIQUE.
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ error: "Ya tienes publicado ese bloque de atención" });
    }
    next(error);
  }
};

// --------------------  TUTOR: LISTAR HORARIOS DISPONIBLES DE UN PROFESOR  --------------------
const listarHorariosDisponibles = async (req, res, next) => {
  try {
    const { id_profesor } = req.params;
    // El tutor accede con la cuenta del estudiante (rol Estudiante).
    const idEstudiante = req.usuario.id_estudiante;
    if (!idEstudiante) {
      return res
        .status(403)
        .json({ error: "Debe acceder con la cuenta del estudiante" });
    }

    // Verificar que el estudiante esté inscrito en un curso de ese profesor
    const vinculoQuery = `
      SELECT 1
      FROM inscripcion i
      JOIN curso_materia cm ON i.id_curso = cm.id_curso
      WHERE i.id_estudiante = $1
        AND i.estado = 'inscrito'
        AND cm.id_profesor = $2
      LIMIT 1
    `;
    const vinculo = await pool.query(vinculoQuery, [idEstudiante, id_profesor]);
    if (vinculo.rows.length === 0) {
      return res
        .status(403)
        .json({ error: "No tiene acceso a los horarios de este profesor" });
    }

    // Obtener horarios disponibles (estado 'disponible' y sin cita confirmada)
    const query = `
      SELECT ha.id_horario_atencion, ha.dia_semana, ha.hora_inicio, ha.hora_fin,
             ha.modalidad, ha.enlace_videollamada
      FROM horario_atencion ha
      LEFT JOIN cita c ON ha.id_horario_atencion = c.id_horario_atencion AND c.estado IN ('confirmada', 'pendiente')
      WHERE ha.id_profesor = $1
        AND ha.estado = 'disponible'
        AND c.id_cita IS NULL
      ORDER BY 
        CASE ha.dia_semana
          WHEN 'lunes' THEN 1
          WHEN 'martes' THEN 2
          WHEN 'miercoles' THEN 3
          WHEN 'jueves' THEN 4
          WHEN 'viernes' THEN 5
          WHEN 'sabado' THEN 6
        END, ha.hora_inicio
    `;
    const { rows } = await pool.query(query, [id_profesor]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: "El profesor no tiene horarios disponibles en este momento",
      });
    }

    res.json({ horarios: rows });
  } catch (error) {
    next(error);
  }
};

// --------------------  TUTOR: SOLICITAR CITA  --------------------
const solicitarCita = async (req, res, next) => {
  try {
    const { id_horario_atencion, motivo, id_tutor } = req.body;
    // El tutor solicita desde la cuenta del estudiante (rol Estudiante).
    const idEstudiante = req.usuario.id_estudiante;
    if (!idEstudiante) {
      return res
        .status(403)
        .json({ error: "Debe acceder con la cuenta del estudiante" });
    }

    // Validar campos obligatorios
    if (!id_horario_atencion || !motivo || !id_tutor) {
      return res
        .status(400)
        .json({ error: "Debe especificar horario, motivo y tutor" });
    }

    // Verificar que el horario existe, está disponible y no tiene cita confirmada
    const horarioQuery = `
      SELECT ha.id_profesor, ha.dia_semana, ha.hora_inicio, ha.hora_fin
      FROM horario_atencion ha
      LEFT JOIN cita c ON ha.id_horario_atencion = c.id_horario_atencion AND c.estado IN ('confirmada', 'pendiente')
      WHERE ha.id_horario_atencion = $1
        AND ha.estado = 'disponible'
        AND c.id_cita IS NULL
    `;
    const horario = await pool.query(horarioQuery, [id_horario_atencion]);
    if (horario.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "El horario seleccionado ya no está disponible" });
    }
    const { id_profesor, dia_semana, hora_inicio, hora_fin } = horario.rows[0];

    // Verificar que el estudiante esté inscrito en un curso de ese profesor
    const vinculoQuery = `
      SELECT 1
      FROM inscripcion i
      JOIN curso_materia cm ON i.id_curso = cm.id_curso
      WHERE i.id_estudiante = $1
        AND i.estado = 'inscrito'
        AND cm.id_profesor = $2
      LIMIT 1
    `;
    const vinculo = await pool.query(vinculoQuery, [idEstudiante, id_profesor]);
    if (vinculo.rows.length === 0) {
      return res
        .status(403)
        .json({ error: "El estudiante no está vinculado a este profesor" });
    }

    // Verificar que el tutor elegido esté vinculado al estudiante
    const tutorVinc = await pool.query(
      "SELECT 1 FROM tutor_estudiante WHERE id_tutor = $1 AND id_estudiante = $2 LIMIT 1",
      [id_tutor, idEstudiante],
    );
    if (tutorVinc.rows.length === 0) {
      return res.status(403).json({
        error: "El tutor seleccionado no está vinculado al estudiante",
      });
    }

    // Crear la cita en estado 'pendiente'
    // fecha_cita = próxima ocurrencia del día del bloque (>= hoy).
    const insertQuery = `
      INSERT INTO cita (id_horario_atencion, id_profesor, id_tutor, id_estudiante, motivo, fecha_cita)
      VALUES ($1, $2, $3, $4, $5,
        CURRENT_DATE + ((array_position(ARRAY['domingo','lunes','martes','miercoles','jueves','viernes','sabado'], $6) - 1 - EXTRACT(DOW FROM CURRENT_DATE)::int + 7) % 7)
      )
      RETURNING id_cita, fecha_cita
    `;
    const result = await pool.query(insertQuery, [
      id_horario_atencion,
      id_profesor,
      id_tutor,
      idEstudiante,
      motivo,
      dia_semana,
    ]);

    // Notificar al profesor (pendiente)
    // Aquí puedes usar transporter o tu servicio de notificaciones
    const profesorQuery = `SELECT nombre, apellido, id_usuario FROM profesor WHERE id_profesor = $1`;
    const profesor = await pool.query(profesorQuery, [id_profesor]);
    if (profesor.rows.length > 0) {
      // Ejemplo: enviar correo al profesor (si tiene email en usuario)
      const usuarioProf = await pool.query(
        `SELECT email FROM usuario WHERE id_usuario = $1`,
        [profesor.rows[0].id_usuario],
      );
      if (usuarioProf.rows.length > 0 && usuarioProf.rows[0].email) {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: usuarioProf.rows[0].email,
          subject: "Nueva solicitud de cita",
          text: `Tiene una nueva solicitud de cita para el ${dia_semana} a las ${hora_inicio}.\nMotivo: ${motivo}`,
        });
      }
    }

    // Bitácora
    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, tabla_afectada, descripcion)
       VALUES ($1, 'INSERT', 'cita', 'Solicitó cita ID ${result.rows[0].id_cita}')`,
      [req.usuario.id],
    );

    res.status(201).json({
      mensaje: "Cita solicitada correctamente",
      id_cita: result.rows[0].id_cita,
    });
  } catch (error) {
    next(error);
  }
};

// --------------------  PROFESOR: CONFIRMAR CITA  --------------------
const confirmarCita = async (req, res, next) => {
  try {
    const { id_cita } = req.params;
    const idProfesor = await obtenerIdProfesor(req.usuario.id);

    // Verificar que la cita existe y está pendiente
    const citaQuery = `
      SELECT c.id_cita, c.id_tutor, c.id_horario_atencion, c.motivo,
             ha.id_profesor, ha.dia_semana, ha.hora_inicio, ha.hora_fin, ha.modalidad, ha.enlace_videollamada
      FROM cita c
      JOIN horario_atencion ha ON c.id_horario_atencion = ha.id_horario_atencion
      WHERE c.id_cita = $1 AND c.estado = 'pendiente'
    `;
    const cita = await pool.query(citaQuery, [id_cita]);
    if (cita.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Cita no encontrada o ya procesada" });
    }

    // Verificar que el profesor sea el propietario
    if (cita.rows[0].id_profesor !== idProfesor) {
      return res
        .status(403)
        .json({ error: "No tiene permiso para confirmar esta cita" });
    }

    // Actualizar estado a confirmada
    await pool.query(
      `UPDATE cita SET estado = 'confirmada', fecha_confirmacion = NOW() WHERE id_cita = $1`,
      [id_cita],
    );

    // Notificar al tutor
    const tutorQuery = `SELECT t.nombre, t.correo_electronico FROM tutor t WHERE t.id_tutor = $1`;
    const tutor = await pool.query(tutorQuery, [cita.rows[0].id_tutor]);
    if (tutor.rows.length > 0 && tutor.rows[0].correo_electronico) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: tutor.rows[0].correo_electronico,
        subject: "Cita confirmada",
        text: `Su cita ha sido confirmada para el ${cita.rows[0].dia_semana} a las ${cita.rows[0].hora_inicio}.\nMotivo: ${cita.rows[0].motivo}`,
      });
    }

    // Bitácora
    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, tabla_afectada, descripcion)
       VALUES ($1, 'UPDATE', 'cita', 'Confirmó cita ID ${id_cita}')`,
      [req.usuario.id],
    );

    res.json({ mensaje: "Cita confirmada correctamente" });
  } catch (error) {
    next(error);
  }
};

// --------------------  PROFESOR: PROPONER ALTERNATIVA  --------------------
const proponerAlternativa = async (req, res, next) => {
  try {
    const { id_cita } = req.params;
    const { id_horario_atencion_alternativo, mensaje_alternativa } = req.body;
    const idProfesor = await obtenerIdProfesor(req.usuario.id);

    // Validar que el nuevo horario exista y esté disponible
    const horarioQuery = `
      SELECT 1 FROM horario_atencion
      WHERE id_horario_atencion = $1
        AND id_profesor = $2
        AND estado = 'disponible'
        AND NOT EXISTS (
          SELECT 1 FROM cita
          WHERE id_horario_atencion = $1
            AND estado IN ('confirmada', 'pendiente')
        )
    `;
    const horario = await pool.query(horarioQuery, [
      id_horario_atencion_alternativo,
      idProfesor,
    ]);
    if (horario.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "El horario alternativo no está disponible" });
    }

    // Actualizar la cita a estado 'alternativa', guardar el mensaje y
    // recalcular fecha_cita al día del nuevo bloque propuesto.
    await pool.query(
      `UPDATE cita
       SET estado = 'alternativa',
           mensaje_alternativa = $1,
           id_horario_atencion = $2,
           fecha_cita = CURRENT_DATE + ((array_position(ARRAY['domingo','lunes','martes','miercoles','jueves','viernes','sabado'],
             (SELECT dia_semana FROM horario_atencion WHERE id_horario_atencion = $2)) - 1 - EXTRACT(DOW FROM CURRENT_DATE)::int + 7) % 7)
       WHERE id_cita = $3 AND estado = 'pendiente'`,
      [mensaje_alternativa || null, id_horario_atencion_alternativo, id_cita],
    );

    // Notificar al tutor
    const citaQuery = `SELECT id_tutor FROM cita WHERE id_cita = $1`;
    const cita = await pool.query(citaQuery, [id_cita]);
    if (cita.rows.length > 0) {
      const tutorQuery = `SELECT correo_electronico FROM tutor WHERE id_tutor = $1`;
      const tutor = await pool.query(tutorQuery, [cita.rows[0].id_tutor]);
      if (tutor.rows.length > 0 && tutor.rows[0].correo_electronico) {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: tutor.rows[0].correo_electronico,
          subject: "Propuesta de horario alternativo para cita",
          text: `El profesor ha propuesto un horario alternativo. Por favor, revise su solicitud.`,
        });
      }
    }

    // Bitácora
    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, tabla_afectada, descripcion)
       VALUES ($1, 'UPDATE', 'cita', 'Propuso horario alternativo para cita ID ${id_cita}')`,
      [req.usuario.id],
    );

    res.json({ mensaje: "Horario alternativo propuesto correctamente" });
  } catch (error) {
    next(error);
  }
};

// --------------------  TUTOR (cuenta estudiante): ACEPTAR ALTERNATIVA  --------------------
const aceptarAlternativa = async (req, res, next) => {
  try {
    const { id_cita } = req.params;
    const idEstudiante = req.usuario.id_estudiante;

    // La cita debe estar en 'alternativa' y pertenecer a este estudiante.
    const citaQuery = `
      SELECT c.id_cita, c.id_profesor, c.id_estudiante, ha.dia_semana, ha.hora_inicio
      FROM cita c
      JOIN horario_atencion ha ON c.id_horario_atencion = ha.id_horario_atencion
      WHERE c.id_cita = $1 AND c.estado = 'alternativa'
    `;
    const cita = await pool.query(citaQuery, [id_cita]);
    if (cita.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Cita no encontrada o sin alternativa pendiente" });
    }
    if (cita.rows[0].id_estudiante !== idEstudiante) {
      return res
        .status(403)
        .json({ error: "No tiene permiso para aceptar esta alternativa" });
    }

    // Confirmar con el horario alternativo (recalcula fecha_cita al nuevo día).
    await pool.query(
      `UPDATE cita
       SET estado = 'confirmada',
           fecha_confirmacion = NOW(),
           fecha_cita = CURRENT_DATE + ((array_position(ARRAY['domingo','lunes','martes','miercoles','jueves','viernes','sabado'], $2) - 1 - EXTRACT(DOW FROM CURRENT_DATE)::int + 7) % 7)
       WHERE id_cita = $1`,
      [id_cita, cita.rows[0].dia_semana],
    );

    // Notificar al profesor
    const prof = await pool.query(
      `SELECT u.email FROM profesor p JOIN usuario u ON u.id_usuario = p.id_usuario WHERE p.id_profesor = $1`,
      [cita.rows[0].id_profesor],
    );
    if (prof.rows[0]?.email) {
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: prof.rows[0].email,
          subject: "Alternativa de cita aceptada",
          text: `El tutor aceptó el horario alternativo (${cita.rows[0].dia_semana} a las ${cita.rows[0].hora_inicio}). La cita quedó confirmada.`,
        });
      } catch (mailErr) {
        console.error(
          "Error al notificar aceptación de alternativa:",
          mailErr.message,
        );
      }
    }

    // Bitácora
    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, tabla_afectada, descripcion)
       VALUES ($1, 'UPDATE', 'cita', 'Aceptó alternativa y confirmó cita ID ${id_cita}')`,
      [req.usuario.id],
    );

    res.json({ mensaje: "Alternativa aceptada. La cita quedó confirmada." });
  } catch (error) {
    next(error);
  }
};

// --------------------  TUTOR O PROFESOR: CANCELAR CITA  --------------------
const cancelarCita = async (req, res, next) => {
  try {
    const { id_cita } = req.params;
    const idUsuario = req.usuario.id;
    const rol = req.usuario.nombre_rol;

    // Verificar que la cita existe y está confirmada o pendiente
    const citaQuery = `
      SELECT c.id_cita, c.id_profesor, c.id_tutor, c.id_estudiante, c.estado,
             c.fecha_cita, ha.dia_semana, ha.hora_inicio, ha.hora_fin,
             (c.fecha_cita + ha.hora_inicio) AS inicio_cita
      FROM cita c
      JOIN horario_atencion ha ON c.id_horario_atencion = ha.id_horario_atencion
      WHERE c.id_cita = $1 AND c.estado IN ('confirmada', 'pendiente')
    `;
    const cita = await pool.query(citaQuery, [id_cita]);
    if (cita.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Cita no encontrada o no se puede cancelar" });
    }

    // Verificar permisos:
    //  - Tutor: entra con la cuenta del estudiante (rol Estudiante) y la cita
    //    debe ser de ese estudiante.
    //  - Profesor: debe ser el profesor de la cita (id mapeado).
    const idProfesor = await obtenerIdProfesor(idUsuario);
    const esTutor =
      rol === "Estudiante" &&
      cita.rows[0].id_estudiante === req.usuario.id_estudiante;
    const esProfesor =
      rol === "Profesor" && cita.rows[0].id_profesor === idProfesor;
    if (!esTutor && !esProfesor) {
      return res
        .status(403)
        .json({ error: "No tiene permiso para cancelar esta cita" });
    }

    // Regla del CU: solo se puede cancelar hasta 2 horas antes del inicio.
    const inicioCita = cita.rows[0].inicio_cita;
    if (inicioCita) {
      const faltanMs = new Date(inicioCita).getTime() - Date.now();
      if (faltanMs < 2 * 60 * 60 * 1000) {
        return res.status(400).json({
          error: "Solo se puede cancelar hasta 2 horas antes de la cita",
        });
      }
    }

    // Cambiar estado a cancelada
    await pool.query(
      `UPDATE cita SET estado = 'cancelada' WHERE id_cita = $1`,
      [id_cita],
    );

    // Notificar a la otra parte (la que NO canceló) por correo.
    try {
      const { id_profesor, id_tutor, dia_semana, hora_inicio } = cita.rows[0];
      let destino = null;
      let quienCancelo = "";
      if (esTutor) {
        // Canceló el tutor → avisar al profesor (email en usuario)
        const prof = await pool.query(
          `SELECT u.email
           FROM profesor p JOIN usuario u ON u.id_usuario = p.id_usuario
           WHERE p.id_profesor = $1`,
          [id_profesor],
        );
        destino = prof.rows[0]?.email || null;
        quienCancelo = "el tutor";
      } else {
        // Canceló el profesor → avisar al tutor
        const tut = await pool.query(
          `SELECT correo_electronico FROM tutor WHERE id_tutor = $1`,
          [id_tutor],
        );
        destino = tut.rows[0]?.correo_electronico || null;
        quienCancelo = "el profesor";
      }
      if (destino) {
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: destino,
          subject: "Cita cancelada",
          text: `La cita del ${dia_semana} a las ${hora_inicio} fue cancelada por ${quienCancelo}.`,
        });
      }
    } catch (mailErr) {
      // El correo no debe tumbar la cancelación (la cita ya quedó cancelada).
      console.error("Error al notificar cancelación:", mailErr.message);
    }

    // Bitácora
    await pool.query(
      `INSERT INTO bitacora (id_usuario, accion, tabla_afectada, descripcion)
       VALUES ($1, 'UPDATE', 'cita', 'Canceló cita ID ${id_cita}')`,
      [req.usuario.id],
    );

    res.json({ mensaje: "Cita cancelada correctamente" });
  } catch (error) {
    next(error);
  }
};

// --------------------  DIRECTOR: LISTAR CITAS  --------------------
const listarCitas = async (req, res, next) => {
  try {
    const { estado, id_profesor, fecha_desde, fecha_hasta } = req.query;
    const { nombre_rol: rol, id } = req.usuario;

    let query = `
      SELECT c.id_cita, c.motivo, c.estado, c.fecha_cita, c.fecha_solicitud,
             c.fecha_confirmacion, c.mensaje_alternativa, c.id_horario_atencion,
             p.id_profesor, p.nombre AS profesor_nombre, p.apellido AS profesor_apellido,
             t.nombre AS tutor_nombre, t.apellido AS tutor_apellido,
             e.nombre AS estudiante_nombre, e.apellido AS estudiante_apellido,
             ha.dia_semana, ha.hora_inicio, ha.hora_fin, ha.modalidad, ha.enlace_videollamada
      FROM cita c
      JOIN profesor p ON c.id_profesor = p.id_profesor
      JOIN tutor t ON c.id_tutor = t.id_tutor
      JOIN estudiante e ON c.id_estudiante = e.id_estudiante
      JOIN horario_atencion ha ON c.id_horario_atencion = ha.id_horario_atencion
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    // Filtros según rol
    if (rol === "Director") {
      // Sin restricción
    } else if (rol === "Profesor") {
      const idProf = await obtenerIdProfesor(id);
      if (!idProf)
        return res.status(404).json({ error: "Profesor no encontrado" });
      query += ` AND c.id_profesor = $${idx}`;
      params.push(idProf);
      idx++;
    } else if (rol === "Estudiante" && req.usuario.id_estudiante) {
      // El tutor entra con la cuenta del estudiante: ve las citas de su hijo.
      query += ` AND c.id_estudiante = $${idx}`;
      params.push(req.usuario.id_estudiante);
      idx++;
    } else {
      return res
        .status(403)
        .json({ error: "No tienes permiso para consultar citas" });
    }

    // Filtros adicionales (solo si están definidos y no son 'undefined')
    if (estado) {
      query += ` AND c.estado = $${idx}`;
      params.push(estado);
      idx++;
    }
    if (id_profesor && rol === "Director") {
      query += ` AND c.id_profesor = $${idx}`;
      params.push(id_profesor);
      idx++;
    }
    if (fecha_desde && fecha_desde !== "undefined") {
      query += ` AND c.fecha_cita >= $${idx}`;
      params.push(fecha_desde);
      idx++;
    }
    if (fecha_hasta && fecha_hasta !== "undefined") {
      query += ` AND c.fecha_cita <= $${idx}`;
      params.push(fecha_hasta);
      idx++;
    }

    query += ` ORDER BY c.fecha_cita DESC NULLS LAST, c.fecha_solicitud DESC`;

    const { rows } = await pool.query(query, params);
    res.json({ citas: rows });
  } catch (error) {
    next(error);
  }
};

// --------------------  ESTUDIANTE: PROFESORES VINCULADOS  --------------------
// Profesores de los cursos donde está inscrito el estudiante logueado.
const listarMisProfesores = async (req, res, next) => {
  try {
    const idEstudiante = req.usuario.id_estudiante;
    if (!idEstudiante) {
      return res
        .status(403)
        .json({ error: "Debe acceder con la cuenta del estudiante" });
    }

    const query = `
      SELECT p.id_profesor, p.nombre, p.apellido
      FROM inscripcion i
      JOIN curso_materia cm ON i.id_curso = cm.id_curso
      JOIN profesor p ON cm.id_profesor = p.id_profesor
      WHERE i.id_estudiante = $1 AND i.estado = 'inscrito'
      UNION
      SELECT p.id_profesor, p.nombre, p.apellido
      FROM inscripcion i
      JOIN curso c ON i.id_curso = c.id_curso
      JOIN profesor p ON c.id_profesor = p.id_profesor
      WHERE i.id_estudiante = $1 AND i.estado = 'inscrito'
      ORDER BY apellido, nombre
    `;
    const { rows } = await pool.query(query, [idEstudiante]);
    res.json({ profesores: rows });
  } catch (error) {
    next(error);
  }
};

// --------------------  ESTUDIANTE: TUTORES DEL ESTUDIANTE  --------------------
// Tutores vinculados al estudiante logueado (para elegir quién solicita la cita).
const listarMisTutores = async (req, res, next) => {
  try {
    const idEstudiante = req.usuario.id_estudiante;
    if (!idEstudiante) {
      return res
        .status(403)
        .json({ error: "Debe acceder con la cuenta del estudiante" });
    }

    const query = `
      SELECT t.id_tutor, t.nombre, t.apellido, te.parentesco
      FROM tutor_estudiante te
      JOIN tutor t ON te.id_tutor = t.id_tutor
      WHERE te.id_estudiante = $1
      ORDER BY t.apellido, t.nombre
    `;
    const { rows } = await pool.query(query, [idEstudiante]);
    res.json({ tutores: rows });
  } catch (error) {
    next(error);
  }
};

// --------------------  PROFESOR: MIS HORARIOS DE ATENCIÓN  --------------------
const listarMisHorarios = async (req, res, next) => {
  try {
    if (req.usuario.nombre_rol !== "Profesor") {
      return res
        .status(403)
        .json({ error: "Solo profesores pueden ver sus horarios" });
    }
    const idProfesor = await obtenerIdProfesor(req.usuario.id);
    if (!idProfesor) {
      return res
        .status(403)
        .json({ error: "Tu usuario no está vinculado a un profesor" });
    }
    const query = `
      SELECT ha.id_horario_atencion, ha.dia_semana, ha.hora_inicio, ha.hora_fin,
             ha.modalidad, ha.enlace_videollamada, ha.estado,
             EXISTS (
               SELECT 1 FROM cita c
               WHERE c.id_horario_atencion = ha.id_horario_atencion
                 AND c.estado IN ('pendiente', 'confirmada')
             ) AS ocupado
      FROM horario_atencion ha
      WHERE ha.id_profesor = $1
      ORDER BY
        CASE ha.dia_semana
          WHEN 'lunes' THEN 1 WHEN 'martes' THEN 2 WHEN 'miercoles' THEN 3
          WHEN 'jueves' THEN 4 WHEN 'viernes' THEN 5 WHEN 'sabado' THEN 6
        END, ha.hora_inicio
    `;
    const { rows } = await pool.query(query, [idProfesor]);
    res.json({ horarios: rows });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registrarHorarioAtencion,
  listarHorariosDisponibles,
  solicitarCita,
  confirmarCita,
  proponerAlternativa,
  aceptarAlternativa,
  cancelarCita,
  listarCitas,
  listarMisProfesores,
  listarMisTutores,
  listarMisHorarios,
};

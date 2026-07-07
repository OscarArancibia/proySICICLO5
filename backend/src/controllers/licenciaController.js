// src/controllers/licenciaController.js
const pool = require("../config/db");
const { enviarNotificacion } = require("../services/notificacionService");

// =====================================================
// AUXILIARES
// =====================================================
const obtenerIdProfesor = async (idUsuario) => {
  const result = await pool.query(
    "SELECT id_profesor FROM profesor WHERE id_usuario = $1",
    [idUsuario],
  );
  return result.rows[0]?.id_profesor;
};

const obtenerIdDirector = async () => {
  const result = await pool.query(`
    SELECT u.id_usuario FROM usuario u
    JOIN rol r ON u.id_rol = r.id_rol
    WHERE r.nombre_rol = 'Director'
    LIMIT 1
  `);
  return result.rows[0]?.id_usuario;
};

const obtenerEmailProfesor = async (idProfesor) => {
  const result = await pool.query(
    `
    SELECT u.email FROM usuario u
    JOIN profesor p ON u.id_usuario = p.id_usuario
    WHERE p.id_profesor = $1
  `,
    [idProfesor],
  );
  return result.rows[0]?.email;
};

const obtenerEmailDirector = async () => {
  const result = await pool.query(`
    SELECT u.email FROM usuario u
    JOIN rol r ON u.id_rol = r.id_rol
    WHERE r.nombre_rol = 'Director'
    LIMIT 1
  `);
  return result.rows[0]?.email;
};

const verificarSuperposicion = async (
  idProfesor,
  fechaInicio,
  fechaFin,
  idLicenciaExcluir = null,
) => {
  let query = `
    SELECT id_licencia, fecha_inicio, fecha_fin
    FROM licencia_profesor
    WHERE id_profesor = $1
      AND estado IN ('aprobada', 'pendiente')
      AND NOT (fecha_fin < $2 OR fecha_inicio > $3)
  `;
  const params = [idProfesor, fechaInicio, fechaFin];

  if (idLicenciaExcluir) {
    query += ` AND id_licencia != $4`;
    params.push(idLicenciaExcluir);
  }

  const result = await pool.query(query, params);
  return result.rows;
};

// =====================================================
// 1. PROFESOR: Solicitar licencia
// =====================================================
const solicitarLicencia = async (req, res, next) => {
  try {
    const { tipo_licencia, fecha_inicio, fecha_fin, motivo, documento_url } =
      req.body;
    const idProfesor = await obtenerIdProfesor(req.usuario.id);

    if (!idProfesor) {
      return res.status(404).json({ error: "Profesor no encontrado" });
    }

    // Validar campos obligatorios
    if (!tipo_licencia || !fecha_inicio || !fecha_fin || !motivo) {
      return res.status(400).json({ error: "Faltan campos obligatorios (E1)" });
    }

    // Validar fechas
    if (new Date(fecha_inicio) > new Date(fecha_fin)) {
      return res.status(400).json({
        error: "La fecha de inicio debe ser anterior a la fecha de fin",
      });
    }

    // E1: Verificar superposición con licencias ya aprobadas
    const superposiciones = await verificarSuperposicion(
      idProfesor,
      fecha_inicio,
      fecha_fin,
    );
    if (superposiciones.length > 0) {
      return res.status(409).json({
        error:
          "El período seleccionado se superpone con una licencia ya aprobada o pendiente (E1)",
        superposiciones: superposiciones.map((s) => ({
          id_licencia: s.id_licencia,
          fecha_inicio: s.fecha_inicio,
          fecha_fin: s.fecha_fin,
        })),
      });
    }

    // E2: Si es licencia médica y no hay documento, marcar como pendiente_doc
    let estado = "pendiente";
    if (tipo_licencia === "medica" && !documento_url) {
      estado = "pendiente_doc";
    }

    // Insertar solicitud
    const insertQuery = `
      INSERT INTO licencia_profesor (
        id_profesor, tipo_licencia, fecha_inicio, fecha_fin, motivo,
        documento_url, estado, fecha_solicitud
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id_licencia
    `;
    const result = await pool.query(insertQuery, [
      idProfesor,
      tipo_licencia,
      fecha_inicio,
      fecha_fin,
      motivo,
      documento_url || null,
      estado,
    ]);

    const idLicencia = result.rows[0].id_licencia;

    // Notificar al Director
    const emailDirector = await obtenerEmailDirector();
    if (emailDirector) {
      const profesor = await pool.query(
        "SELECT nombre, apellido FROM profesor WHERE id_profesor = $1",
        [idProfesor],
      );
      const nombreProfesor =
        profesor.rows[0]?.nombre + " " + profesor.rows[0]?.apellido;

      await enviarNotificacion(
        emailDirector,
        "Nueva solicitud de licencia",
        `El profesor ${nombreProfesor} ha solicitado una licencia de tipo "${tipo_licencia}" del ${fecha_inicio} al ${fecha_fin}. Motivo: ${motivo}`,
        "email",
      );
    }

    // Bitácora
    await pool.query(
      `
      INSERT INTO bitacora (id_usuario, accion, tabla_afectada, descripcion)
      VALUES ($1, 'INSERT', 'licencia_profesor', 'Solicitud de licencia ID ${idLicencia}')
    `,
      [req.usuario.id],
    );

    res.status(201).json({
      mensaje:
        estado === "pendiente_doc"
          ? "Solicitud registrada como pendiente de documentación. Debe adjuntar el certificado médico para su aprobación (E2)."
          : "Solicitud registrada correctamente. El Director será notificado.",
      id_licencia: idLicencia,
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// 2. DIRECTOR/SECRETARIA: Listar solicitudes
// =====================================================
const listarSolicitudes = async (req, res, next) => {
  try {
    const { estado, id_profesor, fecha_desde, fecha_hasta } = req.query;

    let query = `
      SELECT l.id_licencia, l.tipo_licencia, l.fecha_inicio, l.fecha_fin,
             l.fecha_fin_real, l.motivo, l.documento_url, l.estado,
             l.comentario_director, l.fecha_solicitud, l.fecha_aprobacion,
             l.observaciones_aprobador,
             p.id_profesor, p.nombre, p.apellido, p.ci,
             u.username AS aprobador_username
      FROM licencia_profesor l
      JOIN profesor p ON l.id_profesor = p.id_profesor
      LEFT JOIN usuario u ON l.id_usuario_aprobador = u.id_usuario
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (estado) {
      query += ` AND l.estado = $${idx}`;
      params.push(estado);
      idx++;
    }
    if (id_profesor) {
      query += ` AND l.id_profesor = $${idx}`;
      params.push(id_profesor);
      idx++;
    }
    if (fecha_desde && fecha_desde !== "undefined") {
      query += ` AND l.fecha_inicio >= $${idx}`;
      params.push(fecha_desde);
      idx++;
    }
    if (fecha_hasta && fecha_hasta !== "undefined") {
      query += ` AND l.fecha_fin <= $${idx}`;
      params.push(fecha_hasta);
      idx++;
    }

    query += ` ORDER BY l.fecha_solicitud DESC`;

    const { rows } = await pool.query(query, params);
    res.json({ solicitudes: rows });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// 3. DIRECTOR: Aprobar licencia
// =====================================================
const aprobarLicencia = async (req, res, next) => {
  try {
    const { idLicencia } = req.params;
    const { comentario } = req.body;
    const idUsuario = req.usuario.id;

    // Verificar que la licencia existe y está pendiente
    const licenciaResult = await pool.query(
      `
      SELECT l.id_licencia, l.id_profesor, l.fecha_inicio, l.fecha_fin,
             l.tipo_licencia, p.nombre, p.apellido, p.id_usuario
      FROM licencia_profesor l
      JOIN profesor p ON l.id_profesor = p.id_profesor
      WHERE l.id_licencia = $1
        AND l.estado IN ('pendiente', 'pendiente_doc')
    `,
      [idLicencia],
    );

    if (licenciaResult.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Solicitud no encontrada o ya procesada" });
    }

    const licencia = licenciaResult.rows[0];

    // Verificar que no haya superposición (por si acaso)
    const superposiciones = await verificarSuperposicion(
      licencia.id_profesor,
      licencia.fecha_inicio,
      licencia.fecha_fin,
      idLicencia,
    );
    if (superposiciones.length > 0) {
      return res.status(409).json({
        error:
          "No se puede aprobar: el período se superpone con otra licencia aprobada (E1)",
        superposiciones,
      });
    }

    // Aprobar licencia
    await pool.query(
      `
      UPDATE licencia_profesor
      SET estado = 'aprobada',
          id_usuario_aprobador = $1,
          fecha_aprobacion = NOW(),
          comentario_director = $2
      WHERE id_licencia = $3
    `,
      [idUsuario, comentario || null, idLicencia],
    );

    // Notificar al profesor
    const emailProfesor = await obtenerEmailProfesor(licencia.id_profesor);
    if (emailProfesor) {
      await enviarNotificacion(
        emailProfesor,
        "Licencia aprobada",
        `Su solicitud de licencia "${licencia.tipo_licencia}" del ${licencia.fecha_inicio} al ${licencia.fecha_fin} ha sido APROBADA.${comentario ? ` Comentario: ${comentario}` : ""}`,
        "email",
      );
    }

    // Bitácora
    await pool.query(
      `
      INSERT INTO bitacora (id_usuario, accion, tabla_afectada, descripcion)
      VALUES ($1, 'UPDATE', 'licencia_profesor', 'Aprobó licencia ID ${idLicencia}')
    `,
      [idUsuario],
    );

    res.json({ mensaje: "Licencia aprobada correctamente" });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// 4. DIRECTOR: Rechazar licencia
// =====================================================
const rechazarLicencia = async (req, res, next) => {
  try {
    const { idLicencia } = req.params;
    const { comentario } = req.body;
    const idUsuario = req.usuario.id;

    if (!comentario) {
      return res
        .status(400)
        .json({ error: "Debe proporcionar un motivo de rechazo" });
    }

    // Verificar que la licencia existe y está pendiente
    const licenciaResult = await pool.query(
      `
      SELECT l.id_licencia, l.id_profesor, l.fecha_inicio, l.fecha_fin,
             l.tipo_licencia, p.nombre, p.apellido
      FROM licencia_profesor l
      JOIN profesor p ON l.id_profesor = p.id_profesor
      WHERE l.id_licencia = $1
        AND l.estado IN ('pendiente', 'pendiente_doc')
    `,
      [idLicencia],
    );

    if (licenciaResult.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Solicitud no encontrada o ya procesada" });
    }

    const licencia = licenciaResult.rows[0];

    // Rechazar licencia
    await pool.query(
      `
      UPDATE licencia_profesor
      SET estado = 'rechazada',
          id_usuario_aprobador = $1,
          fecha_aprobacion = NOW(),
          comentario_director = $2
      WHERE id_licencia = $3
    `,
      [idUsuario, comentario, idLicencia],
    );

    // Notificar al profesor
    const emailProfesor = await obtenerEmailProfesor(licencia.id_profesor);
    if (emailProfesor) {
      await enviarNotificacion(
        emailProfesor,
        "Licencia rechazada",
        `Su solicitud de licencia "${licencia.tipo_licencia}" del ${licencia.fecha_inicio} al ${licencia.fecha_fin} ha sido RECHAZADA. Motivo: ${comentario}`,
        "email",
      );
    }

    // Bitácora
    await pool.query(
      `
      INSERT INTO bitacora (id_usuario, accion, tabla_afectada, descripcion)
      VALUES ($1, 'UPDATE', 'licencia_profesor', 'Rechazó licencia ID ${idLicencia}')
    `,
      [idUsuario],
    );

    res.json({ mensaje: "Licencia rechazada correctamente" });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// 5. DIRECTOR: Registrar retorno anticipado (cierre)
// =====================================================
const registrarRetorno = async (req, res, next) => {
  try {
    const { idLicencia } = req.params;
    const { fecha_retorno } = req.body;
    const idUsuario = req.usuario.id;

    if (!fecha_retorno) {
      return res
        .status(400)
        .json({ error: "Debe proporcionar la fecha de retorno" });
    }

    // Verificar que la licencia está aprobada y no cerrada
    const licenciaResult = await pool.query(
      `
      SELECT id_licencia, id_profesor, fecha_inicio, fecha_fin
      FROM licencia_profesor
      WHERE id_licencia = $1 AND estado = 'aprobada'
    `,
      [idLicencia],
    );

    if (licenciaResult.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Licencia no encontrada o no está aprobada" });
    }

    const licencia = licenciaResult.rows[0];

    // Cerrar licencia con retorno anticipado
    await pool.query(
      `
      UPDATE licencia_profesor
      SET estado = 'cerrada',
          fecha_fin_real = $1,
          actualizado_en = NOW()
      WHERE id_licencia = $2
    `,
      [fecha_retorno, idLicencia],
    );

    // Notificar al profesor
    const emailProfesor = await obtenerEmailProfesor(licencia.id_profesor);
    if (emailProfesor) {
      await enviarNotificacion(
        emailProfesor,
        "Retorno anticipado registrado",
        `Se ha registrado su retorno anticipado a partir del ${fecha_retorno}. Su estado ha sido actualizado a "activo".`,
        "email",
      );
    }

    // Bitácora
    await pool.query(
      `
      INSERT INTO bitacora (id_usuario, accion, tabla_afectada, descripcion)
      VALUES ($1, 'UPDATE', 'licencia_profesor', 'Retorno anticipado para licencia ID ${idLicencia}')
    `,
      [idUsuario],
    );

    res.json({ mensaje: "Retorno anticipado registrado correctamente" });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// 6. PROFESOR: Registrar extensión de licencia (E3)
// =====================================================
const solicitarExtension = async (req, res, next) => {
  try {
    const { idLicencia } = req.params;
    const { fecha_nuevo_fin, motivo_extension } = req.body;
    const idProfesor = await obtenerIdProfesor(req.usuario.id);

    if (!idProfesor) {
      return res.status(404).json({ error: "Profesor no encontrado" });
    }

    if (!fecha_nuevo_fin || !motivo_extension) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    // Verificar que la licencia existe, está aprobada y no cerrada
    const licenciaResult = await pool.query(
      `
      SELECT id_licencia, fecha_inicio, fecha_fin
      FROM licencia_profesor
      WHERE id_licencia = $1
        AND id_profesor = $2
        AND estado = 'aprobada'
    `,
      [idLicencia, idProfesor],
    );

    if (licenciaResult.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Licencia no encontrada o no está aprobada" });
    }

    const licencia = licenciaResult.rows[0];

    if (new Date(fecha_nuevo_fin) <= new Date(licencia.fecha_fin)) {
      return res.status(400).json({
        error: "La nueva fecha debe ser posterior a la fecha de fin actual",
      });
    }

    // Verificar superposición con otras licencias
    const superposiciones = await verificarSuperposicion(
      idProfesor,
      licencia.fecha_inicio,
      fecha_nuevo_fin,
      idLicencia,
    );
    if (superposiciones.length > 0) {
      return res.status(409).json({
        error: "La extensión se superpone con otra licencia aprobada (E1)",
        superposiciones,
      });
    }

    // Crear nueva solicitud de extensión: cubre SOLO los días adicionales
    // (desde el día siguiente al fin de la licencia original), para que no se
    // superponga con la licencia que está extendiendo y pueda aprobarse.
    const insertQuery = `
      INSERT INTO licencia_profesor (
        id_profesor, tipo_licencia, fecha_inicio, fecha_fin, motivo,
        estado, fecha_solicitud
      ) VALUES (
        $1, $2,
        (SELECT fecha_fin + 1 FROM licencia_profesor WHERE id_licencia = $3),
        $4, $5, 'pendiente', NOW()
      )
      RETURNING id_licencia
    `;
    const result = await pool.query(insertQuery, [
      idProfesor,
      "extension",
      idLicencia,
      fecha_nuevo_fin,
      `Extensión de licencia ID ${idLicencia}. Motivo: ${motivo_extension}`,
    ]);

    const nuevaLicenciaId = result.rows[0].id_licencia;

    // Notificar al Director
    const emailDirector = await obtenerEmailDirector();
    if (emailDirector) {
      const profesor = await pool.query(
        "SELECT nombre, apellido FROM profesor WHERE id_profesor = $1",
        [idProfesor],
      );
      await enviarNotificacion(
        emailDirector,
        "Solicitud de extensión de licencia",
        `El profesor ${profesor.rows[0].nombre} ${profesor.rows[0].apellido} solicita extender su licencia hasta el ${fecha_nuevo_fin}. Motivo: ${motivo_extension}`,
        "email",
      );
    }

    // Bitácora
    await pool.query(
      `
      INSERT INTO bitacora (id_usuario, accion, tabla_afectada, descripcion)
      VALUES ($1, 'INSERT', 'licencia_profesor', 'Solicitud de extensión para licencia ID ${idLicencia}')
    `,
      [req.usuario.id],
    );

    res.status(201).json({
      mensaje:
        "Solicitud de extensión registrada. El Director será notificado (E3).",
      id_licencia: nuevaLicenciaId,
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// 7. SECRETARIA: Registrar licencia en nombre del profesor (E5)
// =====================================================
const registrarLicenciaPorSecretaria = async (req, res, next) => {
  try {
    const {
      id_profesor,
      tipo_licencia,
      fecha_inicio,
      fecha_fin,
      motivo,
      documento_url,
    } = req.body;
    const idUsuario = req.usuario.id;

    if (
      !id_profesor ||
      !tipo_licencia ||
      !fecha_inicio ||
      !fecha_fin ||
      !motivo
    ) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    // Verificar que el profesor existe
    const profesorResult = await pool.query(
      "SELECT nombre, apellido FROM profesor WHERE id_profesor = $1",
      [id_profesor],
    );
    if (profesorResult.rows.length === 0) {
      return res.status(404).json({ error: "Profesor no encontrado" });
    }

    // Verificar superposición
    const superposiciones = await verificarSuperposicion(
      id_profesor,
      fecha_inicio,
      fecha_fin,
    );
    if (superposiciones.length > 0) {
      return res.status(409).json({
        error: "El período se superpone con una licencia ya aprobada (E1)",
        superposiciones,
      });
    }

    // Registrar solicitud (marcada como registrada por secretaría)
    const insertQuery = `
      INSERT INTO licencia_profesor (
        id_profesor, tipo_licencia, fecha_inicio, fecha_fin, motivo,
        documento_url, estado, fecha_solicitud, comentario_director
      ) VALUES ($1, $2, $3, $4, $5, $6, 'pendiente', NOW(), $7)
      RETURNING id_licencia
    `;
    const result = await pool.query(insertQuery, [
      id_profesor,
      tipo_licencia,
      fecha_inicio,
      fecha_fin,
      motivo,
      documento_url || null,
      "Registrado por secretaría en nombre del profesor (E5)",
    ]);

    const idLicencia = result.rows[0].id_licencia;

    // Notificar al Director
    const emailDirector = await obtenerEmailDirector();
    if (emailDirector) {
      await enviarNotificacion(
        emailDirector,
        "Solicitud de licencia registrada por secretaría (E5)",
        `La secretaría ha registrado una solicitud de licencia para el profesor ${profesorResult.rows[0].nombre} ${profesorResult.rows[0].apellido} del ${fecha_inicio} al ${fecha_fin}. Motivo: ${motivo}`,
        "email",
      );
    }

    // Bitácora
    await pool.query(
      `
      INSERT INTO bitacora (id_usuario, accion, tabla_afectada, descripcion)
      VALUES ($1, 'INSERT', 'licencia_profesor', 'Licencia registrada por secretaría para profesor ID ${id_profesor}')
    `,
      [idUsuario],
    );

    res.status(201).json({
      mensaje:
        "Licencia registrada correctamente. El Director será notificado para su aprobación (E5).",
      id_licencia: idLicencia,
    });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// 8. DIRECTOR: Obtener profesores con licencia (para reemplazos)
// =====================================================
const obtenerProfesoresConLicencia = async (req, res, next) => {
  try {
    const query = `
      SELECT l.id_licencia, l.fecha_inicio, l.fecha_fin,
             p.id_profesor, p.nombre, p.apellido, p.ci,
             ARRAY_AGG(DISTINCT cm.id_curso_materia) AS materias_afectadas
      FROM licencia_profesor l
      JOIN profesor p ON l.id_profesor = p.id_profesor
      LEFT JOIN curso_materia cm ON p.id_profesor = cm.id_profesor
      WHERE l.estado = 'aprobada'
        AND l.fecha_fin >= CURRENT_DATE
      GROUP BY l.id_licencia, p.id_profesor, p.nombre, p.apellido, p.ci
    `;
    const { rows } = await pool.query(query);
    res.json({ profesores_con_licencia: rows });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// 9. PROFESOR: Listar mis licencias (historial propio)
// =====================================================
const listarMisLicencias = async (req, res, next) => {
  try {
    const idProfesor = await obtenerIdProfesor(req.usuario.id);
    if (!idProfesor) {
      return res.status(404).json({ error: "Profesor no encontrado" });
    }

    const { rows } = await pool.query(
      `
      SELECT l.id_licencia, l.tipo_licencia, l.fecha_inicio, l.fecha_fin,
             l.fecha_fin_real, l.motivo, l.documento_url, l.estado,
             l.comentario_director, l.fecha_solicitud, l.fecha_aprobacion,
             l.observaciones_aprobador,
             p.id_profesor, p.nombre, p.apellido, p.ci,
             u.username AS aprobador_username
      FROM licencia_profesor l
      JOIN profesor p ON l.id_profesor = p.id_profesor
      LEFT JOIN usuario u ON l.id_usuario_aprobador = u.id_usuario
      WHERE l.id_profesor = $1
      ORDER BY l.fecha_solicitud DESC
    `,
      [idProfesor],
    );

    res.json({ solicitudes: rows });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  solicitarLicencia,
  listarSolicitudes,
  aprobarLicencia,
  rechazarLicencia,
  registrarRetorno,
  solicitarExtension,
  registrarLicenciaPorSecretaria,
  obtenerProfesoresConLicencia,
  listarMisLicencias,
};

const pool = require("../config/db");
const { registrarBitacora, getClientIp } = require("../utils/bitacora");

const obtenerDimensiones = async (_req, res) => {
  try {
    const gestion = await pool.query(
      "SELECT id_gestion, anio FROM gestion_academica WHERE estado = 'activa' LIMIT 1",
    );

    if (gestion.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No hay gestion academica activa" });
    }

    const result = await pool.query(
      `
            SELECT id_dimension_eval, nombre_dimension, puntaje_maximo, id_gestion
            FROM dimension_evaluacion
            WHERE id_gestion = $1
            ORDER BY
                CASE nombre_dimension
                    WHEN 'Ser' THEN 1
                    WHEN 'Saber' THEN 2
                    WHEN 'Hacer' THEN 3
                    WHEN 'Autoevaluacion' THEN 4
                    ELSE 5
                END
        `,
      [gestion.rows[0].id_gestion],
    );

    res.json({
      gestion: gestion.rows[0],
      dimensiones: result.rows,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error al obtener dimensiones", error: error.message });
  }
};

const guardarDimensiones = async (req, res) => {
  const { dimensiones } = req.body;

  if (!Array.isArray(dimensiones) || dimensiones.length === 0) {
    return res
      .status(400)
      .json({ message: "Debe enviar al menos una dimension" });
  }

  const nombresValidos = ["Ser", "Saber", "Hacer", "Autoevaluacion"];
  for (const d of dimensiones) {
    if (!nombresValidos.includes(d.nombre_dimension)) {
      return res.status(400).json({
        message: `Dimension invalida: "${d.nombre_dimension}". Debe ser: Ser, Saber, Hacer o Autoevaluacion`,
      });
    }
    if (
      d.puntaje_maximo === undefined ||
      d.puntaje_maximo === null ||
      Number(d.puntaje_maximo) <= 0
    ) {
      return res.status(400).json({
        message: `El puntaje maximo de "${d.nombre_dimension}" debe ser un valor positivo`,
      });
    }
  }

  const sumaTotal = dimensiones.reduce(
    (sum, d) => sum + Number(d.puntaje_maximo),
    0,
  );
  if (sumaTotal !== 100) {
    return res.status(400).json({
      message: `La suma de las dimensiones debe ser exactamente 100. Suma actual: ${sumaTotal}`,
    });
  }

  const client = await pool.connect();

  try {
    const gestion = await client.query(
      "SELECT id_gestion FROM gestion_academica WHERE estado = 'activa' LIMIT 1",
    );

    if (gestion.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No hay gestion academica activa" });
    }

    const id_gestion = gestion.rows[0].id_gestion;

    const calificacionesCheck = await client.query(
      `
            SELECT EXISTS (
                SELECT 1 FROM calificacion c
                JOIN actividad_evaluacion ae ON ae.id_actividad = c.id_actividad
                JOIN dimension_evaluacion de ON de.id_dimension_eval = ae.id_dimension_eval
                WHERE de.id_gestion = $1
                LIMIT 1
            ) AS tiene_notas
        `,
      [id_gestion],
    );

    if (calificacionesCheck.rows[0].tiene_notas) {
      return res.status(409).json({
        message:
          "No se pueden modificar los puntajes maximos porque ya existen calificaciones registradas para esta gestion",
      });
    }

    const nombresEnviados = dimensiones.map((d) => d.nombre_dimension);
    const nombresUnicos = new Set(nombresEnviados);
    if (nombresUnicos.size !== dimensiones.length) {
      return res
        .status(400)
        .json({ message: "No puede haber dimensiones duplicadas" });
    }

    await client.query("BEGIN");

    const resultados = [];
    for (const d of dimensiones) {
      const saved = await client.query(
        `
                INSERT INTO dimension_evaluacion (nombre_dimension, puntaje_maximo, id_gestion)
                VALUES ($1, $2, $3)
                ON CONFLICT (nombre_dimension, id_gestion)
                DO UPDATE SET puntaje_maximo = EXCLUDED.puntaje_maximo
                RETURNING *
            `,
        [d.nombre_dimension, Number(d.puntaje_maximo), id_gestion],
      );

      resultados.push(saved.rows[0]);
    }

    await client.query("COMMIT");

    await registrarBitacora({
      id_usuario: req.usuario.id,
      nombre_modulo: "dimensiones",
      nombre_permiso: "gestionar_dimensiones",
      metodo: "POST /api/dimensiones",
      accion: "CONFIGURAR_DIMENSIONES",
      tabla_afectada: "dimension_evaluacion",
      id_registro_afectado: id_gestion,
      descripcion: `Dimensiones configuradas para gestión ${id_gestion}: ${dimensiones.map((d) => `${d.nombre_dimension}(${d.puntaje_maximo})`).join(", ")}`,
      ip_origen: getClientIp(req),
    });
    res.json({
      message: "Dimensiones guardadas correctamente",
      dimensiones: resultados,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ message: "Ya existe esta dimension para la gestion activa" });
    }
    res
      .status(500)
      .json({ message: "Error al guardar dimensiones", error: error.message });
  } finally {
    client.release();
  }
};

const actualizarDimension = async (req, res) => {
  const { id } = req.params;
  const { puntaje_maximo } = req.body;

  if (
    puntaje_maximo === undefined ||
    puntaje_maximo === null ||
    Number(puntaje_maximo) <= 0
  ) {
    return res
      .status(400)
      .json({ message: "El puntaje maximo debe ser un valor positivo" });
  }

  const client = await pool.connect();

  try {
    const dim = await client.query(
      "SELECT id_dimension_eval, id_gestion FROM dimension_evaluacion WHERE id_dimension_eval = $1",
      [id],
    );

    if (dim.rows.length === 0) {
      return res.status(404).json({ message: "Dimension no encontrada" });
    }

    const calificacionesCheck = await client.query(
      `
            SELECT EXISTS (
                SELECT 1 FROM calificacion c
                JOIN actividad_evaluacion ae ON ae.id_actividad = c.id_actividad
                WHERE ae.id_dimension_eval = $1
                LIMIT 1
            ) AS tiene_notas
        `,
      [id],
    );

    if (calificacionesCheck.rows[0].tiene_notas) {
      return res.status(409).json({
        message:
          "No se puede modificar esta dimension porque ya existen calificaciones registradas",
      });
    }

    await client.query("BEGIN");

    const otrasSum = await client.query(
      `
            SELECT COALESCE(SUM(puntaje_maximo), 0) AS suma
            FROM dimension_evaluacion
            WHERE id_gestion = $1 AND id_dimension_eval != $2
        `,
      [dim.rows[0].id_gestion, id],
    );

    const nuevaSuma = Number(otrasSum.rows[0].suma) + Number(puntaje_maximo);
    if (nuevaSuma !== 100) {
      return res.status(400).json({
        message: `La suma total de las dimensiones debe ser 100. Con este cambio, la suma seria ${nuevaSuma}`,
      });
    }

    const result = await client.query(
      `
            UPDATE dimension_evaluacion
            SET puntaje_maximo = $1
            WHERE id_dimension_eval = $2
            RETURNING *
        `,
      [Number(puntaje_maximo), id],
    );

    await client.query("COMMIT");

    await registrarBitacora({
      id_usuario: req.usuario.id,
      nombre_modulo: "dimensiones",
      nombre_permiso: "gestionar_dimensiones",
      metodo: `PUT /api/dimensiones/${id}`,
      accion: "ACTUALIZAR_DIMENSION",
      tabla_afectada: "dimension_evaluacion",
      id_registro_afectado: Number(id),
      descripcion: `Dimensión ${result.rows[0].nombre_dimension} actualizada: puntaje_maximo = ${puntaje_maximo}`,
      ip_origen: getClientIp(req),
    });
    res.json({
      message: "Dimension actualizada correctamente",
      dimension: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    res
      .status(500)
      .json({ message: "Error al actualizar dimension", error: error.message });
  } finally {
    client.release();
  }
};
module.exports = {
  obtenerDimensiones,
  guardarDimensiones,
  actualizarDimension,
};

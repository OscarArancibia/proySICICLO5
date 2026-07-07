const pool = require('../config/db');
const { registrarBitacora, getClientIp } = require('../utils/bitacora');

const estadoMap = {
    presente: 'P',
    ausente: 'A',
    tardanza: 'T',
    justificado: 'J',
    licencia: 'L',
};

const estadoTexto = {
    P: 'presente',
    A: 'ausente',
    T: 'tardanza',
    J: 'justificado',
    L: 'licencia',
};

const normalizarEstado = (estado) => {
    if (!estado) return null;
    const value = String(estado).trim();
    return estadoMap[value.toLowerCase()] || value.toUpperCase();
};

const getCursosAsistencia = async (_req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                c.id_curso,
                g.nombre_grado,
                n.nombre_nivel,
                c.paralelo,
                c.turno,
                ga.anio,
                COUNT(i.id_estudiante)::int AS total_estudiantes
            FROM curso c
            JOIN grado g ON g.id_grado = c.id_grado
            JOIN nivel n ON n.id_nivel = g.id_nivel
            JOIN gestion_academica ga ON ga.id_gestion = c.id_gestion
            LEFT JOIN inscripcion i ON i.id_curso = c.id_curso AND i.estado = 'inscrito'
            WHERE ga.estado = 'activa'
            GROUP BY c.id_curso, g.nombre_grado, n.id_nivel, n.nombre_nivel, c.paralelo, c.turno, ga.anio
            ORDER BY n.id_nivel, g.nombre_grado, c.paralelo
        `);

        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener cursos para asistencia', error: error.message });
    }
};

const getAsistenciaCurso = async (req, res) => {
    const { id_curso } = req.params;
    const { fecha = new Date().toISOString().slice(0, 10) } = req.query;

    try {
        const estudiantes = await pool.query(`
            SELECT
                e.id_estudiante,
                e.nombre,
                e.apellido,
                e.ci,
                a.id_asistencia,
                a.estado,
                a.observaciones
            FROM inscripcion i
            JOIN estudiante e ON e.id_estudiante = i.id_estudiante
            LEFT JOIN asistencia a
              ON a.id_estudiante = e.id_estudiante
             AND a.id_curso = i.id_curso
             AND a.fecha = $2::date
            WHERE i.id_curso = $1
              AND i.estado = 'inscrito'
              AND e.estado = 'activo'
            ORDER BY e.apellido, e.nombre
        `, [id_curso, fecha]);

        const resumen = estudiantes.rows.reduce((acc, row) => {
            const estado = row.estado || 'pendiente';
            acc[estado] = (acc[estado] || 0) + 1;
            return acc;
        }, {});

        res.json({
            fecha,
            id_curso: Number(id_curso),
            resumen,
            estudiantes: estudiantes.rows.map(row => ({
                ...row,
                estado_texto: row.estado ? estadoTexto[row.estado] : null
            }))
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener asistencia', error: error.message });
    }
};

const registrarAsistencia = async (req, res) => {
    const { id_curso } = req.params;
    const { fecha, asistencias } = req.body;

    if (!fecha || !Array.isArray(asistencias)) {
        return res.status(400).json({ message: 'La fecha y la lista de asistencias son obligatorias' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const resultado = [];
        for (const item of asistencias) {
            const estado = normalizarEstado(item.estado);
            if (!item.id_estudiante || !['P', 'A', 'T', 'J', 'L'].includes(estado)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Cada asistencia debe incluir estudiante y estado valido' });
            }

            const saved = await client.query(`
                INSERT INTO asistencia (
                    id_estudiante, id_curso, fecha, estado,
                    observaciones, id_usuario_registro
                )
                VALUES ($1, $2, $3::date, $4, $5, $6)
                ON CONFLICT (id_estudiante, id_curso, fecha)
                DO UPDATE SET
                    estado = EXCLUDED.estado,
                    observaciones = EXCLUDED.observaciones,
                    id_usuario_registro = EXCLUDED.id_usuario_registro,
                    fecha_registro = NOW()
                RETURNING *
            `, [
                item.id_estudiante,
                id_curso,
                fecha,
                estado,
                item.observaciones || null,
                req.usuario.id
            ]);

            resultado.push(saved.rows[0]);
        }

        await client.query('COMMIT');

        await registrarBitacora({
            id_usuario: req.usuario.id,
            nombre_modulo: 'asistencias',
            nombre_permiso: 'registrar_asistencia',
            metodo: 'POST /api/asistencias/curso/:id_curso',
            accion: 'REGISTRAR_ASISTENCIA',
            tabla_afectada: 'asistencia',
            id_registro_afectado: Number(id_curso),
            descripcion: `Registro de asistencia del curso ${id_curso} para ${fecha}`,
            ip_origen: getClientIp(req)
        });

        res.json({ message: 'Asistencia guardada correctamente', asistencias: resultado });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Error al guardar asistencia', error: error.message });
    } finally {
        client.release();
    }
};

module.exports = { getCursosAsistencia, getAsistenciaCurso, registrarAsistencia };

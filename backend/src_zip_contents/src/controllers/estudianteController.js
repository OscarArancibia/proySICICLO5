const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { validatePasswordStrength } = require('../utils/passwordPolicy');

const estadosEstudiante = new Set(['activo', 'inactivo', 'retirado', 'egresado']);

const normalizarEstadoEstudiante = (estado) => {
    if (!estado) return null;
    const normalized = String(estado).trim().toLowerCase();
    if (normalized === 'inactive') return 'inactivo';
    if (normalized === 'active') return 'activo';
    return normalized;
};

// Validar formato de RUDE (15-16 dígitos)
const validarRude = (rude) => {
    if (!rude) return true; // RUDE es opcional
    const cleaned = String(rude).trim().replace(/\D/g, '');
    if (cleaned.length < 15 || cleaned.length > 16) {
        return false;
    }
    return true;
};

// Validar edad mínima (4 años cumplidos hasta el 30 de junio del 2026)
const validarEdadMinima = (fechaNacimiento) => {
    if (!fechaNacimiento) return true;
    const fecha = new Date(fechaNacimiento);
    const fechaLimite = new Date(2022, 5, 30); // 30 de junio de 2022
    return fecha <= fechaLimite;
};

// Calcular si el estudiante es mayor a 18 años (al 30 de junio del 2026)
const esEstudianteMayor = (fechaNacimiento) => {
    if (!fechaNacimiento) return false;
    const fecha = new Date(fechaNacimiento);
    const fechaReferencia = new Date(2026, 5, 30); // 30 de junio de 2026
    const edad = fechaReferencia.getFullYear() - fecha.getFullYear();
    const mes = fechaReferencia.getMonth() - fecha.getMonth();
    
    if (mes < 0 || (mes === 0 && fechaReferencia.getDate() < fecha.getDate())) {
        return edad - 1 >= 18;
    }
    return edad >= 18;
};

const getEstudiantes = async (req, res) => {
    const { search, id_nivel, id_grado, turno, estado, edad_min, edad_max } = req.query;
    try {
        let conditions = [];
        let params = [];
        let idx = 1;

        if (search) {
            conditions.push(`(ci ILIKE $${idx} OR nombre || ' ' || apellido ILIKE $${idx})`);
            params.push(`%${search}%`);
            idx++;
        }
        if (estado) {
            const estadoNormalizado = normalizarEstadoEstudiante(estado);
            if (!estadosEstudiante.has(estadoNormalizado)) {
                return res.status(400).json({ message: 'Estado de estudiante invalido.' });
            }
            conditions.push(`estado = $${idx++}`);
            params.push(estadoNormalizado);
        }
        if (edad_min) {
            conditions.push(`EXTRACT(YEAR FROM AGE(fecha_nacimiento)) >= $${idx++}`);
            params.push(parseInt(edad_min));
        }
        if (edad_max) {
            conditions.push(`EXTRACT(YEAR FROM AGE(fecha_nacimiento)) <= $${idx++}`);
            params.push(parseInt(edad_max));
        }
        // Filtros por nivel/grado/turno requieren JOIN con inscripcion y curso
        let baseQuery;
        if (id_nivel || id_grado || turno) {
            baseQuery = `SELECT DISTINCT e.* FROM estudiante e
                JOIN inscripcion i ON e.id_estudiante = i.id_estudiante AND i.estado = 'inscrito'
                JOIN curso c ON i.id_curso = c.id_curso
                JOIN grado g ON c.id_grado = g.id_grado`;
            if (turno)    { conditions.push(`c.turno = $${idx++}`);    params.push(turno); }
            if (id_grado) { conditions.push(`c.id_grado = $${idx++}`); params.push(id_grado); }
            if (id_nivel) { conditions.push(`g.id_nivel = $${idx++}`); params.push(id_nivel); }
        } else {
            baseQuery = 'SELECT * FROM estudiante e';
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const query = `${baseQuery} ${whereClause} ORDER BY e.apellido ASC, e.nombre ASC`;

        const estudiantes = await pool.query(query, params);
        res.json(estudiantes.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener estudiantes', error: error.message });
    }
};

const createEstudiante = async (req, res) => {
    const { nombre, apellido, ci, rude, fecha_nacimiento, genero, de_traslado, institucion_origen } = req.body;

    if (!nombre || !apellido || !genero) {
        return res.status(400).json({ message: 'El nombre, apellido y género son obligatorios.' });
    }

    // Validar CI (obligatorio)
    if (!ci || String(ci).trim() === '') {
        return res.status(400).json({ message: 'El CI es obligatorio.' });
    }

    // Validar RUDE (obligatorio)
    if (!rude || String(rude).trim() === '') {
        return res.status(400).json({ message: 'El RUDE es obligatorio.' });
    }

    // Validar formato de RUDE (15-16 dígitos)
    const rudeClean = String(rude).trim().replace(/\D/g, '');
    if (rudeClean.length < 15 || rudeClean.length > 16) {
        return res.status(400).json({ message: 'El RUDE debe tener 15 a 16 dígitos válidos.' });
    }

    if (fecha_nacimiento && new Date(fecha_nacimiento) > new Date()) {
        return res.status(400).json({ message: 'La fecha de nacimiento no puede ser una fecha futura.' });
    }

    // Validar edad mínima (4 años cumplidos hasta el 30 de junio de 2026)
    if (fecha_nacimiento && !validarEdadMinima(fecha_nacimiento)) {
        return res.status(400).json({ message: 'El estudiante debe tener 4 años cumplidos hasta el 30 de junio de 2026.' });
    }

    try {
        // Verificar si RUDE ya existe
        if (rude) {
            const rudeCheck = await pool.query('SELECT nombre, apellido FROM estudiante WHERE rude = $1', [rude.trim()]);
            if (rudeCheck.rows.length > 0) {
                const est = rudeCheck.rows[0];
                return res.status(409).json({ message: `Ya existe un estudiante registrado con el RUDE ${rude}: ${est.nombre} ${est.apellido}.` });
            }
        }

        if (ci) {
            const ciCheck = await pool.query('SELECT nombre, apellido FROM estudiante WHERE ci = $1', [ci]);
            if (ciCheck.rows.length > 0) {
                const est = ciCheck.rows[0];
                return res.status(409).json({ message: `Ya existe un estudiante registrado con el CI ${ci}: ${est.nombre} ${est.apellido}.` });
            }
        }

        // Nota de traslado para persistir en campo observaciones
        const notaTraslado = de_traslado
            ? ` | ESTUDIANTE DE TRASLADO. Origen: ${institucion_origen || 'No especificado'}`
            : null;
        
        // Agregar recomendación si es mayor a 18 años
        const notaEdad = esEstudianteMayor(fecha_nacimiento)
            ? ` | ALERTA: Estudiante mayor a 18 años. Se recomienda inscripción a CEMA o CEA.`
            : null;
        
        const observacionesVal = ((req.body.observaciones || '') + (notaTraslado || '') + (notaEdad || '')).trim() || null;

        let nuevoEstudiante;
        try {
            // Intenta con columna RUDE y observaciones
            nuevoEstudiante = await pool.query(
                `INSERT INTO estudiante (nombre, apellido, ci, rude, fecha_nacimiento, genero, estado, observaciones)
                 VALUES ($1, $2, $3, $4, $5, $6, 'activo', $7) RETURNING *`,
                [nombre, apellido, ci || null, rude || null, fecha_nacimiento || null, genero, observacionesVal]
            );
        } catch (colErr) {
            if (colErr.message.includes('rude') || colErr.message.includes('observaciones')) {
                // Columna aún no existe: intentar sin RUDE
                nuevoEstudiante = await pool.query(
                    `INSERT INTO estudiante (nombre, apellido, ci, fecha_nacimiento, genero, estado, observaciones)
                     VALUES ($1, $2, $3, $4, $5, 'activo', $6) RETURNING *`,
                    [nombre, apellido, ci || null, fecha_nacimiento || null, genero, observacionesVal]
                );
            } else {
                throw colErr;
            }
        }

        const response = {
            message: 'Estudiante registrado correctamente',
            estudiante: nuevoEstudiante.rows[0]
        };

        if (notaTraslado) response.nota_traslado = notaTraslado.trim();
        if (notaEdad) response.alerta_edad = notaEdad.trim();

        res.status(201).json(response);
    } catch (error) {
        res.status(500).json({ message: 'Error al crear estudiante', error: error.message });
    }
};

const updateEstudiante = async (req, res) => {
    const { id } = req.params;
    const { nombre, apellido, fecha_nacimiento, genero, estado, motivo_salida } = req.body;

    try {
        const estadoNormalizado = normalizarEstadoEstudiante(estado);
        if (estadoNormalizado && !estadosEstudiante.has(estadoNormalizado)) {
            return res.status(400).json({ message: 'Estado de estudiante invalido.' });
        }

        let observacionesUpdate = "";
        if (estadoNormalizado === 'retirado' || estadoNormalizado === 'egresado') {
            if (!motivo_salida) return res.status(400).json({ message: 'Debe especificar el motivo del cambio de estado.' });
            observacionesUpdate = ` | Motivo ${estadoNormalizado}: ${motivo_salida}`;
        }

        // observaciones no existe en la tabla estudiante (pendiente migración).
        // El motivo de retiro/egreso se conserva en memoria para el log de respuesta.
        let updated;
        try {
            // Intenta persistir observaciones (disponible tras migracion_ciclo2.sql)
            updated = await pool.query(
                `UPDATE estudiante SET 
                    nombre = COALESCE($1, nombre),
                    apellido = COALESCE($2, apellido),
                    fecha_nacimiento = COALESCE($3, fecha_nacimiento),
                    genero = COALESCE($4, genero),
                    estado = COALESCE($5, estado),
                    observaciones = CASE
                        WHEN $6::text IS NOT NULL AND $6::text != ''
                        THEN COALESCE(observaciones, '') || $6::text
                        ELSE observaciones
                    END
                 WHERE id_estudiante = $7 RETURNING *`,
                [nombre, apellido, fecha_nacimiento, genero, estadoNormalizado, observacionesUpdate || null, id]
            );
        } catch (colErr) {
            if (colErr.message.includes('observaciones')) {
                updated = await pool.query(
                    `UPDATE estudiante SET
                        nombre = COALESCE($1, nombre),
                        apellido = COALESCE($2, apellido),
                        fecha_nacimiento = COALESCE($3, fecha_nacimiento),
                        genero = COALESCE($4, genero),
                        estado = COALESCE($5, estado)
                     WHERE id_estudiante = $6 RETURNING *`,
                    [nombre, apellido, fecha_nacimiento, genero, estadoNormalizado, id]
                );
            } else {
                throw colErr;
            }
        }

        if (updated.rows.length === 0) return res.status(404).json({ message: 'Estudiante no encontrado.' });
        res.json({
            message: 'Expediente actualizado',
            estudiante: updated.rows[0],
            // Motivo registrado en backend (persistir en BD requiere migración: ALTER TABLE estudiante ADD COLUMN observaciones TEXT)
            ...(observacionesUpdate && { nota_motivo: observacionesUpdate.trim() })
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar estudiante', error: error.message });
    }
};

const exportarEstudiantesCsv = async (req, res) => {
    // Reutilizar la misma lógica de filtros de getEstudiantes
    const { search, id_nivel, id_grado, turno, estado, edad_min, edad_max } = req.query;
    try {
        let conditions = [];
        let params = [];
        let idx = 1;

        if (search) {
            conditions.push(`(e.ci ILIKE $${idx} OR e.nombre || ' ' || e.apellido ILIKE $${idx})`);
            params.push(`%${search}%`);
            idx++;
        }
        if (estado) {
            const estadoNormalizado = normalizarEstadoEstudiante(estado);
            if (!estadosEstudiante.has(estadoNormalizado)) {
                return res.status(400).json({ message: 'Estado de estudiante invalido.' });
            }
            conditions.push(`e.estado = $${idx++}`);
            params.push(estadoNormalizado);
        }
        if (edad_min) {
            conditions.push(`EXTRACT(YEAR FROM AGE(e.fecha_nacimiento)) >= $${idx++}`);
            params.push(parseInt(edad_min));
        }
        if (edad_max) {
            conditions.push(`EXTRACT(YEAR FROM AGE(e.fecha_nacimiento)) <= $${idx++}`);
            params.push(parseInt(edad_max));
        }
        
        let baseQuery;
        if (id_nivel || id_grado || turno) {
            baseQuery = `SELECT DISTINCT e.*, c.paralelo, g.nombre_grado, n.nombre_nivel FROM estudiante e
                JOIN inscripcion i ON e.id_estudiante = i.id_estudiante AND i.estado = 'inscrito'
                JOIN curso c ON i.id_curso = c.id_curso
                JOIN grado g ON c.id_grado = g.id_grado
                JOIN nivel n ON g.id_nivel = n.id_nivel`;
            if (turno)    { conditions.push(`c.turno = $${idx++}`);    params.push(turno); }
            if (id_grado) { conditions.push(`c.id_grado = $${idx++}`); params.push(id_grado); }
            if (id_nivel) { conditions.push(`g.id_nivel = $${idx++}`); params.push(id_nivel); }
        } else {
            baseQuery = `SELECT e.*, 'N/A' as paralelo, 'N/A' as nombre_grado, 'N/A' as nombre_nivel FROM estudiante e`;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const query = `${baseQuery} ${whereClause} ORDER BY e.apellido ASC, e.nombre ASC`;

        const estudiantes = await pool.query(query, params);

        // Generar CSV
        const csvHeader = ['CI', 'Apellido', 'Nombre', 'Género', 'Estado', 'Nivel', 'Grado', 'Paralelo'].join(',');
        const csvRows = estudiantes.rows.map(e => {
            return [
                e.ci || 'N/A',
                e.apellido,
                e.nombre,
                e.genero,
                e.estado,
                e.nombre_nivel,
                e.nombre_grado,
                e.paralelo
            ].map(col => `"${col}"`).join(',');
        });

        const csvString = [csvHeader, ...csvRows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=estudiantes_export.csv');
        res.status(200).send(csvString);

    } catch (error) {
        res.status(500).json({ message: 'Error al exportar estudiantes', error: error.message });
    }
};

const crearCuentaEstudiante = async (req, res) => {
    const { id } = req.params;
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
        return res.status(400).json({ message: 'Usuario, contraseña y email son obligatorios.' });
    }

    const passVal = validatePasswordStrength(password);
    if (!passVal.isValid) {
        return res.status(400).json({ message: passVal.message });
    }

    try {
        const estResult = await pool.query(
            'SELECT id_estudiante, nombre, apellido, id_usuario FROM estudiante WHERE id_estudiante = $1',
            [id]
        );
        if (estResult.rows.length === 0) {
            return res.status(404).json({ message: 'Estudiante no encontrado.' });
        }
        if (estResult.rows[0].id_usuario) {
            return res.status(409).json({ message: 'El estudiante ya tiene una cuenta de acceso.' });
        }

        const rolResult = await pool.query(
            `SELECT id_rol FROM rol WHERE nombre_rol = 'Estudiante'`
        );
        if (rolResult.rows.length === 0) {
            return res.status(500).json({ message: "Rol 'Estudiante' no encontrado. Ejecuta la migración." });
        }
        const id_rol = rolResult.rows[0].id_rol;

        const dupCheck = await pool.query(
            'SELECT id_usuario FROM usuario WHERE username = $1 OR email = $2',
            [username, email]
        );
        if (dupCheck.rows.length > 0) {
            return res.status(409).json({ message: 'El nombre de usuario o email ya está en uso.' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const userResult = await pool.query(
            `INSERT INTO usuario (username, password_hash, email, id_rol)
             VALUES ($1, $2, $3, $4) RETURNING id_usuario`,
            [username, password_hash, email, id_rol]
        );
        const id_usuario = userResult.rows[0].id_usuario;

        await pool.query(
            'UPDATE estudiante SET id_usuario = $1 WHERE id_estudiante = $2',
            [id_usuario, id]
        );

        const est = estResult.rows[0];
        res.status(201).json({
            message: `Cuenta creada para ${est.nombre} ${est.apellido}.`,
            username,
            email
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al crear cuenta de estudiante', error: error.message });
    }
};

module.exports = { getEstudiantes, createEstudiante, updateEstudiante, exportarEstudiantesCsv, crearCuentaEstudiante };

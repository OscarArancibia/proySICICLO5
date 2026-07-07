const pool = require('../config/db');

const validarRangoFechasGestion = (fecha_inicio, fecha_fin) => {
    const inicio = new Date(`${fecha_inicio}T00:00:00`);
    const fin = new Date(`${fecha_fin}T00:00:00`);

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
        return 'Las fechas ingresadas no son válidas.';
    }

    if (inicio > fin) {
        return 'La fecha de inicio no puede ser posterior a la fecha de cierre.';
    }

    return null;
};

const createGestion = async (req, res) => {
    const { anio, fecha_inicio, fecha_fin } = req.body;

    if (!anio || !fecha_inicio || !fecha_fin) {
        return res.status(400).json({ message: 'Año, fecha de inicio y fecha de fin son obligatorios.' });
    }

    const errorFechas = validarRangoFechasGestion(fecha_inicio, fecha_fin);
    if (errorFechas) {
        return res.status(400).json({ message: errorFechas });
    }

    try {

        const existeAnio = await pool.query('SELECT id_gestion FROM gestion_academica WHERE anio = $1', [anio]);
        if (existeAnio.rows.length > 0) {
            return res.status(400).json({ message: `Ya existe una gestión registrada para el año ${anio}.` });
        }

        const nuevaGestion = await pool.query(
            "INSERT INTO gestion_academica (anio, fecha_inicio, fecha_fin, estado) VALUES ($1, $2, $3, 'planificada') RETURNING *",
            [anio, fecha_inicio, fecha_fin]
        );

        res.status(201).json({ message: 'Gestión creada con éxito', gestion: nuevaGestion.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al crear la gestión', error: error.message });
    }
};

const getGestiones = async (req, res) => {
    try {
        const gestiones = await pool.query('SELECT * FROM gestion_academica ORDER BY anio DESC');
        res.json(gestiones.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener las gestiones', error: error.message });
    }
};

const updateGestion = async (req, res) => {
    const { id } = req.params;
    const { anio, fecha_inicio, fecha_fin, estado } = req.body;

    if (!anio || !fecha_inicio || !fecha_fin || !estado) {
        return res.status(400).json({ message: 'Año, fecha de inicio, fecha de fin y estado son obligatorios.' });
    }

    const errorFechas = validarRangoFechasGestion(fecha_inicio, fecha_fin);
    if (errorFechas) {
        return res.status(400).json({ message: errorFechas });
    }

    try {
        if (estado === 'activa') {
            const activaCheck = await pool.query(
                "SELECT id_gestion, anio FROM gestion_academica WHERE estado = 'activa' AND id_gestion != $1",
                [id]
            );
            if (activaCheck.rows.length > 0) {
                return res.status(400).json({
                    message: `No se puede activar. La gestión ${activaCheck.rows[0].anio} ya se encuentra activa. Ciérrela primero.`
                });
            }
        }

        if (estado === 'cerrada') {
            const libretasPendientes = await pool.query(
                "SELECT id_libreta, id_estudiante, trimestre, estado FROM libreta_emitida WHERE id_gestion = $1 AND estado != 'entregada'",
                [id]
            );

            if (libretasPendientes.rows.length > 0) {
                return res.status(400).json({
                    message: 'No se puede cerrar la gestión. Existen libretas pendientes de entrega.',
                    pendientes_count: libretasPendientes.rows.length,
                    pendientes: libretasPendientes.rows // Enviamos la lista de pendientes al frontend como pediste
                });
            }
        }

        const updatedGestion = await pool.query(
            'UPDATE gestion_academica SET anio = $1, fecha_inicio = $2, fecha_fin = $3, estado = $4 WHERE id_gestion = $5 RETURNING *',
            [anio, fecha_inicio, fecha_fin, estado, id]
        );

        if (updatedGestion.rows.length === 0) return res.status(404).json({ message: 'No se encontró la gestión' });

        res.json({ message: `Gestión actualizada a estado: ${estado}`, gestion: updatedGestion.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar la gestión', error: error.message });
    }
};

module.exports = { createGestion, getGestiones, updateGestion };

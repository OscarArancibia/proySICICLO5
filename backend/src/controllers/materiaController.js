const pool = require('../config/db');

const getCamposSaber = async (req, res) => {
    try {
        const campos = await pool.query('SELECT * FROM campo_saber ORDER BY orden_visualizacion');
        res.json(campos.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener los campos del saber', error: error.message });
    }
}

const createCampo = async (req, res) => {
    const { nombre_campo, orden_visualizacion } = req.body;

    if (!nombre_campo || orden_visualizacion === undefined) {
        return res.status(400).json({ message: 'El nombre del campo y el orden de visualización son obligatorios.' });
    }

    try {
        const campoExistente = await pool.query(
            'SELECT id_campo FROM campo_saber WHERE nombre_campo = $1 OR orden_visualizacion = $2',
            [nombre_campo, orden_visualizacion]
        );

        if (campoExistente.rows.length > 0) {
            return res.status(400).json({ message: 'El nombre del campo o el orden de visualización ya están en uso.' });
        }

        const nuevoCampo = await pool.query(
            'INSERT INTO campo_saber (nombre_campo, orden_visualizacion) VALUES ($1, $2) RETURNING *',
            [nombre_campo, orden_visualizacion]
        );
        res.status(201).json({ message: 'Campo de saber creado correctamente', campo: nuevoCampo.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al crear el campo de saber', error: error.message });
    }
};

const getMaterias = async (req, res) => {
    try {
        const materias = await pool.query(
            `
            SELECT m.id_materia, m.nombre_materia, m.descripcion, c.nombre_campo, m.aplica_primaria, m.estado 
            FROM materia m
            JOIN campo_saber c ON m.id_campo = c.id_campo
            ORDER BY c.orden_visualizacion, m.nombre_materia
        `);
        res.json(materias.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener materias', error: error.message });
    }
}

const createMateria = async (req, res) => {
    const { nombre_materia, descripcion, id_campo, aplica_primaria, estado } = req.body;

    if (!nombre_materia || !id_campo) {
        return res.status(400).json({ message: 'El nombre de la materia y el ID del campo de saber son obligatorios.' });
    }

    try {
        const nuevaMateria = await pool.query(
            'INSERT INTO materia (nombre_materia, descripcion, id_campo, aplica_primaria, estado) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [nombre_materia, descripcion, id_campo, aplica_primaria !== undefined ? aplica_primaria : true, estado !== undefined ? estado : true]
        );

        res.status(201).json({ message: 'Materia creada correctamente', materia: nuevaMateria.rows[0] });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({ message: 'El campo de saber especificado no existe.' });
        }
        res.status(500).json({ message: 'Error al crear la materia', error: error.message });
    }
}

module.exports = { getCamposSaber, createCampo, getMaterias, createMateria };

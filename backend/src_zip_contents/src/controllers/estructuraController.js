const pool = require('../config/db');

const getEstructura = async (_req, res) => {
    try {
        const [niveles, grados, aulas] = await Promise.all([
            pool.query('SELECT * FROM nivel ORDER BY id_nivel'),
            pool.query(`
                SELECT g.id_grado, g.nombre_grado, n.nombre_nivel, g.id_nivel
                FROM grado g
                JOIN nivel n ON g.id_nivel = n.id_nivel
                ORDER BY g.id_nivel, g.id_grado
            `),
            pool.query('SELECT * FROM aula ORDER BY numero_aula')
        ]);

        res.json({
            niveles: niveles.rows,
            grados: grados.rows,
            aulas: aulas.rows
        });
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener la estructura academica', error: error.message });
    }
};

const getAulas = async (req, res) => {
    try {
        const aulas = await pool.query('SELECT * FROM aula ORDER BY numero_aula');
        res.json(aulas.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener las aulas', error: error.message });
    }
};

const createAula = async (req, res) => {
    const { numero_aula, descripcion, cantidad_mesas, cantidad_sillas, capacidad_estudiantes } = req.body;

    if (!numero_aula) {
        return res.status(400).json({ message: 'El número de aula es obligatorio.' });
    }

    try {

        const aulaExistente = await pool.query('SELECT id_aula FROM aula WHERE numero_aula = $1', [numero_aula]);
        if (aulaExistente.rows.length > 0) {
            return res.status(400).json({ message: `El aula con el número ${numero_aula} ya existe.` });
        }

        const nuevaAula = await pool.query(
            'INSERT INTO aula (numero_aula, descripcion, cantidad_mesas, cantidad_sillas, capacidad_estudiantes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [numero_aula, descripcion, cantidad_mesas || 0, cantidad_sillas || 0, capacidad_estudiantes || 0]
        );
        res.status(201).json({ message: 'Aula creada correctamente', aula: nuevaAula.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al crear el aula', error: error.message });
    }
};

const getNiveles = async (req, res) => {
    try {
        const niveles = await pool.query('SELECT * FROM nivel ORDER BY id_nivel');
        res.json(niveles.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener los niveles', error: error.message });
    }
};

const createNivel = async (req, res) => {
    const { nombre_nivel, monto_mensualidad } = req.body;

    if (!nombre_nivel) {
        return res.status(400).json({ message: 'El nombre del nivel es obligatorio.' });
    }

    if (monto_mensualidad < 0) {
        return res.status(400).json({ message: 'El monto de la mensualidad no puede ser un valor negativo.' });
    }

    try {

        const nivelExistente = await pool.query('SELECT id_nivel FROM nivel WHERE nombre_nivel = $1', [nombre_nivel]);
        if (nivelExistente.rows.length > 0) {
            return res.status(400).json({ message: `El nivel '${nombre_nivel}' ya se encuentra registrado.` });
        }

        const nuevoNivel = await pool.query(
            'INSERT INTO nivel (nombre_nivel, monto_mensualidad) VALUES ($1, $2) RETURNING *',
            [nombre_nivel, monto_mensualidad || 0]
        );
        res.status(201).json({ message: 'Nivel creado correctamente', nivel: nuevoNivel.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al crear el nivel', error: error.message });
    }
};

const getGrados = async (req, res) => {
    try {
        const grados = await pool.query(`
            SELECT g.id_grado, g.nombre_grado, n.nombre_nivel, g.id_nivel 
            FROM grado g 
            JOIN nivel n ON g.id_nivel = n.id_nivel
            ORDER BY g.id_nivel, g.id_grado
        `);
        res.json(grados.rows);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener los grados', error: error.message });
    }
};

const createGrado = async (req, res) => {
    const { nombre_grado, id_nivel } = req.body;

    if (!nombre_grado || !id_nivel) {
        return res.status(400).json({ message: 'El nombre del grado y el ID del nivel son obligatorios.' });
    }

    try {
        const nuevoGrado = await pool.query(
            'INSERT INTO grado (nombre_grado, id_nivel) VALUES ($1, $2) RETURNING *',
            [nombre_grado, id_nivel]
        );
        res.status(201).json({ message: 'Grado creado correctamente', grado: nuevoGrado.rows[0] });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({ message: 'El nivel especificado no existe.' });
        }
        res.status(500).json({ message: 'Error al crear el grado', error: error.message });
    }
};

const updateAula = async (req, res) => {
    const { id } = req.params;
    const { numero_aula, descripcion, cantidad_mesas, cantidad_sillas, capacidad_estudiantes } = req.body;

    if (!numero_aula) {
        return res.status(400).json({ message: 'El número de aula es obligatorio.' });
    }
    try {
        const dup = await pool.query('SELECT id_aula FROM aula WHERE numero_aula = $1 AND id_aula != $2', [numero_aula, id]);
        if (dup.rows.length > 0) {
            return res.status(409).json({ message: `El aula "${numero_aula}" ya existe.` });
        }
        const updated = await pool.query(
            'UPDATE aula SET numero_aula=$1, descripcion=$2, cantidad_mesas=$3, cantidad_sillas=$4, capacidad_estudiantes=$5 WHERE id_aula=$6 RETURNING *',
            [numero_aula, descripcion, cantidad_mesas || 0, cantidad_sillas || 0, capacidad_estudiantes || 0, id]
        );
        if (updated.rows.length === 0) return res.status(404).json({ message: 'Aula no encontrada.' });
        res.json({ message: 'Aula actualizada correctamente', aula: updated.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar el aula', error: error.message });
    }
};

const updateNivel = async (req, res) => {
    const { id } = req.params;
    const { nombre_nivel, monto_mensualidad } = req.body;

    if (!nombre_nivel) {
        return res.status(400).json({ message: 'El nombre del nivel es obligatorio.' });
    }
    if (monto_mensualidad < 0) {
        return res.status(400).json({ message: 'El monto no puede ser negativo.' });
    }
    try {
        const dup = await pool.query('SELECT id_nivel FROM nivel WHERE nombre_nivel = $1 AND id_nivel != $2', [nombre_nivel, id]);
        if (dup.rows.length > 0) {
            return res.status(409).json({ message: `El nivel "${nombre_nivel}" ya existe.` });
        }
        const updated = await pool.query(
            'UPDATE nivel SET nombre_nivel=$1, monto_mensualidad=$2 WHERE id_nivel=$3 RETURNING *',
            [nombre_nivel, monto_mensualidad || 0, id]
        );
        if (updated.rows.length === 0) return res.status(404).json({ message: 'Nivel no encontrado.' });
        res.json({ message: 'Nivel actualizado correctamente', nivel: updated.rows[0] });
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar el nivel', error: error.message });
    }
};

const updateGrado = async (req, res) => {
    const { id } = req.params;
    const { nombre_grado, id_nivel } = req.body;

    if (!nombre_grado || !id_nivel) {
        return res.status(400).json({ message: 'Nombre del grado y nivel son obligatorios.' });
    }
    try {
        const updated = await pool.query(
            'UPDATE grado SET nombre_grado=$1, id_nivel=$2 WHERE id_grado=$3 RETURNING *',
            [nombre_grado, id_nivel, id]
        );
        if (updated.rows.length === 0) return res.status(404).json({ message: 'Grado no encontrado.' });
        res.json({ message: 'Grado actualizado correctamente', grado: updated.rows[0] });
    } catch (error) {
        if (error.code === '23503') {
            return res.status(400).json({ message: 'El nivel especificado no existe.' });
        }
        res.status(500).json({ message: 'Error al actualizar el grado', error: error.message });
    }
};

module.exports = {
    getEstructura,
    getAulas, createAula, updateAula,
    getNiveles, createNivel, updateNivel,
    getGrados, createGrado, updateGrado
};

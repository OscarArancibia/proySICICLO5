const express = require('express');
const router = express.Router();
const {
    buscarEstudiante,
    getDeudas,
    crearPaymentIntent,
    verificarPago,
} = require('../controllers/portalController');

// Rutas públicas — sin autenticación (portal de pago para estudiantes)
router.get('/buscar', buscarEstudiante);
router.get('/deudas/:id', getDeudas);
router.post('/payment-intent', crearPaymentIntent);
router.get('/verificar/:id_pago', verificarPago);

module.exports = router;

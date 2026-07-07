const express = require("express");
const router = express.Router();
const {
  getConceptos,
  createConcepto,
  getDeudas,
  createDeuda,
  registrarPago,
  validarPago,
} = require("../controllers/pagoController");
const { generarDeudasMasivas } = require("../controllers/deudaController");
const { verificarToken } = require("../middlewares/authMiddleware");
const { requierePermiso } = require("../middlewares/permissionMiddleware");

router.get(
  "/conceptos",
  verificarToken,
  requierePermiso("ver_pagos"),
  getConceptos,
);
router.post(
  "/conceptos",
  verificarToken,
  requierePermiso("gestionar_pagos"),
  createConcepto,
);
router.get("/deudas", verificarToken, requierePermiso("ver_pagos"), getDeudas);
router.post(
  "/deudas",
  verificarToken,
  requierePermiso("gestionar_pagos"),
  createDeuda,
);
router.post(
  "/deudas/masivas",
  verificarToken,
  requierePermiso("gestionar_pagos"),
  generarDeudasMasivas,
);
router.post(
  "/",
  verificarToken,
  requierePermiso("gestionar_pagos"),
  registrarPago,
);
router.put(
  "/:id/estado",
  verificarToken,
  requierePermiso("gestionar_pagos"),
  validarPago,
);

module.exports = router;

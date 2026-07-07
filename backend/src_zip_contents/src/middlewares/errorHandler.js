// src/middlewares/errorHandler.js
module.exports = (err, req, res, next) => {
  console.error("Error capturado:", err);

  if (err.code === "P0001") {
    return res.status(403).json({
      error: "Persona no autorizada",
      detalle: err.message,
    });
  }

  if (err.code === "23503" || err.code === "23505") {
    return res.status(400).json({
      error: "Datos inválidos",
      detalle: err.message,
    });
  }

  res.status(500).json({
    error: "Error interno del servidor",
    detalle: err.message,
  });
};

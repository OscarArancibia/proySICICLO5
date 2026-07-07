const express = require("express");
const cors = require("cors");
require("dotenv").config();
const pool = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const roleRoutes = require("./routes/roleRoutes");
const profesorRoutes = require("./routes/profesorRoutes");
const gestionRoutes = require("./routes/gestionRoutes");
const estructuraRoutes = require("./routes/estructuraRoutes");
const materiaRoutes = require("./routes/materiaRoutes");
const horarioRoutes = require("./routes/horarioRoutes");
const estudianteRoutes = require("./routes/estudianteRoutes");
const tutorRoutes = require("./routes/tutorRoutes");
const inscripcionRoutes = require("./routes/inscripcionRoutes");
const expedienteRoutes = require("./routes/expedienteRoutes");
const bitacoraRoutes = require("./routes/bitacoraRoutes");
const seguridadRoutes = require("./routes/seguridadRoutes");
const asistenciaRoutes = require("./routes/asistenciaRoutes");
const pagoRoutes = require("./routes/pagoRoutes");
const dimensionRoutes = require("./routes/dimensionRoutes");
const justificacionRoutes = require("./routes/justificacionRoutes");
const inventarioRoutes = require("./routes/inventarioRoutes");
const portalRoutes = require("./routes/portalRoutes");
const estudianteMeRoutes = require("./routes/estudianteMeRoutes");
const entregaRoutes = require("./routes/entregaRoutes");
const errorHandler = require("./middlewares/errorHandler");
const estadoCuentaRoutes = require("./routes/estadoCuentaRoutes");
const avisoRoutes = require("./routes/avisoRoutes");
const reporteRoutes = require("./routes/reporteRoutes");
const chatbotRoutes = require("./routes/chatbotRoutes");

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "https://proyectosi1.vercel.app",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("No permitido por CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/profesores", profesorRoutes);
app.use("/api/gestiones", gestionRoutes);
app.use("/api/estructura", estructuraRoutes);
app.use("/api/materias", materiaRoutes);
app.use("/api/curso", require("./routes/cursoRoutes"));
app.use("/api/materia-asig", require("./routes/materiaAsigRoutes"));
app.use("/api/horarios", horarioRoutes);
app.use("/api/estudiantes", estudianteRoutes);
app.use("/api/tutores", tutorRoutes);
app.use("/api/inscripciones", inscripcionRoutes);
app.use("/api/expedientes", expedienteRoutes);
app.use("/api/bitacora", bitacoraRoutes);
app.use("/api/seguridad", seguridadRoutes);
app.use("/api/asistencias", asistenciaRoutes);
app.use("/api/entregas", entregaRoutes);
app.use("/api/pagos/portal", portalRoutes); // antes de /api/pagos para evitar ambigüedad
app.use("/api/pagos", pagoRoutes);
app.use("/api/dimensiones", dimensionRoutes);
app.use("/api/justificaciones", justificacionRoutes);
app.use("/api/inventario", inventarioRoutes);
app.use("/api/me", estudianteMeRoutes);
app.use("/api/estado-cuenta", estadoCuentaRoutes);
app.use("/api/avisos", avisoRoutes);
app.use("/api/reportes", reporteRoutes);
app.use("/api/chatbot", chatbotRoutes);
//aqui añaden si quieren sus controllers, para ver si es que funcionan bien
app.use("/api/libretas", require("./routes/libretaRoutes"));
app.get("/api/health", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "Backend funcionando",
  });
});
app.use(errorHandler);
// aca :v

const PORT = Number(process.env.PORT) || 5000;

const startServer = async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ Conectado a PostgreSQL");

    const server = app.listen(PORT, () => {
      console.log(`Servidor corriendo en el puerto ${PORT}`);
    });

    server.on("error", (error) => {
      console.error("❌ Error al iniciar el servidor:", error);
    });
  } catch (error) {
    console.error("❌ Error conectando a la BD:", error);
    process.exit(1);
  }
};

startServer();

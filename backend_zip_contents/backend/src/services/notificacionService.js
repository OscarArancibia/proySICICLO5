const transporter = require("../config/mailer");

const enviarNotificacion = async (
  destinatario,
  asunto,
  mensaje,
  canal = "email",
) => {
  if (canal === "email") {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: destinatario,
      subject: asunto,
      text: mensaje,
    });
  }
  // Aquí podrías agregar WhatsApp, SMS, etc.
};

module.exports = { enviarNotificacion };

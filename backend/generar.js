const bycrypt = require("bcryptjs");

async function generarHash() {
  const password = await bycrypt.hash("admin123", 10);
  console.log("password: ", password);
}

generarHash();

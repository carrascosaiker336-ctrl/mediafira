const mongoose = require("mongoose");

function mensajeErrorMongo(error) {
    const name = error && error.name;
    const code = error && error.code;
    const details = error && error.message || "";

    if (
        code === 18 ||
        /bad auth|authentication failed/i.test(details)
    ) {
        return "Autenticación MongoDB fallida. Comprueba el usuario, contraseña y codificación de caracteres especiales de MONGODB_URI.";
    }

    if (
        name === "MongoParseError" ||
        /invalid connection string|invalid scheme/i.test(details)
    ) {
        return "MONGODB_URI no es válida. Revisa el formato y codifica los caracteres reservados de la contraseña.";
    }

    if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(details)) {
        return "No se pudo resolver el host de MongoDB. Comprueba el hostname y la conexión DNS.";
    }

    if (
        name === "MongoServerSelectionError" ||
        /ECONNREFUSED|ETIMEDOUT|timed out/i.test(details)
    ) {
        return "No se pudo alcanzar MongoDB. Comprueba que el clúster esté activo, la red y la lista de IP permitidas.";
    }

    return "No se pudo conectar con MongoDB. Comprueba la configuración y el estado del servicio.";
}

async function conectarDB() {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error("Falta MONGODB_URI en backend/.env.");
    }

    try {
        await mongoose.connect(mongoUri);
        console.log("MongoDB conectado correctamente");
    } catch (error) {
        const message = mensajeErrorMongo(error);
        console.error(`Error conectando a MongoDB (${error.name || "Error"}${error.code ? `, código ${error.code}` : ""}).`);
        throw new Error(message);
    }
}

async function desconectarDB() {
    await mongoose.disconnect();
}

module.exports = {
    conectarDB,
    desconectarDB,
    mensajeErrorMongo
};
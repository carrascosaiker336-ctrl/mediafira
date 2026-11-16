const http = require("node:http");
const path = require("node:path");
const dotenv = require("dotenv");

const backendEnvPath = path.join(__dirname, ".env");
const { conectarDB, desconectarDB } = require("./src/config/database");
const app = require("./src/app");

function cargarConfiguracion() {
    const envResult = dotenv.config({
        path: backendEnvPath,
        override: true,
        quiet: true
    });

    if (envResult.error && envResult.error.code !== "ENOENT") {
        throw new Error("No se pudo leer backend/.env");
    }

    if (!process.env.MONGODB_URI && process.env.MONGO_URI) {
        process.env.MONGODB_URI = process.env.MONGO_URI;
    }

    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!mongoUri) {
        throw new Error("Falta MONGODB_URI en backend/.env. Si usas una variable antigua, renómbrala a MONGODB_URI.");
    }

    if (!/^mongodb(\+srv)?:\/\//i.test(mongoUri)) {
        throw new Error("MONGODB_URI debe comenzar por mongodb:// o mongodb+srv://.");
    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        throw new Error("JWT_SECRET debe tener al menos 32 caracteres en backend/.env");
    }

    const port = Number(process.env.PORT || (process.env.NODE_ENV === "production" ? 10000 : 3000));
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("PORT debe ser un número entero entre 1 y 65535.");
    }

    const basePath = (process.env.BASE_PATH || "").trim();
    if (basePath && (!basePath.startsWith("/") || basePath.includes(" "))) {
        throw new Error("BASE_PATH debe empezar por '/' y no puede incluir espacios.");
    }

    return {
        host: process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1"),
        port,
        basePath: basePath.replace(/\/+$/, "") || ""
    };
}

function mensajeErrorHttp(error, port, host) {
    if (error.code === "EADDRINUSE") {
        return `El puerto ${port} ya está ocupado. Cierra el otro servidor o configura PORT.`;
    }

    if (error.code === "EACCES") {
        return `No hay permisos para escuchar en el puerto ${port}.`;
    }

    if (error.code === "EADDRNOTAVAIL") {
        return `La dirección ${host} no está disponible en este equipo.`;
    }

    return "No se pudo iniciar el servidor HTTP.";
}

function escuchar(server, host, port) {
    return new Promise((resolve, reject) => {
        const alEscuchar = () => {
            server.removeListener("error", alFallar);
            resolve();
        };
        const alFallar = (error) => {
            server.removeListener("listening", alEscuchar);
            reject(error);
        };

        server.once("listening", alEscuchar);
        server.once("error", alFallar);
        server.listen(port, host);
    });
}

async function cerrarServidor(server, signal) {
    console.log(`Señal ${signal}: cerrando servidor y conexión MongoDB...`);

    server.close(async (error) => {
        if (error) {
            console.error("Error cerrando el servidor HTTP.");
            process.exitCode = 1;
        }

        try {
            await desconectarDB();
            console.log("Servidor y MongoDB cerrados correctamente.");
        } catch {
            console.error("No se pudo cerrar correctamente la conexión MongoDB.");
            process.exitCode = 1;
        }
    });
}

async function iniciarServidor() {
    const { host, port, basePath } = cargarConfiguracion();
    process.env.BASE_PATH = basePath;
    await conectarDB();

    const server = http.createServer(app);

    try {
        await escuchar(server, host, port);
    } catch (error) {
        try {
            await desconectarDB();
        } catch {
            console.error("No se pudo liberar la conexión MongoDB tras fallar HTTP.");
        }
        throw new Error(mensajeErrorHttp(error, port, host));
    }

    server.on("error", (error) => {
        console.error("Error en el servidor HTTP:", mensajeErrorHttp(error, port, host));
        process.exitCode = 1;
    });

    console.log(`Servidor disponible en http://${host}:${port}`);

    let cerrando = false;
    const detener = (signal) => {
        if (cerrando) {
            return;
        }
        cerrando = true;
        cerrarServidor(server, signal);
    };

    process.once("SIGINT", () => detener("SIGINT"));
    process.once("SIGTERM", () => detener("SIGTERM"));
}

iniciarServidor().catch((error) => {
    console.error("No se pudo iniciar MediaFeria:", error.message);
    process.exitCode = 1;
});

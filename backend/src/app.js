const fs = require("node:fs/promises");
const path = require("node:path");
const usuarioRoutes = require(
    "./routes/usuarioRoutes"
);
const pagoRoutes = require("./routes/pagoRoutes");
const feriaRoutes = require("./routes/feriaRoutes");
const solicitudRoutes = require("./routes/solicitudRoutes");
const chatRoutes = require("./routes/chatRoutes");
const parseJson = require("./middleware/jsonParser");
const { sendJson } = require("./utils/response");
const { authMiddleware } = require("./middleware/authMiddleware");

const frontendDirectory = path.resolve(__dirname, "..", "..", "frontend");
const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml"
};

async function servirFrontend(req, res, pathname) {
    if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { mensaje: "Método no permitido." });
        return;
    }

    if (pathname === "/") {
        pathname = "/index.html";
    }

    let decodedPath;

    try {
        decodedPath = decodeURIComponent(pathname);
    } catch {
        sendJson(res, 400, { mensaje: "La ruta solicitada no es válida." });
        return;
    }

    const filePath = path.resolve(frontendDirectory, `.${decodedPath}`);
    const relativePath = path.relative(frontendDirectory, filePath);

    if (
        relativePath === ".." ||
        relativePath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativePath)
    ) {
        sendJson(res, 403, { mensaje: "Acceso denegado." });
        return;
    }

    try {
        const file = await fs.readFile(filePath);
        const contentType =
            contentTypes[path.extname(filePath).toLowerCase()] ||
            "application/octet-stream";

        res.writeHead(200, {
            "Content-Type": contentType,
            "X-Content-Type-Options": "nosniff"
        });
        res.end(req.method === "HEAD" ? undefined : file);
    } catch (error) {
        if (error.code === "ENOENT" || error.code === "EISDIR") {
            sendJson(res, 404, { mensaje: "Recurso no encontrado." });
            return;
        }

        throw error;
    }
}

async function app(req, res) {
    let pathname;

    try {
        pathname = new URL(req.url, "http://localhost").pathname;

        if (pathname.startsWith("/api/")) {
            req.pathname = pathname;

            if (pathname === "/api/health") {
                if (req.method !== "GET") {
                    sendJson(res, 405, { mensaje: "Método no permitido." });
                    return;
                }

                sendJson(res, 200, { estado: "ok" });
                return;
            }

            if (pathname === "/api/pagos/webhook") {
                await pagoRoutes(req, res);
                return;
            }

            if (pathname === "/api/login") {
                if (req.method !== "POST") {
                    sendJson(res, 405, { mensaje: "Método no permitido." });
                    return;
                }

                req.body = await parseJson(req);
            }

            if (pathname === "/api/usuarios") {
                if (req.method !== "POST") {
                    sendJson(res, 405, { mensaje: "Método no permitido." });
                    return;
                }

                req.body = await parseJson(req, 7 * 1024 * 1024);
            }

            if (
                pathname !== "/api/login" &&
                pathname !== "/api/usuarios" &&
                !authMiddleware(req, res)
            ) {
                return;
            }

            const handled = pathname.startsWith("/api/pagos")
                ? await pagoRoutes(req, res)
                : pathname.startsWith("/api/ferias")
                    ? await feriaRoutes(req, res)
                    : pathname.startsWith("/api/solicitudes")
                        ? await solicitudRoutes(req, res)
                        : pathname.startsWith("/api/chat")
                            ? await chatRoutes(req, res)
                            : await usuarioRoutes(req, res);

            if (!handled) {
                sendJson(res, 404, { mensaje: "Ruta API no encontrada." });
            }
            return;
        }

        await servirFrontend(req, res, pathname);
    } catch (error) {
        const statusCode = Number.isInteger(error.statusCode)
            ? error.statusCode
            : 500;

        if (statusCode === 500) {
            console.error("Error procesando la solicitud:", error);
        }

        if (!res.headersSent) {
            sendJson(res, statusCode, {
                mensaje: statusCode === 500
                    ? "Error interno del servidor."
                    : error.message
            });
        } else {
            res.end();
        }
    }
}

module.exports = app;
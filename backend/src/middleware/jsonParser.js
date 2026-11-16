async function parseJson(req, maxBodyBytes = 1024 * 1024) {
    const contentType = req.headers["content-type"] || "";

    if (contentType.split(";")[0].trim().toLowerCase() !== "application/json") {
        const error = new Error("El contenido debe enviarse como JSON.");
        error.statusCode = 415;
        throw error;
    }

    let rawBody = "";

    for await (const chunk of req) {
        rawBody += chunk;

        if (Buffer.byteLength(rawBody) > maxBodyBytes) {
            const error = new Error(
                `El cuerpo de la solicitud supera ${Math.floor(maxBodyBytes / 1024 / 1024)} MB.`
            );
            error.statusCode = 413;
            throw error;
        }
    }

    if (!rawBody) {
        return {};
    }

    try {
        return JSON.parse(rawBody);
    } catch {
        const error = new Error("El cuerpo de la solicitud no contiene JSON válido.");
        error.statusCode = 400;
        throw error;
    }
}

module.exports = parseJson;
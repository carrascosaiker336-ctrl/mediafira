(() => {
    const rolesValidos = new Set([
        "admin",
        "organizador",
        "ayuntamiento",
        "feriante"
    ]);

    function getClaims() {
        const token = sessionStorage.getItem("mediaferiaToken");

        if (!token) {
            throw new Error("No hay una sesión activa.");
        }

        const partes = token.split(".");

        if (partes.length !== 3) {
            throw new Error("El token no tiene un formato válido.");
        }

        const payloadBase64 = partes[1]
            .replace(/-/g, "+")
            .replace(/_/g, "/")
            .padEnd(Math.ceil(partes[1].length / 4) * 4, "=");
        const payload = JSON.parse(atob(payloadBase64));

        if (
            payload.iss !== "mediaferia" ||
            typeof payload.sub !== "string" ||
            typeof payload.exp !== "number" ||
            payload.exp * 1000 <= Date.now() ||
            !rolesValidos.has(payload.rol)
        ) {
            throw new Error("La sesión no es válida.");
        }

        return payload;
    }

    function clear() {
        sessionStorage.removeItem("mediaferiaToken");
    }

    window.mediaferiaSession = { getClaims, clear };
})();

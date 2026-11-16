window.apiRequest = async function apiRequest(path, options = {}) {
    const token = sessionStorage.getItem("mediaferiaToken");
    const headers = {
        "Content-Type": "application/json",
        ...options.headers
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(path, {
        ...options,
        headers
    });

    let payload;

    try {
        payload = await response.json();
    } catch {
        throw new Error("El servidor devolvió una respuesta no válida.");
    }

    if (!response.ok) {
        if (response.status === 401) {
            sessionStorage.removeItem("mediaferiaToken");
        }
        throw new Error(payload.mensaje || "No se pudo completar la solicitud.");
    }

    return payload;
};
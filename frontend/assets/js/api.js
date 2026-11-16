window.mediaferiaBasePath = (() => {
    const current = (window.location.pathname || "/").replace(/\/+$/, "");
    const pagesIndex = current.lastIndexOf("/pages");

    if (pagesIndex > -1) {
        return current.slice(0, pagesIndex) || "";
    }

    return current === "" || current === "/" ? "" : current;
})();

window.mediaferiaResolveUrl = function mediaferiaResolveUrl(pathname) {
    if (!pathname || /^([a-z]+:)?\/\//i.test(pathname) || pathname.startsWith("data:")) {
        return pathname;
    }

    const base = (window.mediaferiaBasePath || "").replace(/\/+$/, "");

    if (pathname.startsWith("/")) {
        return base ? `${base}${pathname}` : pathname;
    }

    return base ? `${base}/${pathname.replace(/^\.?\//, "")}` : `/${pathname.replace(/^\.?\//, "")}`;
};

window.apiRequest = async function apiRequest(path, options = {}) {
    const token = sessionStorage.getItem("mediaferiaToken");
    const headers = {
        "Content-Type": "application/json",
        ...options.headers
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(window.mediaferiaResolveUrl(path), {
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
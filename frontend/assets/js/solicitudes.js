const container = document.querySelector("#requests");
const pageMessage = document.querySelector("#page-message");
const euroFormat = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR"
});

function showMessage(text, type = "error") {
    pageMessage.textContent = text;
    pageMessage.dataset.type = type;
}

function addText(parent, tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
        node.className = className;
    }
    node.textContent = text;
    parent.append(node);
    return node;
}

async function loadRequests() {
    const response = await window.apiRequest("/api/solicitudes");
    if (!Array.isArray(response.solicitudes)) {
        throw new Error("El servidor devolvió solicitudes no válidas.");
    }

    container.replaceChildren();
    if (!response.solicitudes.length) {
        addText(container, "p", "feature-empty", "Todavía no hay solicitudes para tus ferias.");
        return;
    }

    for (const solicitud of response.solicitudes) {
        const card = document.createElement("article");
        card.className = "feature-card";
        addText(card, "h3", "", solicitud.feriante
            ? solicitud.feriante.nombre
            : "Feriante no disponible");
        addText(card, "p", "", `Feria: ${solicitud.feria}`);
        addText(card, "p", "", `Espacio: ${solicitud.espacio}`);
        addText(card, "p", "", `Importe: ${Number.isFinite(solicitud.precio)
            ? euroFormat.format(solicitud.precio)
            : "No disponible"}`);
        addText(card, "span", "feature-chip", solicitud.estado);

        if (solicitud.estado === "pendiente") {
            const actions = document.createElement("div");
            actions.className = "feature-actions";
            for (const [estado, label, buttonClass] of [
                ["aprobada", "Aprobar", "feature-button"],
                ["rechazada", "Rechazar", "feature-button feature-button--danger"]
            ]) {
                const button = addText(actions, "button", buttonClass, label);
                button.type = "button";
                button.dataset.solicitudId = solicitud.id;
                button.dataset.estado = estado;
            }
            card.append(actions);
        }
        container.append(card);
    }
}

container.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-solicitud-id]");
    if (!button) {
        return;
    }

    button.disabled = true;
    try {
        const result = await window.apiRequest(
            `/api/solicitudes/${encodeURIComponent(button.dataset.solicitudId)}/estado`,
            {
                method: "PATCH",
                body: JSON.stringify({ estado: button.dataset.estado })
            }
        );
        showMessage(result.mensaje, "success");
        await loadRequests();
    } catch (error) {
        showMessage(error.message);
        button.disabled = false;
    }
});

(async () => {
    let claims;
    try {
        claims = window.mediaferiaSession.getClaims();
    } catch {
        window.mediaferiaSession.clear();
        window.location.replace("/pages/login.html");
        return;
    }
    if (claims.rol !== "organizador") {
        window.location.replace("/pages/dashboard.html");
        return;
    }
    try {
        await loadRequests();
    } catch (error) {
        showMessage(error.message);
    }
})();

const roleLabels = {
    organizador: "Organizador",
    ayuntamiento: "Ayuntamiento",
    feriante: "Feriante"
};
const pageMessage = document.querySelector("#page-message");
const euroFormat = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR"
});
let claims;

function showMessage(text, type = "error") {
    pageMessage.textContent = text;
    pageMessage.dataset.type = type;
}

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
        node.className = className;
    }
    if (text !== undefined) {
        node.textContent = text;
    }
    return node;
}

function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "Fecha pendiente"
        : new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(date);
}

function statusLabel(status) {
    return ({
        pendiente: "Pendiente de revisión",
        aprobada: "Aprobada",
        rechazada: "Rechazada",
        pendiente_aprobacion: "Pendiente del ayuntamiento",
        abierta: "Abierta",
        cerrada: "Cerrada",
        finalizada: "Finalizada"
    })[status] || status;
}

function appendFairDetails(card, feria) {
    card.append(
        element(
            "p",
            "",
            `${formatDate(feria.fechaInicio)} – ${formatDate(feria.fechaFin)}`
        ),
        element(
            "p",
            "",
            [feria.localidad, feria.provincia].filter(Boolean).join(", ")
        ),
        element(
            "p",
            "",
            feria.ayuntamiento ? `Ayuntamiento: ${feria.ayuntamiento}` : ""
        ),
        element("p", "", feria.descripcion),
        element("span", "feature-chip", statusLabel(feria.estado))
    );
}

function createOrganizerFairCard(feria) {
    const card = element("article", "feature-card");
    card.append(element("h3", "", feria.nombre));
    appendFairDetails(card, feria);
    for (const espacio of feria.espacios) {
        card.append(element(
            "p",
            "",
            `${espacio.nombre} · ${espacio.metrosCuadrados} m² · ${euroFormat.format(espacio.precio)}`
        ));
    }
    return card;
}

function createMunicipalityFairCard(feria) {
    const card = createOrganizerFairCard(feria);

    if (feria.estado === "pendiente_aprobacion") {
        const actions = element("div", "feature-actions");
        for (const [decision, label, style] of [
            ["abierta", "Aprobar y publicar", "feature-button"],
            ["rechazada", "Rechazar", "feature-button feature-button--danger"]
        ]) {
            const button = element("button", style, label);
            button.type = "button";
            button.dataset.feriaId = feria.id;
            button.dataset.estado = decision;
            actions.append(button);
        }
        card.append(actions);
    }
    return card;
}

function createVendorFairCard(feria) {
    const card = element("article", "feature-card");
    card.append(element("h3", "", feria.nombre));
    appendFairDetails(card, feria);

    if (feria.espacios.length === 0) {
        card.append(element("p", "feature-empty", "No hay espacios disponibles."));
    }

    for (const espacio of feria.espacios) {
        const row = element("div", "feature-actions");
        const price = element(
            "p",
            "",
            `${espacio.nombre} · ${espacio.metrosCuadrados} m² · ${euroFormat.format(espacio.precio)}`
        );
        const button = element("button", "feature-button", "Solicitar plaza");
        button.type = "button";
        button.dataset.feriaId = feria.id;
        button.dataset.espacioId = espacio.id;
        button.disabled = !espacio.disponible;
        row.append(price, button);
        card.append(row);
    }
    return card;
}

function showEmpty(container, text) {
    container.replaceChildren(element("p", "feature-empty", text));
}

async function loadFairs() {
    const response = await window.apiRequest("/api/ferias");
    const ferias = response.ferias;
    if (!Array.isArray(ferias)) {
        throw new Error("El servidor devolvió una lista de ferias no válida.");
    }

    if (claims.rol === "organizador") {
        const container = document.querySelector("#organizer-fairs");
        container.replaceChildren();
        if (!ferias.length) {
            showEmpty(container, "Todavía no has creado ferias.");
        } else {
            ferias.forEach((feria) => container.append(createOrganizerFairCard(feria)));
        }
    } else if (claims.rol === "ayuntamiento") {
        const container = document.querySelector("#municipality-fairs");
        container.replaceChildren();
        if (!ferias.length) {
            showEmpty(container, "Aún no hay ferias asociadas a tu ayuntamiento.");
        } else {
            ferias.forEach((feria) => container.append(createMunicipalityFairCard(feria)));
        }
    } else {
        const container = document.querySelector("#open-fairs");
        container.replaceChildren();
        if (!ferias.length) {
            showEmpty(container, "No hay ferias abiertas disponibles ahora mismo.");
        } else {
            ferias.forEach((feria) => container.append(createVendorFairCard(feria)));
        }
    }
}

async function loadVendorRequests() {
    const container = document.querySelector("#vendor-requests");
    const response = await window.apiRequest("/api/solicitudes/mias");
    if (!Array.isArray(response.solicitudes)) {
        throw new Error("El servidor devolvió una lista de solicitudes no válida.");
    }

    container.replaceChildren();
    if (!response.solicitudes.length) {
        showEmpty(container, "Todavía no te has apuntado a ninguna feria.");
        return;
    }

    for (const solicitud of response.solicitudes) {
        const card = element("article", "feature-card");
        card.append(
            element("h3", "", solicitud.feria ? solicitud.feria.nombre : "Feria no disponible"),
            element("p", "", solicitud.espacio
                ? `${solicitud.espacio.nombre} · ${euroFormat.format(solicitud.espacio.precio)}`
                : "Espacio no disponible"),
            element("span", "feature-chip", statusLabel(solicitud.estado))
        );
        if (solicitud.estado === "aprobada") {
            const payLink = element("a", "feature-button", "Pagar inscripción");
            payLink.href = "/pages/pagos.html";
            card.append(payLink);
        }
        container.append(card);
    }
}

async function loadMunicipalities() {
    const response = await window.apiRequest("/api/ferias/ayuntamientos");
    const select = document.querySelector('#create-fair-form [name="ayuntamientoId"]');
    if (!Array.isArray(response.ayuntamientos) || !select) {
        throw new Error("No se pudo cargar la lista de ayuntamientos.");
    }

    for (const ayuntamiento of response.ayuntamientos) {
        const option = element(
            "option",
            "",
            ayuntamiento.entidad
                ? `${ayuntamiento.entidad} — ${ayuntamiento.nombre}`
                : ayuntamiento.nombre
        );
        option.value = ayuntamiento.id;
        select.append(option);
    }
}

async function initialize() {
    try {
        claims = window.mediaferiaSession.getClaims();
    } catch {
        window.mediaferiaSession.clear();
        window.location.replace("/pages/login.html");
        return;
    }

    if (!roleLabels[claims.rol]) {
        window.location.replace("/pages/dashboard.html");
        return;
    }

    document.querySelector("#role-intro").textContent =
        `Accede a las ferias y gestiones de tu perfil de ${roleLabels[claims.rol]}.`;

    const panelId = {
        organizador: "#organizer-fairs-panel",
        ayuntamiento: "#municipality-panel",
        feriante: "#vendor-fairs-panel"
    }[claims.rol];
    document.querySelector(panelId).hidden = false;

    try {
        if (claims.rol === "organizador") {
            document.querySelector("#create-fair-panel").hidden = false;
            await loadMunicipalities();
        } else if (claims.rol === "feriante") {
            document.querySelector("#vendor-requests-panel").hidden = false;
        }
        await loadFairs();
        if (claims.rol === "feriante") {
            await loadVendorRequests();
        }
    } catch (error) {
        showMessage(error.message);
    }
}

document.querySelector("#create-fair-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    showMessage("");

    try {
        const payload = Object.fromEntries(data.entries());
        payload.precio = Number(payload.precio);
        payload.metrosCuadrados = Number(payload.metrosCuadrados);
        await window.apiRequest("/api/ferias", {
            method: "POST",
            body: JSON.stringify(payload)
        });
        form.reset();
        showMessage("La feria se envió al ayuntamiento para su aprobación.", "success");
        await loadFairs();
    } catch (error) {
        showMessage(error.message);
    } finally {
        submit.disabled = false;
    }
});

document.querySelector("#municipality-fairs").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-feria-id]");
    if (!button) {
        return;
    }

    button.disabled = true;
    try {
        const result = await window.apiRequest(
            `/api/ferias/${encodeURIComponent(button.dataset.feriaId)}/aprobacion`,
            {
                method: "PATCH",
                body: JSON.stringify({ estado: button.dataset.estado })
            }
        );
        showMessage(result.mensaje, "success");
        await loadFairs();
    } catch (error) {
        showMessage(error.message);
        button.disabled = false;
    }
});

document.querySelector("#open-fairs").addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-espacio-id]");
    if (!button) {
        return;
    }

    button.disabled = true;
    try {
        const result = await window.apiRequest("/api/solicitudes", {
            method: "POST",
            body: JSON.stringify({
                feriaId: button.dataset.feriaId,
                espacioId: button.dataset.espacioId
            })
        });
        showMessage(result.mensaje, "success");
        await loadVendorRequests();
    } catch (error) {
        showMessage(error.message);
        button.disabled = false;
    }
});

initialize();
const pageMessage = document.querySelector("#page-message");
const contactSelect = document.querySelector("#contact-select");
const conversationList = document.querySelector("#conversation-list");
const messageList = document.querySelector("#messages");
const chatTitle = document.querySelector("#chat-title");
const sendForm = document.querySelector("#send-message-form");
const messageInput = document.querySelector("#message-input");
let claims;
let conversationActive;

function showMessage(text, type = "error") {
    pageMessage.textContent = text;
    pageMessage.dataset.type = type;
}

function createText(tag, className, text) {
    const node = document.createElement(tag);
    if (className) {
        node.className = className;
    }
    node.textContent = text;
    return node;
}

function roleName(role) {
    return ({
        organizador: "Organizador",
        ayuntamiento: "Ayuntamiento",
        feriante: "Feriante"
    })[role] || role;
}

async function loadContacts() {
    const response = await window.apiRequest("/api/chat/contactos");
    if (!Array.isArray(response.contactos)) {
        throw new Error("No se pudo cargar la lista de contactos.");
    }
    for (const contact of response.contactos) {
        const option = createText(
            "option",
            "",
            `${contact.nombre} · ${roleName(contact.rol)}`
        );
        option.value = contact.id;
        contactSelect.append(option);
    }
}

async function loadConversations() {
    const response = await window.apiRequest("/api/chat/conversaciones");
    if (!Array.isArray(response.conversaciones)) {
        throw new Error("No se pudieron cargar las conversaciones.");
    }

    conversationList.replaceChildren();
    if (!response.conversaciones.length) {
        conversationList.append(
            createText("p", "feature-empty", "Aún no tienes conversaciones.")
        );
        return;
    }

    for (const conversation of response.conversaciones) {
        if (!conversation.contacto) {
            continue;
        }
        const button = createText("button", "chat-thread", "");
        button.type = "button";
        button.dataset.conversationId = conversation.id;
        button.dataset.contactName = conversation.contacto.nombre;
        button.dataset.contactRole = conversation.contacto.rol;
        button.setAttribute(
            "aria-current",
            String(conversation.id === conversationActive)
        );
        button.append(
            createText("strong", "", conversation.contacto.nombre),
            createText("span", "", roleName(conversation.contacto.rol))
        );
        conversationList.append(button);
    }
}

async function loadMessages(conversationId) {
    conversationActive = conversationId;
    const selected = conversationList.querySelector(
        `button[data-conversation-id="${CSS.escape(conversationId)}"]`
    );
    chatTitle.textContent = selected
        ? `${selected.dataset.contactName} · ${roleName(selected.dataset.contactRole)}`
        : "Conversación";
    sendForm.hidden = false;
    messageList.replaceChildren(createText("p", "feature-empty", "Cargando mensajes…"));

    const response = await window.apiRequest(
        `/api/chat/conversaciones/${encodeURIComponent(conversationId)}/mensajes`
    );
    if (!Array.isArray(response.mensajes)) {
        throw new Error("El servidor devolvió mensajes no válidos.");
    }

    messageList.replaceChildren();
    if (!response.mensajes.length) {
        messageList.append(createText("p", "feature-empty", "Inicia la conversación con un mensaje."));
    }
    for (const message of response.mensajes) {
        const bubble = createText(
            "article",
            message.remitenteId === claims.sub
                ? "chat-bubble chat-bubble--mine"
                : "chat-bubble",
            ""
        );
        bubble.append(createText("p", "", message.texto));
        const time = createText(
            "time",
            "",
            new Intl.DateTimeFormat("es-ES", {
                dateStyle: "short",
                timeStyle: "short"
            }).format(new Date(message.creado))
        );
        bubble.append(time);
        messageList.append(bubble);
    }
    messageList.scrollTop = messageList.scrollHeight;
    await loadConversations();
}

document.querySelector("#start-chat-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.currentTarget.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
        const result = await window.apiRequest("/api/chat/conversaciones", {
            method: "POST",
            body: JSON.stringify({ contactoId: contactSelect.value })
        });
        showMessage("");
        await loadConversations();
        await loadMessages(result.conversacion.id);
        contactSelect.value = "";
    } catch (error) {
        showMessage(error.message);
    } finally {
        submit.disabled = false;
    }
});

conversationList.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-conversation-id]");
    if (!button) {
        return;
    }

    try {
        await loadMessages(button.dataset.conversationId);
        showMessage("");
    } catch (error) {
        showMessage(error.message);
    }
});

sendForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!conversationActive || !messageInput.value.trim()) {
        return;
    }

    const submit = sendForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
        await window.apiRequest(
            `/api/chat/conversaciones/${encodeURIComponent(conversationActive)}/mensajes`,
            {
                method: "POST",
                body: JSON.stringify({ texto: messageInput.value })
            }
        );
        messageInput.value = "";
        await loadMessages(conversationActive);
        showMessage("");
    } catch (error) {
        showMessage(error.message);
    } finally {
        submit.disabled = false;
        messageInput.focus();
    }
});

(async () => {
    try {
        claims = window.mediaferiaSession.getClaims();
    } catch {
        window.mediaferiaSession.clear();
        window.location.replace("/pages/login.html");
        return;
    }
    try {
        await Promise.all([loadContacts(), loadConversations()]);
    } catch (error) {
        showMessage(error.message);
    }
})();

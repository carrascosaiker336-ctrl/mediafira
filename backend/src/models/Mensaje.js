const mongoose = require("mongoose");

const mensajeSchema = new mongoose.Schema(
    {
        conversacion: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Conversacion",
            required: true,
            index: true
        },
        remitente: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Usuario",
            required: true
        },
        texto: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Mensaje", mensajeSchema, "mensajes");

const mongoose = require("mongoose");

const conversacionSchema = new mongoose.Schema(
    {
        participantes: {
            type: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: "Usuario",
                required: true
            }],
            validate: {
                validator: (participantes) => participantes.length === 2,
                message: "Una conversación debe tener dos participantes."
            },
            required: true
        },
        pareja: {
            type: String,
            required: true,
            unique: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Conversacion", conversacionSchema, "conversaciones");

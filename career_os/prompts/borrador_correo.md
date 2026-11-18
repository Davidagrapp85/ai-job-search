# Tarea: crear el borrador del correo — corrida {{run_id}}

David aprobó la CV y la carta. Crea el **borrador** (no lo envíes) del correo de postulación en su Outlook (`duarcas_8@hotmail.com`) con Composio.

1. Lee `05_Busqueda_Empleo/{{carpeta}}/correo.json` (`para`, `cc`, `asunto`, `cuerpo_html`, `adjuntos`). Es lo que David verá en la vista previa: no lo cambies.
2. Crea el borrador con `OUTLOOK_CREATE_DRAFT` (`to_recipients` = `para`, `cc_recipients` = `cc`, `subject` = `asunto`, `body` = `cuerpo_html`, `is_html: true`). Guarda el `id` del mensaje.
3. Por cada adjunto: `bun run tracker adjunto {{run_id}} <archivo>` te da `{nombre, mime, base64}` del archivo aprobado. Agrégalo con `OUTLOOK_ADD_MAIL_ATTACHMENT` (`message_id`, `name`, `contentType` = mime, `contentBytes` = base64).
4. Verifica con `OUTLOOK_GET_MESSAGE` que el borrador tiene destinatarios, asunto y adjuntos.
5. Registra: `bun run tracker borrador {{run_id}} --draft-id <id>` y `bun run tracker paso {{run_id}} correo listo --detalle "Borrador listo para revisar"`.

**Nunca** uses `OUTLOOK_SEND_DRAFT` ni `OUTLOOK_SEND_EMAIL` en esta tarea. Si algo falla, `bun run tracker paso {{run_id}} correo error --detalle "<qué falló>"`.

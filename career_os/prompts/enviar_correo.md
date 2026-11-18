# Tarea: enviar el correo aprobado — corrida {{run_id}}

David hizo clic en **Enviar** después de ver la vista previa. Envía exactamente el borrador `{{draft_id}}`; nada más.

1. `OUTLOOK_GET_MESSAGE` con `message_id` = `{{draft_id}}`: confirma que sigue siendo borrador, con asunto «{{asunto}}» y destinatarios {{para}}. Si no coincide, no envíes: `bun run tracker paso {{run_id}} correo alerta --detalle "El borrador no coincide con la vista previa"` y termina.
2. `OUTLOOK_SEND_DRAFT` con ese `message_id`. Una respuesta vacía puede ser éxito.
3. Verifica en Elementos enviados (`OUTLOOK_LIST_SENT_ITEMS_MESSAGES` o `OUTLOOK_QUERY_EMAILS` con `folder: "sentitems"`) un mensaje de hoy con ese asunto y destinatario. Toma su `id` y su fecha (AAAA-MM-DD).
4. Solo con esa evidencia: `bun run tracker confirmar-envio {{run_id}} --message-id <id enviado> --fecha <AAAA-MM-DD>` y `bun run tracker paso {{run_id}} correo listo --detalle "Enviado y verificado"`.
5. Sin evidencia: `bun run tracker paso {{run_id}} correo alerta --detalle "Envío no confirmado; revisa Elementos enviados"`. No llames `confirmar-envio`.

No reenvíes, no respondas y no envíes ningún otro correo.

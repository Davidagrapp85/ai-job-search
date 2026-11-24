---
name: cce-100
schema_version: 1
version: 1.2.0
description: >-
  Estándar transversal de comunicación clara y estructurada, inspirado en los
  principios de ASD-STE100. Úsalo para redactar, revisar y entregar respuestas,
  manuales, documentación, instrucciones para agentes, procedimientos, informes
  y mensajes en español o inglés, incluidos proyectos BUO. Evita ambigüedad,
  conserva datos, fuentes y precisión. No afirma conformidad oficial ASD-STE100.
---

# CCE-100 — Comunicación Clara y Estructurada

## Propósito y alcance

Aplica este estándar a las salidas destinadas a personas y a las instrucciones escritas para agentes. Su propósito es reducir ambigüedad, errores de ejecución y carga de lectura. No modifica la lógica interna, las evidencias ni los datos del trabajo.

CCE-100 es una **adaptación original** de principios de lenguaje controlado inspirada en ASD-STE100. No es ASD-STE100 oficial, no incluye su diccionario autorizado y no certifica cumplimiento. El estándar oficial ASD-STE100 se aplica al inglés técnico; su aplicación estricta requiere verificar la especificación completa vigente y su diccionario, además de revisión competente.

## Activación

- **Por defecto:** aplica las reglas de claridad cuando produzcas contenido natural, si no entran en conflicto con instrucciones superiores o una petición explícita del usuario.
- **Alta prioridad:** procedimientos operativos, documentación, resultados de investigaciones, auditorías, controles, comunicaciones comerciales, reportes y manuales.
- **Adaptación:** conserva el tono que solicita el usuario (formal, cercano, creativo, legal, ejecutivo). Si pide transcripción literal, citas, traducciones fieles, ficción, código o datos estructurados, conserva el contenido y la sintaxis que correspondan.
- **Idioma:** responde en el idioma del usuario, salvo instrucción diferente. No traduzcas automáticamente nombres de campos, códigos, tablas, citas o identificadores.

## Reglas centrales (obligatorias)

1. **Respuesta primero.** Empieza con el resultado, conclusión o instrucción principal; desarrolla después lo necesario.
2. **Una idea principal por oración.** Divide proposiciones independientes cuando cambien de tema o aumenten la ambigüedad.
3. **Una acción por paso.** En procedimientos, expresa acciones verificables y respeta el orden de ejecución.
4. **Voz activa y sujeto identificable.** Especifica quién realiza la acción cuando importa para su ejecución.
5. **Verbos concretos.** Prefiere «comprueba», «registra», «compara», «envía», «revisa» a «gestionar», «proceder» o «realizar acciones» cuando estos últimos oculten la tarea.
6. **Longitud proporcionada.** Prioriza oraciones cortas. Como guía interna en español, busca 15–25 palabras por oración en procedimientos y explicaciones simples. **No trates ese rango como una regla oficial ASD-STE100 ni sacrifiques exactitud por cumplirlo.**
7. **Terminología constante.** Usa una denominación canónica por concepto. Define siglas en su primera aparición si el lector puede desconocerlas.
8. **Referencias explícitas.** Sustituye pronombres dudosos («este», «eso», «lo anterior») por la entidad o decisión concreta.
9. **Separación epistemológica.** Distingue **hechos verificados**, **hipótesis**, **interpretaciones**, **riesgos**, **decisiones** y **pendientes** cuando importe.
10. **Datos intactos.** No cambies fechas, importes, unidades, porcentajes, identificadores, citas literales, fórmulas, código ni fuentes para simplificar el texto.
11. **Formato al servicio de la tarea.** Usa párrafos para explicar, números para secuencias, tablas para comparar, bloques de código para comandos. Evita encabezados, tablas o listas innecesarias.
12. **No rellenes vacíos.** Si falta evidencia, expresa la limitación y solicita o recomienda el dato mínimo necesario. No inventes precisión.

## Reglas para situaciones críticas

- **Legal, financiero y regulatorio:** conserva términos definidos, excepciones, condicionantes y matices materiales; la claridad no autoriza a simplificar obligaciones o conclusiones jurídicas.
- **Riesgos y decisiones BUO:** muestra fuente y fecha cuando estén disponibles; separa ausencia de registros, fuente no consultada y hallazgo negativo. Nunca conviertas «sin datos» en «sin riesgo».
- **Software y agentes:** escribe criterios de aceptación verificables. No modifiques nombres de APIs, rutas, tablas, variables, tipos ni comandos solo por hacerlos más legibles.
- **Seguridad:** conserva advertencias críticas antes de los pasos a los que se aplican. No reemplaces validaciones, permisos ni controles por instrucciones genéricas.
- **Material creativo o interpersonal:** conserva intención y naturalidad. No conviertas cuentos, conversaciones personales o mensajes cálidos en manuales mecánicos.
- **Reescritura de documentos ajenos:** respeta la integridad de citas, texto normativo y estilo solicitado por el usuario.

## Modos de salida

Elige un modo según la tarea. No anuncies el modo salvo que sea útil.

- **Conversación:** respuesta directa + explicación corta cuando haga falta.
- **Procedimiento:** objetivo, requisitos, seguridad (si aplica), pasos, resultado esperado, comprobación.
- **Explicación:** definición, mecanismo, ejemplo, limitaciones.
- **Resumen ejecutivo:** conclusión, evidencias clave, riesgo o decisión, siguiente acción.
- **Investigación:** pregunta, método o alcance, hallazgos con fuente y fecha, incertidumbre, implicación.
- **Agente BUO:** objetivo, entradas, reglas, decisiones, salidas, errores, trazabilidad y pruebas.

Lee `references/plantillas.md` solo si debes producir una pieza formal o un prompt para otro agente. Lee `references/evaluacion.md` cuando debas auditar la calidad de un texto. Lee `references/glosario-buo.md` cuando trabajes sobre terminología BUO. Consulta el diccionario canónico `docs/BUO_DICCIONARIO.md` si está disponible en el repositorio; si no lo está, informa la limitación y utiliza la referencia del paquete únicamente cuando sea accesible. Usa `references/gobernanza.md` para evaluar propuestas de cambios de versión.

## Evolución y gobierno

El estándar se versiona y se actualiza únicamente después de aprobar cambios y superar las pruebas. Consulta `references/gobernanza.md` antes de proponer una nueva regla. Un agente puede detectar errores, abrir propuestas y redactar un cambio, pero no puede aprobarlo ni cambiar por sí mismo el estándar en producción.

- Núcleo CCE-100: principios transversales de comunicación.
- Perfil BUO: reglas específicas de agentes, informes y riesgos, documentadas por separado.
- Los cambios se validan en un conjunto de ejemplos y con revisión humana.
- Cada despliegue registra versión y permite volver a la anterior.

## Diccionario BUO: detección y mejora continua

En toda tarea relacionada con BUO, consulta primero el diccionario disponible. Usa una denominación por concepto. Distingue términos del diccionario base y propuestas pendientes.

Si detectas un concepto nuevo y relevante, una sigla no definida, un sinónimo contradictorio o una definición que cause ambigüedad, prepara una **propuesta** con término, definición tentativa, dominio y referencia de origen. Hazlo solo si existe evidencia. No inventes fuentes ni extraigas datos personales.

Si tienes acceso autorizado de escritura a un repositorio BUO, agrega la propuesta a la sección de candidatos mediante `.cce-100/scripts/glossary_ingest.py` (si está instalado en BUO) o un mecanismo equivalente sin sobrescribir el diccionario base. Cuando no tengas ese acceso, entrega la propuesta en formato compatible con `.cce-100/PROMPT_EXTRACTOR_DICCIONARIO.md` si está instalado; **no afirmes que el archivo fue actualizado**.

La curación es continua; una revisión semanal decide sobre propuestas. La revisión mensual evalúa inconsistencias, vigencia de definiciones y efectos sobre respuestas e informes. Únicamente los cambios aprobados y probados pasan a una nueva versión del diccionario base. Los nuevos términos pendientes nunca se convierten automáticamente en instrucciones del motor BUO.

## Control de calidad antes de entregar

Verifica silenciosamente:

- ¿La primera parte responde a la petición?
- ¿Cada instrucción tiene una acción y un resultado comprobable?
- ¿Las referencias a actores, objetos y fechas son inequívocas?
- ¿Se conservaron cifras, fuentes, términos legales y restricciones?
- ¿Se distingue hecho de inferencia?
- ¿El formato ayuda, o añade trabajo visual?

Corrige antes de entregar. No publiques la lista de control salvo solicitud explícita.

## Casos ilustrativos

**No recomendado:** «Se procederá a realizar la respectiva validación de las diferentes fuentes para posteriormente efectuar la generación del reporte.»

**Preferido:** «Consulta las fuentes autorizadas. Valida los resultados. Genera el informe.»

**No recomendado:** «BUO encontró información insuficiente. El cliente no presenta riesgo.»

**Preferido:** «No hay datos suficientes para estimar el riesgo. Identifica las fuentes que faltan antes de tomar una decisión.»

## Referencia oficial

ASD-STE100 Simplified Technical English, Issue 9, 15 de enero de 2025: https://www.asd-ste100.org/ . Las reglas y ejemplos de esta skill están redactados de manera original y no sustituyen esa publicación.

# Revisión F2

- Autor: agente principal en rol Revisor, tras entrega como Implementador. AUTORREVISIÓN TÉCNICA, no auditoría independiente. Se solicita revisión del usuario.
- Fecha: 2026-10-31. Base Git: ff0ca8f5421917a2378316d1e6186faba7d4c5bc.
- Alcance revisado: archivos F2 documentados en feature_list.json e impl_F2.md, incluidos archivos nuevos, diff de trabajo y diff de staging (vacío). Cambios previos de F1/arnés y .gitignore preservados. La revisión F1 previa no certifica los cambios posteriores en archivos compartidos.
- Excepción: usuario autorizó expresamente F2 mientras F1 sigue en_revision, sin commit ni push. La autorización se conserva en el registro y el verificador solo admite esta combinación; no admite una tercera feature activa.
- Comandos: git diff --check (0), git diff --cached --stat (0, vacío), git status --short (0), git rev-parse HEAD (0), lectura de código y archivos nuevos, node scripts/verificar.mjs (0).
- Evidencia final: .arnes/2026-10-31T06-46-23-155Z-24144.log y .arnes/revision-F2-final.log. 13 pruebas aprobadas, cero fallos y cero omitidas; Vite compila 29 módulos. El verificador Docker comprueba salud, interfaz, API, persistencia tras reinicio y recreación, ausencia de exposición de MongoDB y fallo controlado sin confirmar escritura al detener la base. Recursos temporales retirados.

| Criterio F2 | Evidencia |
| --- | --- |
| 1. Esquemas, campos, tipos y límites | esquemas-mongodb.js v1 define capital/estado, movimiento, suscripción y comprobante, reutiliza catálogos y conserva IDs. esquemas-mongodb.test.js inserta documentos compatibles F1, acepta escrituras válidas y rechaza con código Mongo 121 capital negativo/fraccionario/excesivo/Decimal128, revision inválida, importe inválido, UUID, categorías/métodos, descripción, fecha, referencia, día, nombre, activo, campos obligatorios y datos de comprobantes inválidos. Prueba límites válidos de capital y día. |
| 2. Lecturas por recurso | recursos-api.test.js verifica capital, listas y detalles de movimientos y suscripciones, categorías y métodos; listas vacías, inexistentes 404, saldo recalculado y lecturas desde otra conexión sin caché obsoleta. |
| 3. Escrituras y comprobantes | Suite conserva CRUD anterior e identificadores. PUT/DELETE receipts cubren adjuntar, reemplazar, retirar, 404, entrada inválida, PDF/PNG/JPEG/WebP, 5 MiB exactos, rechazo de un byte adicional, reconexión y bytes descargados. El borrado retira referencia, no documentos históricos. |
| 4. Cliente centralizado | cliente-api.test.js prueba todos los llamados nombrados, método, URL, codificación de ID, cabecera, cuerpo, estado devuelto, descarga Blob, 404/500, error de red, respuesta sin JSON e identificador vacío. main.jsx usa llamados nombrados para los flujos existentes; Forms reexporta api para compatibilidad. |
| 5. Compatibilidad e idempotencia | prepararEsquemas comprueba ambas colecciones antes de modificar validadores, conserva documentos compatibles F1 y soporta arranque repetido. Prueba de corrupción estructural rechaza arranque en estado/comprobantes, conserva datos y no instala validadores sobre colección incompatible. No migración automática ni modificación de datos reales. |
| 6. Contrato y documentación | docs/openapi.json describe 20 operaciones, entradas, respuestas, adjuntos y errores; recursos-api.test.js exige ejercicio de cada operación documentada y referencias de esquemas resolubles. README explica esquema, diferencia entre validación estructural Mongo y reglas HTTP, permisos de inicio, llamadas y ejemplos sin credenciales. No se agregó un servidor de documentación. |
| 7. Arnés y alcance | Verificación completa código 0 con pruebas Mongo/HTTP/cliente, sintaxis disponible y build. La etapa de pruebas Docker incluye módulo cliente y OpenAPI; la imagen de ejecución mantiene estructura F1. Ajuste acotado de excepción en el verificador. Sin dependencias nuevas, cambios visuales, secretos, JSON real, staging, commit ni push. |

N1: APROBADO para comprobaciones disponibles. Lint y typecheck NO CONFIGURADO en raíz/backend/frontend; sintaxis no los sustituye. No se afirma validación con un validador OpenAPI externo: se verifica JSON, referencias internas y cobertura de operaciones sin instalar infraestructura adicional.
N2: 13 pruebas ejecutables y comprobaciones Docker cubren éxito, datos inválidos y bordes de los módulos/rutas nuevos. Los GET sin cuerpo no admiten validación de entrada de negocio; catálogos no tienen escritura por diseño. No hay UI nueva. Pruebas de cliente cubren integración de llamadas sin una suite de navegador nueva. La protección del arnés se comprobó además con su función real en VM: excepción válida, falta de autorización, tercera feature, F1 en estado incorrecto y caso normal; cinco comprobaciones aprobadas.
N3: archivos dentro del alcance registrado, trabajo previo preservado y diff --check sin errores. Los cambios necesarios en Dockerfile solo empaquetan pruebas, sin cambiar infraestructura de ejecución. F1 y F2 permanecen en revisión por autorización explícita.

Limitaciones: no existe auditor independiente. Mongo valida estructura/rangos/catálogos y HTTP completa fechas, firmas y tamaño decodificado. Permanecen límites de metadatos BSON y conservación física de adjuntos históricos de F1. El usuario de Mongo requiere permisos para listCollections/createCollection/collMod además de lectura/escritura.

Veredicto: APROBADO.

Este es un veredicto de autorrevisión técnica. Próximo paso: revisión del usuario; cualquier commit requiere autorización explícita. No se marca hecha ni se hace push.

## Revisión integrada para publicación F1-F4

- Agente principal, rol Revisor; autorrevisión explícita, no independiente. Usuario solicita publicar F1-F4 después de conocer esta limitación.
- Base ff0ca8f5421917a2378316d1e6186faba7d4c5bc. Integración final completa revisada, sin implementación F5; arnes.md previo ajeno queda fuera. .gitignore solo incorpora exclusión necesaria de logs del arnés.
- Init completo código 0: 21/21, UI real y build. Log .arnes/2026-11-02T04-42-04-990Z-18932.log y .arnes/revision-publicacion-F1-F4.log; diff --check 0, staging previo vacío.
- Criterios originales se interpretan junto con cambios posteriores expresamente aprobados: F3 sustituye contenedor combinado por frontend :3002/backend :3001/Mongo, y F4 exige sesión/CSRF y conserva datos anteriores sin asignar. No se afirma UI en :3001 ni finanzas públicas.
- Código y dependencias compartidos se entregan atómicamente como integración final, sin reconstruir instantáneas históricas artificiales. Referencia de commit: feat(F4): integrar Docker, MongoDB, API y usuarios de F1 a F4.
- N1/N2/N3 aprobados para esta integración; lint/typecheck NO CONFIGURADO, sin auditor independiente. Veredicto: APROBADO.

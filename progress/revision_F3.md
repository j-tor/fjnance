# Revisión F3

- Autor: agente principal como Revisor. AUTORREVISIÓN TÉCNICA, no auditoría independiente; se solicita revisión del usuario.
- Fecha: 2026-11-01. Base Git: ff0ca8f5421917a2378316d1e6186faba7d4c5bc.
- Diff revisado: archivos nuevos/modificados de F3, sustitución del Dockerfile raíz por Dockerfiles de componentes, git diff, git diff --cached (vacío), git status y código de servidor/proxy/comando/tests. Cambios anteriores de F1/F2 y del arnés preservados. Sus revisiones antiguas no certifican los cambios posteriores de archivos compartidos.
- Aprobación: F3 y excepción F1/F2/F3 confirmadas por usuario el 2026-11-01, sin commit ni push. Se ajustó frontend a 3002 por ocupación comprobada de 3000 por otro proyecto, que permaneció intacto.
- Comandos: git diff --check (0); consultas Git (0); node --test backend/test/entorno.test.js (0, 3/3); node scripts/verificar.mjs completo sobre versión final (0); cinco comprobaciones de excepción usando la función real del verificador en VM (0).
- Log final: .arnes/2026-11-01T22-29-02-804Z-30764.log y .arnes/revision-F3-definitiva.log. 16 pruebas aprobadas, cero fallos/omitidas y Vite 29 módulos. Excepción: .arnes/F3-excepcion.log.

| Criterio F3 | Evidencia |
| --- | --- |
| 1. Tres servicios y división real | Compose declara frontend/backend/mongodb con Dockerfiles propios. Driver exige servicios saludables, frontend HTML/JS y backend JSON API; / e index/assets devuelven 404 en backend. Verifica que backend no tiene /app/frontend/dist. Entorno habitual quedó con los tres saludables, frontend :3002 y backend :3001. |
| 2. Contratos, proxy y errores | Suite conserva contratos F1/F2 y 20 operaciones OpenAPI. Proxy prueba escritura con Origin legítimo, PDF de 5 MiB y bytes descargados, entrada inválida 400, cuerpo excesivo 413 JSON, endpoint/asset ausente 404, Host y Origin ajenos 403, caída de backend 502 JSON mientras frontend conserva HTML 200 y recuperación. |
| 3. Volumen y credenciales | Pruebas aisladas conservan datos sintéticos tras restart y down/up; entorno habitual se actualizó recuperando credenciales Docker, compilando antes de detener aplicacion y conservando fjnance_datos_mongodb. Comparación en memoria verificó credenciales y estado financiero idénticos antes/después, sin registrarlos; solo consultas GET en base habitual. Evidencia .arnes/F3-despliegue.log. |
| 4. Redes y exposición | Mongo sin puertos al host, backend y frontend en loopback; frontend no pertenece a red interna Mongo. Inspección de puertos/redes y pruebas Host/Origin en driver. Proxy conserva cabeceras y resuelve backend vía DNS Docker al recrearse. |
| 5. Arranque y protección de datos | entorno.test.js cubre volumen nuevo, credenciales guardadas, codificación, credenciales parciales, volumen existente sin credenciales, credenciales externas originales, orden build/stop/up, ausencia de eliminación de volumen, status/stop, argumento inválido y Docker ausente. CLI real falla con código 1 y diagnóstico controlado sin salida de configuración. Arranque real autorizado completó código 0 y reutilizó credenciales/volumen. |
| 6. Verificación/documentación | Arnés completo 0 con 16 pruebas, sintaxis disponible y build. README explica tres servicios, puertos, comandos sin variables, preservación de credenciales/volumen, separación local y pruebas aisladas. Descripción del stack actualizada sin crear políticas alternativas. |

N1: validaciones disponibles aprobadas. Lint/typecheck NO CONFIGURADO en raíz/backend/frontend; sintaxis no los sustituye.
N2: casos de éxito, validación inválida y bordes en módulos/comandos/rutas modificadas. Sin UI nueva ni cambios visuales; pruebas HTTP de HTML/JS y cliente cubren transporte, no se presentan como suite de navegador. El rechazo del volumen sin credenciales se prueba con configuración simulada, sin ensayar destrucción sobre datos reales.
N3: diff ceñido al alcance F3 y cambios previos preservados; sin secretos en archivos/logs, staging, commit ni push. Datos reales no usados para pruebas. Solo se retiró el contenedor combinado de fjnance tras recuperar configuración y construir nuevas imágenes; Mongo habitual permaneció activo. Recursos temporales aislados retirados.

Despliegue autorizado después de revisión de código: rol Líder para operación habitual. Los tres servicios quedaron saludables, GET frontend / y /api/health y backend /api/health HTTP 200; backend / 404 JSON. nginx -t código 0. Volumen, credenciales y estado financiero conservados. Ningún servicio del otro proyecto que ocupa 3000 fue detenido.

Limitaciones: autorrevisión, sin auditor independiente; lint/typecheck no configurados. Credenciales generadas permanecen en configuración de contenedores: usar docker:stop para conservarlas; si se eliminan todos los contenedores, se requieren credenciales originales externas para reutilizar el volumen. Mantiene los límites de metadatos/adjuntos históricos de F1 y acceso local sin TLS/autenticación de aplicación.

Veredicto: APROBADO.

F1/F2/F3 permanecen en_revision por excepción autorizada. Se solicita revisión del usuario antes de cualquier commit; no se marcan hechas ni se publica nada.

## Revisión integrada para publicación F1-F4

- Agente principal, rol Revisor; autorrevisión explícita, no independiente. Usuario solicita publicar F1-F4 después de conocer esta limitación.
- Base ff0ca8f5421917a2378316d1e6186faba7d4c5bc. Integración final completa revisada, sin implementación F5; arnes.md previo ajeno queda fuera. .gitignore solo incorpora exclusión necesaria de logs del arnés.
- Init completo código 0: 21/21, UI real y build. Log .arnes/2026-11-02T04-42-04-990Z-18932.log y .arnes/revision-publicacion-F1-F4.log; diff --check 0, staging previo vacío.
- Criterios originales se interpretan junto con cambios posteriores expresamente aprobados: F3 sustituye contenedor combinado por frontend :3002/backend :3001/Mongo, y F4 exige sesión/CSRF y conserva datos anteriores sin asignar. No se afirma UI en :3001 ni finanzas públicas.
- Código y dependencias compartidos se entregan atómicamente como integración final, sin reconstruir instantáneas históricas artificiales. Referencia de commit: feat(F4): integrar Docker, MongoDB, API y usuarios de F1 a F4.
- N1/N2/N3 aprobados para esta integración; lint/typecheck NO CONFIGURADO, sin auditor independiente. Veredicto: APROBADO.

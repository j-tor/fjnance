# Revisión F1

- Autor: agente principal, alternando explícitamente al rol Revisor tras entrega del Implementador. AUTORREVISIÓN TÉCNICA; no auditoría independiente. Se solicita revisión del usuario.
- Fecha: 2026-10-31. Base: ff0ca8f5421917a2378316d1e6186faba7d4c5bc.
- Diff revisado: cambios F1 del árbol de trabajo, sin staging; git diff, git diff --cached --stat (vacío), git status y archivos nuevos del alcance. Cambios previos de .gitignore y arnés preservados, sin inclusión en commit.
- Comandos: git diff --check (0); git rev-parse HEAD (0); consultas Git (0); lectura de archivos nuevos y diff; node scripts/verificar.mjs (0).
- Log: .arnes/2026-10-31T06-32-12-847Z-31052.log y .arnes/revision-F1-final.log.

| Criterio F1 | Evidencia |
| --- | --- |
| 1. Compose, salud, interfaz y API | scripts/probar-docker.mjs valida config --quiet, up --build --wait; comprueba HTML, /api/health, /api/state y capital. Servicios saludables en log. |
| 2. Contratos y CRUD | 4 pruebas legadas y 3 pruebas MongoDB pasan; edición/eliminación, capital, categorías, métodos, suscripciones, comprobantes, HTTP inválido y saldos. No cambios de rutas ni IDs. |
| 3. Persistencia de volumen | Capital sintético 12345 conservado tras restart de ambos servicios y down/up; limpieza de volumen exclusivamente al finalizar el proyecto aleatorio de pruebas. |
| 4. Red y credenciales | Docker inspect verifica loopback de aplicación y ausencia de puertos publicados de Mongo. Compose exige credenciales del proceso; verificador usa credenciales aleatorias, oculta su valor y no imprime configuración expandida. .dockerignore excluye secretos y datos JSON. |
| 5. Fallos, consistencia y cierre | Configuración inválida y puerto Mongo inaccesible probados. Suite detecta revisión obsoleta con 409, escrituras concurrentes y cliente cerrado. Prueba Docker detiene Mongo, exige 500 en salud/escritura y comprueba capital inalterado al recuperarse. SIGTERM cierra servidor y cliente durante restart/down. |
| 6. Aislamiento y límites | Bases fjnance_test_UUID creadas y eliminadas por helper con prefijo y formato protegidos; proyecto, volumen y credenciales efímeros por ejecución. Persistencia tras reconexión, PDF de 5 MiB, rechazo de 5 MiB + 1 byte y recuperación de bytes exactos. |
| 7. Arnés completo | node scripts/verificar.mjs devuelve 0; npm test ejecuta 7/7, sin skips; Vite compila 28 módulos. Root test ejecuta la verificación Docker sin omisiones; Docker ausente provoca fallo explícito. |
| 8. Documentación y JSON | README contiene prerrequisitos, variables, arranque, pruebas, parada y conservación, limpieza exclusiva de pruebas y desarrollo local. backend/data excluido del contexto y no modificado. |

N1: verificación completa código 0. Brecha preexistente: lint y typecheck NO CONFIGURADO en raíz, backend y frontend; la comprobación de sintaxis no los sustituye.
N2: éxito, validación inválida y bordes cubiertos por suites y verificador Docker. No hay UI nueva. Limpieza de una base real no se prueba destructivamente: el helper solo genera nombres UUID internos e impide otros formatos. Corrupción manual de documentos por terceros queda fuera del contrato API.
N3: diff de implementación ceñido al alcance, sin staging, secretos ni datos reales; cambios previos preservados. No commit ni push.

Limitaciones aceptadas del entorno local: una instancia de aplicación; metadatos del estado sujetos a 16 MiB BSON; comprobantes desreferenciados se conservan físicamente para no eliminar referencias ante fallos; sin migración automática de JSON. npm ci del frontend informó una vulnerabilidad alta preexistente: actualización fuera de F1. Recursos temporales Docker eliminados al concluir.

Veredicto: APROBADO.

El veredicto es técnico y de autorrevisión, no independiente. F1 permanece en_revision hasta revisión del usuario y autorización explícita de commit; no se marca hecha ni se publica.

## Revisión integrada para publicación F1-F4

- Agente principal, rol Revisor; autorrevisión explícita, no independiente. Usuario solicita publicar F1-F4 después de conocer esta limitación.
- Base ff0ca8f5421917a2378316d1e6186faba7d4c5bc. Integración final completa revisada, sin implementación F5; arnes.md previo ajeno queda fuera. .gitignore solo incorpora exclusión necesaria de logs del arnés.
- Init completo código 0: 21/21, UI real y build. Log .arnes/2026-11-02T04-42-04-990Z-18932.log y .arnes/revision-publicacion-F1-F4.log; diff --check 0, staging previo vacío.
- Criterios originales se interpretan junto con cambios posteriores expresamente aprobados: F3 sustituye contenedor combinado por frontend :3002/backend :3001/Mongo, y F4 exige sesión/CSRF y conserva datos anteriores sin asignar. No se afirma UI en :3001 ni finanzas públicas.
- Código y dependencias compartidos se entregan atómicamente como integración final, sin reconstruir instantáneas históricas artificiales. Referencia de commit: feat(F4): integrar Docker, MongoDB, API y usuarios de F1 a F4.
- N1/N2/N3 aprobados para esta integración; lint/typecheck NO CONFIGURADO, sin auditor independiente. Veredicto: APROBADO.

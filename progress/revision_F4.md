# Revisión F4

- Autor: agente principal alternando explícitamente al rol Revisor tras entregas del Implementador. AUTORREVISIÓN TÉCNICA, no auditoría independiente. Se solicita revisión del usuario.
- Fecha local: 2026-11-01 (logs en UTC 2026-11-02). Base Git: ff0ca8f5421917a2378316d1e6186faba7d4c5bc.
- Aprobación: usuario aprueba todo el alcance F4 y excepción F1/F2/F3/F4, sin commit ni push. Estados anteriores preservados; revisiones F1/F2/F3 no certifican modificaciones posteriores en archivos compartidos.
- Alcance revisado: diff de trabajo y archivos nuevos del alcance de feature_list.json/impl_F4.md; git diff --cached vacío, consultas Git y git diff --check sin errores. Sin staging, commit ni push. No se presentó una autorrevisión como independiente.
- Verificación final: node scripts/verificar.mjs código 0; 20 pruebas aprobadas, cero fallos/omitidas, navegador real y build Vite de 32 módulos. Log .arnes/2026-11-02T03-39-32-218Z-29136.log y .arnes/F4-validacion-entrega.log. Pruebas de excepción del arnés con función real en VM: cinco escenarios aprobados; .arnes/F4-excepcion.log.

| Criterio F4 | Evidencia |
| --- | --- |
| 1. Cuentas y contraseñas | usuarios.test.js y UI real registran, acceden, consultan sesión/perfil, cierran y cambian clave. Hash scrypt con sal aleatoria verificado, clave incorrecta y longitudes inválidas rechazadas. DTO públicos no incluyen hash. Duplicados controlados y fixtures entran por autenticación real. |
| 2. Propiedad y aislamiento | Estado/repositorio locales a cada petición autenticada, colecciones nuevas por propietario. Prueba de dos usuarios exige 404 para GET/PUT/DELETE de movimiento, suscripción y comprobante ajenos; envío de propietario no altera cuenta ajena. Usuario y admin no leen movimientos de otra cuenta. Sin sesión, finanzas/descargas/escrituras dan 401. Navegador cambia de Ana a Bruno y no muestra el movimiento de Ana. |
| 3. Sesión/CSRF/expiración | Cookies HttpOnly/SameSite, hash del token, expiración verificada antes de usar sesión. Pruebas cubren sesión consultada 200 sin hash, rotación con cookie anterior 401, logout, cambio de clave, expiración forzada, bloqueo y revocación. Se rechaza CSRF ausente, challenge inválido y límites 429. Versión de acceso actualizada atómicamente impide usar una sesión obsoleta reinsertada aun si falla su eliminación física. Cliente ignora 401 de sesión anterior y UI guarda identidad/secuencia de cargas para no mezclar cuentas. |
| 4. Roles y bootstrap | Registro público rechaza rol/activo y solo asigna usuario. Rutas de listado/auditoría/acción admin dan 403 a usuario común. Bootstrap crear-admin.mjs probado contra base exclusiva y mediante CLI en contenedor aislado; no imprime credenciales ni cambia cuenta registrada. No se creó administrador real. |
| 5. Administración | Usuarios.test.js verifica búsqueda literal/página inválida y página 2 con cuentas sintéticas, bloqueo/reactivación/revocación y rechazo de autobloqueo/actuación sobre admin/acción inválida/usuario ausente. Auditoría actor/destinatario/acción/fecha sin contenido financiero ni secretos. UI muestra fecha de creación, paginación y acciones accesibles en móvil. Logs de Nginx suprimidos y comprobación del driver confirma ausencia de URLs de búsquedas administrativas. |
| 6. Interfaz ejecutable | scripts/probar-usuarios-ui.mjs usa Edge/Chrome instalado y CDP de Node con perfil temporal, sin descargas ni frameworks. Verifica registro, acceso incorrecto/correcto, movimiento privado, salida, cambio de clave, separación entre cuentas, navegación/permisos y bloqueo/reactivación admin. Escritorio 1365 px y móvil 390 px sin desbordamiento horizontal. Capturas sintéticas .arnes/F4-*.png inspeccionadas en dos pases visuales acotados; ajuste móvil único con acciones visibles y nombres legibles. |
| 7. Datos/índices/compatibilidad | Validadores e índices únicos/TTL idempotentes. Suites financieras previas adaptadas a cuentas autenticadas; no existe interruptor de desactivación de autorización. Colecciones legadas se conservan sin asignación. Despliegue compara en memoria huella de estado/comprobantes legados, credenciales y volumen antes/después y confirma igualdad, sin mostrar contenido; no crea cuentas reales. |
| 8. Arnés/documentación | Init completo 0 con 20 pruebas, UI real y build. OpenAPI v2 describe 29 operaciones con sesión/CSRF y errores; suite financiera comprueba sus 20 operaciones y usuarios.test.js cubre las 9 de autenticación/admin. README incluye esquema, roles, límites, bootstrap por stdin y conservación de datos. Descripción del stack actualizada. |

N1: comprobaciones disponibles aprobadas. Lint/typecheck NO CONFIGURADO en raíz/backend/frontend; sintaxis no los sustituye. La UI tiene pruebas ejecutables de navegador, no solo compilación JSX. No se instaló infraestructura ni dependencias nuevas; falta de navegador existente provoca fallo explícito.
N2: éxito, validación inválida y bordes cubiertos para funciones/rutas nuevas y regresión financiera. La conservación de una sesión obsoleta se simula mediante reinserción de su documento, sin provocar daños en una base real. Pruebas y bootstrap sintéticos usan bases/proyecto/volumen aislados.
N3: cambios ceñidos al alcance registrado, sin secretos en archivos ni logs, datos reales de pruebas, staging, commit ni push. Trabajo previo preservado. F4 en_revision con excepción aprobada; no se marca hecha.

Hallazgos corregidos durante revisión: respuestas antiguas tras cambio de identidad, consultas administrativas en logs del proxy e invalidación de acceso atómica además de eliminación de sesiones. Cada cambio se entregó al Implementador y se volvió a verificar antes de aprobar.

Evidencia operativa posterior a revisión, rol Líder: .arnes/F4-despliegue.log. Frontend :3002, backend :3001 y MongoDB interno saludables. GET / y /api/health 200; /api/state, /api/expenses y /api/auth/sesion anónimos 401. API directa saludable y nginx -t 0. Mismos volumen/credenciales, datos legados idénticos por comparación en memoria y ningún usuario real creado durante actualización. No se ejecutaron pruebas de escritura contra base habitual.

Limitaciones documentadas: entorno HTTP local, Secure exige HTTPS/configuración del proceso, sin verificación de propiedad del correo ni recuperación por email/MFA/OAuth. Registro duplicado genera 409 genérico y no se afirma impedir toda enumeración por registro. Límite por dirección puede agrupar usuarios detrás de proxy. Auditoría registra intención antes de cambiar acceso. Datos antiguos no se transfieren automáticamente. Crear administrador requiere datos elegidos por su titular en la terminal; nunca se eligen ni solicitan contraseñas en el chat.

Veredicto: APROBADO.

El veredicto es de autorrevisión técnica. Se solicita revisión del usuario; F1/F2/F3/F4 permanecen en_revision. Cualquier commit y cualquier push requieren autorizaciones correspondientes, que no fueron otorgadas ni ejecutadas.

## Ampliación autorizada: seed literal de desarrollo

- Usuario pidió explícitamente crear un Markdown con contraseñas literales de prueba y ejecutar un seed para admin y Jeffrey Torres, sin ventanas. Esa autorización posterior sustituye para estas dos cuentas la restricción previa de credenciales; no aplica a .env ni a secretos MongoDB/infraestructura.
- Rol Implementador: backend/scripts/seed-desarrollo.mjs, CUENTAS_DESARROLLO.md, backend/test/seed-desarrollo.test.js y empaquetado del seed en etapa Docker de pruebas. Rol Revisor: diff/archivos nuevos y ejecución del arnés completo; continúa siendo autorrevisión técnica, no independiente.
- Seed ejecutado contra entorno habitual código 0: crea si faltan, o restablece claves/activo/versiones y revoca sesiones solo de las dos identidades de desarrollo coincidentes. Prevalida ambas antes de escribir, rechaza nombre/rol distintos, no borra cuentas/movimientos, conserva IDs y no afecta otras cuentas.
- Acceso HTTP real y permisos comprobados: admin puede acceder a administración (200), usuario ordinario recibe 403; sesiones de comprobación cerradas. No se abrieron nuevas ventanas ni se pidieron contraseñas tras la última instrucción.
- Prueba aislada cubre creación, repetición sin duplicación, claves/roles, preservación de capital/otra cuenta, revocación de sesión y rechazo previo por identidad distinta sin cambiar admin.
- Comandos: node backend/scripts/seed-desarrollo.mjs (0); verificación HTTP (0); node scripts/verificar.mjs (0, 21/21, UI real y build). Log .arnes/2026-11-02T04-04-07-916Z-37736.log y .arnes/F4-seed-validacion.log.
- Lint/typecheck NO CONFIGURADO. No auditor independiente; se solicita revisión del usuario del seed/Markdown. Sin staging, commit ni push.
- Veredicto de ampliación: APROBADO. F4 permanece en_revision.

## Revisión integrada para publicación F1-F4

- Agente principal, rol Revisor; autorrevisión explícita, no independiente. Usuario solicita publicar F1-F4 después de conocer esta limitación.
- Base ff0ca8f5421917a2378316d1e6186faba7d4c5bc. Integración final completa revisada, sin implementación F5; arnes.md previo ajeno queda fuera. .gitignore solo incorpora exclusión necesaria de logs del arnés.
- Init completo código 0: 21/21, UI real y build. Log .arnes/2026-11-02T04-42-04-990Z-18932.log y .arnes/revision-publicacion-F1-F4.log; diff --check 0, staging previo vacío.
- Criterios originales se interpretan junto con cambios posteriores expresamente aprobados: F3 sustituye contenedor combinado por frontend :3002/backend :3001/Mongo, y F4 exige sesión/CSRF y conserva datos anteriores sin asignar. No se afirma UI en :3001 ni finanzas públicas.
- Código y dependencias compartidos se entregan atómicamente como integración final, sin reconstruir instantáneas históricas artificiales. Referencia de commit: feat(F4): integrar Docker, MongoDB, API y usuarios de F1 a F4.
- N1/N2/N3 aprobados para esta integración; lint/typecheck NO CONFIGURADO, sin auditor independiente. Veredicto: APROBADO.

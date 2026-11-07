# fjnance: frontend, backend y MongoDB

El proyecto ejecuta tres contenedores independientes:

| Servicio | Imagen/función | Acceso |
| --- | --- | --- |
| frontend | React compilado con Vite, servido por Nginx | http://localhost:3002 |
| backend | API HTTP nativa de Node.js | http://localhost:3001/api/health |
| mongodb | MongoDB 8, volumen persistente | Solo red interna |

Cada componente tiene su Dockerfile: frontend/Dockerfile y backend/Dockerfile. Compose usa contexto raíz para compartir shared/. El backend no contiene ni sirve la interfaz; su ruta / devuelve 404 JSON. El frontend redirige /api/ al backend conservando Host y Origin. No necesitas configurar CORS para usar la interfaz. El frontend no accede a la red de MongoDB.

## Arranque habitual

Requiere Docker Desktop/Engine con contenedores Linux y Compose, y Node.js >=22 con npm. Desde la raíz:

~~~powershell
npm.cmd run docker:up
~~~

El comando recupera las credenciales de MongoDB desde su contenedor existente, sin imprimirlas ni crear archivos secretos. Conserva el volumen fjnance_datos_mongodb y la base existente. En una instalación totalmente nueva, sin volumen ni credenciales, genera las credenciales e inicializa MongoDB en Docker. Si el volumen existe pero las credenciales no pueden recuperarse, se detiene y solicita las originales; no borra ni reinicializa la base.

Al actualizar desde la versión con el contenedor aplicacion, compila las imágenes antes de detenerlo, recupera primero la configuración y después lo sustituye por frontend y backend. MongoDB conserva su volumen. El comando no ejecuta pruebas contra la base habitual.

~~~powershell
npm.cmd run docker:status
npm.cmd run docker:stop
# Volver a iniciar, sin introducir variables:
npm.cmd run docker:up
~~~

Abre http://localhost:3002. El comando stop conserva contenedores y volumen; las credenciales generadas permanecen en la configuración Docker. No elimines esos contenedores ni uses compose down en el entorno habitual si no tienes las credenciales originales guardadas externamente. No uses down --volumes: elimina los datos. No se crea ni modifica ningún archivo .env.

El JSON anterior backend/data/finance.json se conserva intacto y no se importa automáticamente. Los comprobantes retirados de la interfaz conservan su documento físico; la depuración queda fuera de estas features. Los metadatos del estado siguen sujetos a 16 MiB BSON y se prevé una sola instancia del backend. MongoDB no se instala en Windows.

## Configuración avanzada

El comando habitual no exige variables. Para usar directamente docker compose, debes proporcionar en el proceso las credenciales originales MONGO_USUARIO y MONGO_CLAVE y sus versiones URI MONGO_USUARIO_URI y MONGO_CLAVE_URI. Cambiarlas no cambia usuarios de un volumen ya inicializado. No compartas la salida de compose config sin --quiet: incluye valores expandidos.

| Variable | Uso |
| --- | --- |
| MONGO_USUARIO / MONGO_CLAVE | Credenciales de inicialización MongoDB; el comando las recupera o genera solo para volumen nuevo. |
| MONGO_USUARIO_URI / MONGO_CLAVE_URI | Credenciales codificadas para URI, calculadas automáticamente por el comando. |
| MONGO_BASE | Base predeterminada fjnance; el comando conserva la configurada en el backend anterior. |
| PUERTO_FRONTEND | Puerto local del frontend; predeterminado 3002. |
| PUERTO_BACKEND | Puerto local de API; predeterminado 3001. |
| MONGODB_URI / MONGODB_DATABASE | Conexión y base para ejecutar backend fuera de Docker. |
| HOST / PORT | Backend local: 127.0.0.1 y 3001 por defecto. |
| MONGODB_TEST_URI | URI de pruebas directas del backend; npm test en raíz la configura en recursos aislados. |

El frontend tiene salud local en /salud y la API comprueba MongoDB en /api/health. Compose espera MongoDB saludable antes del backend y backend saludable antes del frontend. Nginx resuelve el backend mediante DNS de Docker para seguir funcionando tras recreaciones ([proxy_pass oficial](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass)). Este es un entorno local sin TLS ni autenticación de aplicación; se conserva el usuario MongoDB existente.

## Verificación y pruebas

~~~powershell
npm.cmd --prefix frontend ci
npm.cmd --prefix backend ci
node scripts/verificar.mjs
~~~

La verificación completa ejecuta comprobaciones disponibles, npm test y build. Lint y typecheck NO CONFIGURADO. No instala Docker ni dependencias automáticamente.

~~~powershell
npm.cmd test
~~~

Las pruebas construyen frontend/backend separados y MongoDB en un proyecto aleatorio con puertos dinámicos, credenciales efímeras, bases UUID y volumen propio. Verifican contratos HTTP, cliente, esquemas, comando de arranque con configuración simulada, proxy, archivos estáticos, firmas/adjuntos de 5 MiB, errores, Host/Origin, aislamiento, reinicios y conservación de datos. MongoDB/backend detenidos provocan errores controlados y el frontend puede seguir sirviendo HTML con el backend parado. Al terminar se eliminan únicamente los recursos de prueba. No usan la base habitual.

Si se interrumpe la limpieza, identifica el proyecto fjnance-prueba-ID con docker compose ls -a y elimina solo ese proyecto mediante docker compose -p fjnance-prueba-ID down --volumes --rmi local. No uses el nombre habitual fjnance para esa limpieza.

## Desarrollo local

Con MONGODB_URI y MONGODB_DATABASE configuradas en el proceso del backend:

~~~powershell
npm.cmd --prefix backend run dev
# Otra terminal:
npm.cmd --prefix frontend run dev
~~~

Vite sirve http://127.0.0.1:5173 y redirige /api a la API local :3001. npm.cmd run build compila el frontend; npm.cmd start ejecuta exclusivamente el backend. La compilación se sirve mediante el contenedor frontend. La persistencia JSON solo se usa por pruebas legadas con directorios temporales explícitos.

## APIs y esquemas (F2)

El contrato está en [docs/openapi.json](docs/openapi.json), OpenAPI 3.0.3. La documentación es un archivo del repositorio; no se añade un servidor Swagger ni una ruta pública de documentación.

| Recurso | Métodos y rutas |
| --- | --- |
| Estado y salud | `GET /api/state`, `GET /api/health` |
| Capital | `GET /api/capital`, `PUT /api/capital` |
| Movimientos | `GET/POST /api/expenses`, `GET/PUT/DELETE /api/expenses/:id` |
| Suscripciones | `GET/POST /api/subscriptions`, `GET/PUT/DELETE /api/subscriptions/:id` |
| Comprobantes por movimiento | `GET/PUT/DELETE /api/receipts/:id` |
| Catálogos de solo lectura | `GET /api/categories`, `GET /api/methods` |

Las listas responden con arreglos JSON; el detalle responde con el recurso. Capital devuelve `{initialCapital, capital}`. Todas las escrituras exitosas devuelven el estado completo para actualizar la interfaz; POST devuelve 201 y PUT/DELETE, 200. Un detalle inexistente devuelve 404. Los importes de entrada son texto en unidades (`"125.50"`); se persisten y responden en centavos enteros. El capital disponible puede ser negativo.

Las escrituras requieren `Content-Type: application/json`, incluso DELETE (el cliente envía `{}`). El cuerpo tiene límite de 7 MiB. Los errores usan `{error: "mensaje"}`: 400 entrada inválida, 403 host/origen rechazado, 404 recurso ausente, 409 revisión obsoleta, 413 cuerpo excesivo, 415 tipo de contenido incorrecto y 500 fallo interno o de persistencia. No se confirma una escritura que falla.

`PUT /api/receipts/:id` recibe `{name, type, base64}` y adjunta o reemplaza el comprobante del movimiento. Acepta PDF, PNG, JPEG y WebP con firma válida de hasta 5 MiB decodificados. `GET` devuelve bytes descargables; `DELETE` retira la referencia y devuelve 404 si no existe. Los POST/PUT de movimientos siguen admitiendo `receipt`; al editar, omitirlo conserva el adjunto y `null` lo retira. Ninguna operación elimina físicamente documentos históricos de comprobantes.

Ejemplo local (con el entorno habitual iniciado):

```powershell
Invoke-RestMethod http://localhost:3001/api/capital
Invoke-RestMethod http://localhost:3001/api/expenses
Invoke-RestMethod -Method Put -Uri http://localhost:3001/api/capital -ContentType 'application/json' -Body '{"amount":"1000.00"}'
```

`backend/src/esquemas-mongodb.js` define la versión 1 de los esquemas, sin cambiar el formato persistido de F1. La colección `estado` contiene `_id: principal`, `revision` y `valor` con capital, movimientos y suscripciones. `comprobantes` contiene `_id` SHA-256 y el archivo en `valor`; los movimientos solo guardan su referencia. Los índices únicos de `_id` son los existentes de MongoDB. Las categorías y métodos se toman de `shared/finance.js`.

Al conectar, se comprueba que los documentos existentes cumplen los esquemas, se crean las colecciones ausentes y se aplican validadores `strict` con rechazo de escrituras inválidas. El arranque repetido es idempotente. Ante datos incompatibles, se informa colección y versión sin registrar su contenido, corregirlos o borrarlos. La validación HTTP también comprueba fechas reales/no futuras, firmas y tamaño decodificado de archivos; los esquemas MongoDB validan estructura, tipos, rangos, catálogos y referencias. El esquema no sustituye esas reglas HTTP. MongoDB no valida retroactivamente los documentos al aplicar `strict`, por eso el arranque los comprueba antes ([documentación oficial](https://www.mongodb.com/docs/manual/core/schema-validation/specify-validation-level/)).

`frontend/src/api.js` centraliza los llamados: `obtenerEstado`, `obtenerSalud`, `obtenerCapital`, `actualizarCapital`, `obtenerMovimientos`, `obtenerMovimiento`, `crearMovimiento`, `actualizarMovimiento`, `eliminarMovimiento`, los equivalentes de suscripciones, `obtenerCategorias`, `obtenerMetodos`, `descargarComprobante`, `guardarComprobante` y `eliminarComprobante`. La descarga devuelve un `Blob`; los demás devuelven JSON. Los errores HTTP incluyen `status`; errores de red o respuesta inválida producen mensajes controlados. Se conserva `api(ruta, opciones)` y su reexportación desde Forms para compatibilidad.

Las pruebas nuevas comprueban cada endpoint documentado, integridad de referencias OpenAPI, llamado cliente, validadores directos de MongoDB, datos previos compatibles/incompatibles, listas vacías, 404, límites, reconexión y errores. No se agregan dependencias. La etapa Docker de pruebas incluye el módulo cliente y el contrato; la imagen de ejecución permanece sin archivos de pruebas.

Para iniciar con esquemas, el usuario de MongoDB necesita permisos de consulta/escritura y de administración de las colecciones (`listCollections`, `createCollection`, `collMod`). Compose proporciona el usuario configurado al inicializar el volumen. No se cambian permisos ni usuarios existentes automáticamente.

## Cuentas de usuario y administración (F4)

Abre http://localhost:3002, pulsa **Crea una cuenta** y registra nombre, correo y una contraseña de 12 a 128 caracteres. La cuenta nueva comienza con capital cero y sin movimientos/suscripciones ajenos. Puedes acceder, salir, gestionar tus finanzas y cambiar la contraseña desde **Mi cuenta**. Cambiarla cierra todas tus sesiones. No hay recuperación por correo en esta versión.

Las finanzas se identifican por el usuario de la sesión, nunca por un propietario enviado en el cuerpo. Se conservan las colecciones previas `estado` y `comprobantes` sin asignarlas a ninguna cuenta. Las cuentas nuevas usan `estados_usuario` y `comprobantes_usuario`; el estado anterior no aparece al registrarse. No se ejecuta una migración de datos reales.

Las contraseñas se derivan con scrypt asíncrono (N=16384, r=8, p=5), sal aleatoria de 16 bytes y comparación segura. Nunca se guardan en claro ni se devuelven. El token aleatorio de sesión se guarda como hash en `sesiones`, con expiración de 8 horas. El servidor comprueba vencimiento/usuario activo en cada petición, además del índice TTL. La cookie usa HttpOnly y SameSite=Strict; no se almacenan tokens en localStorage. Para HTTPS debe definirse SESSION_SECURE=true en el proceso del backend; el entorno actual es HTTP local en loopback. Antes de un despliegue público deben configurarse TLS, política de recuperación y controles operativos adicionales.

Las escrituras requieren X-CSRF-Token y Content-Type application/json, también logout y DELETE. El cliente obtiene un challenge de /api/auth/csrf para acceso/registro y el token de sesión después. El challenge usa cookie HttpOnly de 10 minutos. Host/origen se validan además del CSRF. Los endpoints de acceso limitan a 20 intentos por dirección de conexión y por correo normalizado cada 15 minutos; cambiar contraseña tiene un límite independiente por usuario. Detrás del proxy local la dirección puede agrupar varios usuarios. Las credenciales incorrectas, usuarios inexistentes o bloqueados tienen el mismo error de acceso. Un registro duplicado devuelve un error genérico 409; no se verifica la propiedad del correo en esta versión.

### Crear el administrador localmente

No se crea un administrador automáticamente ni se asigna el rol al primer registro. El navegador no puede elegir privilegios. Con el entorno iniciado, ejecuta este bloque en PowerShell; los valores se solicitan en tu terminal y no se escriben en archivos:

```powershell
$nombreAdministrador = Read-Host 'Nombre del administrador'
$correoAdministrador = Read-Host 'Correo del administrador'
$claveAdministrador = Read-Host 'Contraseña (12 a 128 caracteres)' -AsSecureString
$datosAdministrador = @{
  nombre = $nombreAdministrador
  correo = $correoAdministrador
  clave = [System.Net.NetworkCredential]::new('', $claveAdministrador).Password
} | ConvertTo-Json -Compress
$datosAdministrador | docker exec -i fjnance-backend-1 node scripts/crear-admin.mjs
Remove-Variable datosAdministrador, claveAdministrador
```

Usa un correo no registrado: el comando no convierte una cuenta existente en administrador ni sobrescribe su contraseña. También existe `npm.cmd run crear-admin` para desarrollo local con URI/base Mongo configuradas; recibe el mismo JSON por entrada estándar, sin argumentos con secretos. No pegues contraseñas en este chat ni compartas la configuración de los contenedores.

Al acceder con esa cuenta aparece **Usuarios**. El panel permite buscar/paginar cuentas, bloquear/reactivar usuarios ordinarios y cerrar sus sesiones. No permite autobloqueo, actuar sobre otros administradores, asignar privilegios desde registro ni leer finanzas ajenas. Los administradores tienen su propio espacio financiero igual que cualquier cuenta. El historial conserva las últimas 100 solicitudes administrativas con actor, destinatario, acción y fecha; no incluye contraseñas, tokens ni contenido financiero. Registra la intención antes de cambiar acceso: un fallo de persistencia no devuelve éxito.

### API autenticada

El contrato OpenAPI v2 en docs/openapi.json añade:

| Ruta | Uso |
| --- | --- |
| GET /api/auth/csrf | Challenge de registro/acceso, sin sesión. |
| POST /api/auth/registro | Crear cuenta de usuario; devuelve usuario público y CSRF. |
| POST /api/auth/acceso | Crear sesión y rotar la cookie anterior. |
| GET /api/auth/sesion | Perfil público y CSRF de sesión. |
| POST /api/auth/salir | Invalidar sesión actual. |
| PUT /api/auth/clave | Verificar clave actual, cambiarla y cerrar todas las sesiones. |
| GET /api/admin/usuarios?buscar=&pagina=1 | Búsqueda literal y paginación de 20 cuentas, solo admin. |
| PUT /api/admin/usuarios/:id | Acción bloquear/activar/revocar sobre usuario ordinario. |
| GET /api/admin/auditoria | Últimas 100 solicitudes administrativas, solo admin. |

La API financiera ahora exige sesión. 401 significa acceso requerido o expirado; 403, permisos/CSRF/origen inválidos; 429, límite temporal de intentos. /api/health y el challenge permanecen públicos. El cliente centralizado maneja cookies del mismo origen, CSRF en memoria y sesión expirada. Las respuestas financieras previas mantienen su formato.

Los validadores nuevos y los índices únicos/TTL se preparan idempotentemente. `npm test` adapta las fixtures financieras al registro/acceso real y ejecuta pruebas de dos usuarios y admin, expiración, CSRF, cambio de contraseña, aislamiento de CRUD/descargas, bloqueo/revocación, bootstrap y límites. No existe un modo de producción que desactive la autorización para pruebas.

Las pruebas UI usan Edge/Chrome instalado (en Linux, Chromium/Chrome), con perfil temporal y cuentas sintéticas exclusivamente en un proyecto `fjnance-prueba-*`. Se puede indicar la ruta de un navegador ya instalado mediante NAVEGADOR_PRUEBAS. No descargan herramientas ni omiten la UI si falta navegador. Las capturas escritorio/móvil quedan en .arnes/F4-*.png. Las pruebas verifican formularios, error de acceso, registro, movimiento privado, salida, cambio de contraseña y permisos/bloqueo admin, además de ausencia de desbordamiento horizontal.

Referencias de implementación: [almacenamiento de contraseñas OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [sesiones OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) y [autorización OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).
Nginx no registra líneas de peticiones ni errores de peticiones de este servidor: las búsquedas administrativas pueden contener correos y deben permanecer fuera de los logs. La auditoría funcional autorizada se conserva en MongoDB con identificadores y acciones, sin contenido financiero ni secretos.
La invalidación usa además una versión de acceso por usuario: cambiar la contraseña o bloquear/reactivar/revocar incrementa esa versión en la misma escritura del usuario. Cada sesión debe coincidir con la versión actual. Así una sesión anterior queda rechazada incluso si falla su eliminación física posterior; las pruebas reinsertan deliberadamente una sesión obsoleta para comprobarlo.

## Cuentas, tarjetas y ahorros (F5)

En **Cuentas y tarjetas** agrega bancos, cuentas de ahorro o efectivo. El saldo de apertura distingue **Agregar capital nuevo** de **Distribuir saldo anterior**: distribuir 10 y 25 de un saldo previo de 35 conserva el total de 35. Las transferencias internas tampoco cambian el capital. Aportes y retiros sí lo cambian. El saldo previo queda visible sin distribuir hasta una decisión explícita; los gastos anteriores conservan su origen sin asignar.

En **Movimientos**, selecciona efectivo, tarjeta de débito o tarjeta de crédito y luego su cuenta/tarjeta. Débito carga la cuenta bancaria vinculada; efectivo carga su caja. Crédito aumenta la deuda y conserva el capital hasta registrar un pago en Cuentas. Pagar deuda no agrega otro gasto de consumo. La comparativa de tarjetas usa solo compras del mes elegido y contempla empates. Archivar conserva los nombres e historial. No se almacenan PAN, CVV ni PIN: solo alias, tipo y banco en la interfaz.

**Operaciones** permite aportes, retiros, transferencias y pagos de tarjeta. Anular conserva el registro y revierte su efecto si los saldos y deuda resultantes son válidos. Para eliminar una compra de crédito ya pagada, anula primero el pago correspondiente. No se permiten nuevos sobregiros ni gastar dinero reservado; registra fondos o libera reservas antes. Una cuenta solo se archiva con saldo cero, sin reservas ni débito activo.

En **Ahorros** reserva dinero que ya está en tus cuentas: capital total incluye ese dinero una sola vez; disponible = capital − reservas. Retirar una reserva libera disponibilidad, sin retirar fondos del banco. El objetivo general resume todas las reservas; cada meta específica clasifica parte de ellas. Un retiro del general solo libera aportes hechos directamente al general: los de una meta se retiran desde esa meta. No hay transferencias bancarias automáticas.

Cada objetivo admite monto, fecha inicial, plazo por meses o semanas y aporte por período. El detalle muestra ahorro, faltante, plazo, aporte requerido y estimación aritmética sin intereses. Aporte cero no tiene estimación; cumplido muestra cero meses; vencido conserva el faltante. Las fechas al sumar meses se ajustan al último día válido. Una meta con reservas se vacía antes de archivarla; el general siempre se conserva.

**Mi perfil** está al pie del sidebar con las iniciales y nombre de sesión, acceso a contraseña, cuentas y ahorros, y salida. En móvil la navegación se adapta sin perder estas acciones.

La API documentada en `docs/openapi.json` agrega `/api/cuentas`, `/api/tarjetas`, `/api/operaciones`, `/api/objetivos` y `/api/ahorros`, además de `POST /api/operaciones/:id/anular`. Las escrituras devuelven el estado completo con `resumenCuentas`; las cantidades de respuesta son centavos enteros y las entradas monetarias son cadenas decimales. Las referencias se resuelven exclusivamente dentro del usuario de sesión. Las escrituras requieren el CSRF existente. Las colecciones globales legadas no se migran ni asignan automáticamente.

Las pruebas F5 usan bases y contenedores aislados: contabilidad, validaciones, referencias ajenas, concurrencia, persistencia, esquemas MongoDB y navegador Edge/Chromium existente en escritorio/móvil. `node scripts/verificar.mjs` ejecuta todo junto al build. Lint y typecheck siguen **NO CONFIGURADO**; sintaxis y build no los sustituyen.

### Ajustes de F5: categorías, planes y suscripciones

Mi perfil permite crear, renombrar, archivar y reactivar categorías propias. Renombrar actualiza la etiqueta de los movimientos del mismo usuario de forma atómica; archivar mantiene su historial y permite conservarla al editar un gasto anterior, pero no usarla en gastos nuevos. No se permiten nombres vacíos ni duplicados sin distinguir mayúsculas. El resumen incluye categorías históricas archivadas para conservar los totales.

Las tarjetas ya no solicitan ni muestran últimos cuatro dígitos. Los valores previos se conservan sin migraciones destructivas. En suscripciones se puede seleccionar una tarjeta propia de débito o crédito, con alias y banco; las existentes quedan sin asignar hasta elegir una. Archivar una tarjeta mantiene su referencia en la suscripción; no habilita seleccionarla para una nueva. Los recordatorios no ejecutan cargos automáticos.

En los objetivos, cambiar el plazo calcula automáticamente el aporte y cambiar el aporte calcula un plazo aproximado. El selector permite meses (hasta 600) o semanas (hasta 2600), con aportes mensuales o semanales respectivamente. El aporte requerido redondea hacia arriba al centavo; el cálculo usa el monto faltante, descontando lo ya reservado. Aporte cero muestra sin estimación. La API conserva los campos históricos meses (cantidad de períodos) y mensual (importe por período), agregando unidad y modo; los clientes anteriores siguen usando meses y modo manual por defecto. Los aportes no se descuentan automáticamente.

# Arnés de desarrollo autónomo multiagente

## Autoridad y stack

Este archivo es la única fuente de instrucciones del arnés para cualquier LLM
(Claude, GPT, Gemini, Cursor, Antigravity u otro). Cargarlo explícitamente si la
herramienta no descubre AGENTS.md. No crear copias ni instrucciones por proveedor.
Los archivos de progress/ son evidencia y memoria, no políticas alternativas.

Proyecto: fjnance. JavaScript ESM; Node.js >=22 y npm; frontend React 18 y
Vite 6; backend HTTP nativo de Node. Persistencia de ejecución en MongoDB 8 mediante el driver oficial. Docker Compose
ejecuta frontend React compilado servido por Nginx, backend HTTP Node y MongoDB
en contenedores separados, con volumen persistente para MongoDB. El JSON previo
backend/data/finance.json se conserva sin importación automática; las pruebas
financieras usan cuentas autenticadas y bases exclusivas de prueba. Pruebas unitarias y de integración HTTP
y MongoDB con node:test en backend/test/*.test.js; npm test en raíz prepara
contenedores y bases aisladas, y requiere Docker operativo. La verificación UI usa Edge/Chromium ya instalado,
con perfil temporal; no descarga navegadores. Usuarios y sesiones residen en MongoDB,
con estados y comprobantes separados por propietario, sin asignar el estado legado.
No hay linter, TypeScript, chequeo de tipos ni suite independiente de frontend
configurados. Los archivos existentes conservan sus contratos e identificadores.

## Reglas generales

- Código nuevo, commits y documentación en español; respetar nombres de APIs,
  librerías y contratos existentes. No renombrar código ajeno al alcance.
- Trabajar en main salvo autorización explícita. No crear ramas, descartar
  cambios, reescribir historia ni modificar trabajo previo del usuario.
- Nunca modificar archivos de secretos (.env y variantes), exponer credenciales
  ni registrar datos privados. No tocar datos reales para ejecutar pruebas.
- Commits atómicos con formato `feat(F<n>): descripción`, `fix(F<n>): descripción`,
  `test(F<n>): descripción` o `chore(F<n>): descripción`. Sin commit ni push sin
  la autorización correspondiente del usuario. Preparar solo archivos revisados;
  nunca usar staging indiscriminado.
- **El agente no dice 'funciona', lo demuestra con pruebas ejecutables.**
- No instalar herramientas, iniciar servicios ni cambiar el stack implícitamente.
  Proponer como feature cualquier nueva infraestructura de validación.

## Roles y permisos

Los roles pueden alternarse explícitamente en una sesión o asignarse a subagentes
cuando el usuario o el entorno lo permitan. Registrar quién actuó y en qué rol.
No presentar una autorrevisión como auditoría independiente. Si no hay revisor
independiente, declarar la limitación y solicitar revisión del usuario.

| Rol | Lee | Escribe | Responsabilidad |
| --- | --- | --- | --- |
| Líder (Orquestador) | AGENTS.md, registro, progress/, arquitectura, diff y resultados | feature_list.json, progress/actual.md, progress/historial.md | Descompone, propone, solicita aprobación, coordina y hace commit aprobado. No edita código directamente. |
| Implementador | AGENTS.md, feature aprobada, código y pruebas pertinentes, revisión | Solo código/pruebas/archivos aprobados de UNA feature y progress/impl_<id>.md | Implementa, prueba y entrega evidencia; solicita al líder cambios de estado. |
| Revisor (Auditor) | AGENTS.md, feature, git diff, archivos nuevos, código, pruebas y logs | Solo progress/revision_<id>.md | No edita código; ejecuta verificación y audita cada criterio. |
| Explorador | AGENTS.md, código, arquitectura y documentación pertinente | Solo progress/explora_<tema>.md | Investiga antes de cambios grandes; consulta de solo lectura excepto su informe. |

Todos pueden ejecutar consultas de Git y verificaciones que generen únicamente
logs ignorados, artefactos de build ignorados y datos temporales de pruebas.
Solo el líder modifica el registro y memoria compartida; evita escrituras simultáneas.

## Registro y flujo

`propuesta` → (usuario aprueba) → `pendiente` → `en_curso` → `en_revision`
→ (revisión APROBADO y usuario aprueba commit) → `hecha`
→ (usuario autoriza y barrera estricta satisfecha) → `push`.

1. El líder agrega cada propuesta a feature_list.json con `id`, `titulo`,
   `estado`, `criterios` (lista de comprobaciones observables), `archivos`
   (alcance permitido) y referencia de aprobación en `aprobacion_usuario`.
   Asigna siguiente_id, lo incrementa y nunca reutiliza IDs; conserva los
   descartados o registra sus IDs en ids_retirados antes de eliminarlos.
2. La aprobación del usuario habilita pendiente; solo una feature puede estar
   en_curso o en_revision. Actualizar progress/actual.md al cambiar la sesión.
3. El implementador trabaja únicamente esa feature. Su informe contiene alcance,
   archivos modificados, pruebas agregadas, comandos, códigos de salida, logs,
   resultados, limitaciones y próximo paso. No ampliar alcance sin aprobación.
4. El revisor examina `git diff`, `git diff --cached` y archivos sin seguimiento;
   ejecuta init completo y vincula cada criterio a evidencia. Su informe incluye
   commit base/diff revisado, comandos, resultados y veredicto exacto:
   APROBADO, CAMBIOS_REQUERIDOS o BLOQUEADO, con motivos concretos.
5. CAMBIOS_REQUERIDOS vuelve a en_curso; una imposibilidad comprobable pasa a
   bloqueada con causa y condición de desbloqueo. Retomar requiere resolver la
   causa y preservar aprobación. descartada requiere decisión registrada.
6. Con auditoría aprobada y autorización de commit, el líder actualiza historial
   y estado hecha, prepara archivos del alcance y crea el commit atómico. Si
   falla el commit, restituye en_revision. Historial referencia el commit por su
   asunto único; el hash puede consultarse con git log sin un commit circular.
   Cambios posteriores invalidan la auditoría y requieren otra revisión.
7. Push siempre exige autorización explícita separada; nunca ejecutarlo por
   inferencia. El arnés no hace commits ni push automáticamente.

## Definición de terminado

- **N1:** init completo termina con código 0: herramientas, dependencias,
  comprobaciones estáticas disponibles, pruebas unitarias/integración y build.
  Actualmente lint y typecheck figuran NO CONFIGURADO: sintaxis JS/JSX no los
  reemplaza. Registrar esta brecha preexistente en cada auditoría; no afirmar
  que se ejecutaron. Al agregar scripts lint/typecheck, el arnés los exige
  automáticamente en raíz, backend y frontend. Si la feature exige esas
  garantías, queda BLOQUEADA hasta disponer de herramientas aprobadas.
- **N2:** cada función, ruta o módulo nuevo tiene pruebas ejecutables de caso
  exitoso, validación errónea y bordes aplicables. El revisor comprueba cobertura
  por criterio; pasar la suite previa no demuestra cobertura nueva. Documentar
  cualquier caso no aplicable y su justificación. UI nueva requiere pruebas
  apropiadas, no basta compilar JSX.
- **N3:** diff ceñido a archivos y criterios aprobados, sin código muerto,
  temporales versionados, secretos ni modificaciones ajenas. Conservar cambios
  previos del usuario sin incluirlos en el commit.

## Verificación reproducible

Preparación inicial: Node >=22, npm y Git en PATH. Instalar dependencias con
`npm --prefix frontend ci` y `npm --prefix backend ci` cuando corresponda;
el verificador no instala ni descarga dependencias automáticamente.

| Modo | Bash / Git Bash | Windows PowerShell | Comprobaciones |
| --- | --- | --- | --- |
| Estado | bash init.sh --estado | .\init.ps1 --estado | Registro JSON y estructura, rama, cambios Git; informa suciedad sin rechazarla. |
| Rápido | bash init.sh --rapido | .\init.ps1 --rapido | Estado, Node/npm, dependencias, scripts lint/typecheck existentes, sintaxis JS/JSX. |
| Completo | bash init.sh | .\init.ps1 | Rápido + npm test (unitarias e integración HTTP) + npm run build (Vite). |
| Estricto | bash init.sh --estricto | .\init.ps1 --estricto | Completo + árbol 100% limpio, upstream configurado, fetch remoto exitoso y cero commits de diferencia. |

Los dos puntos de entrada usan scripts/verificar.mjs para evitar divergencias
entre plataformas. Cualquier fallo devuelve código distinto de cero. Logs en
.arnes/ (ignorados); no guardar secretos allí. No requiere Bash en Windows.
El modo estricto necesita acceso al remoto y actualiza referencias con fetch.
Si la política local de PowerShell impide ejecutar init.ps1, usar
`node scripts/verificar.mjs` con las mismas opciones, sin cambiar esa política.
En Unix, habilitar ejecución con `chmod +x init.sh` si el checkout no conserva
el permiso; `bash init.sh` funciona sin ese permiso.

**Sincronización estricta:** por requisito, estricto rechaza tanto retraso como
adelanto respecto al upstream. Por ello también rechaza commits locales todavía
no publicados: no puede certificar un primer push con cambios. Informar este
bloqueo y solicitar una excepción explícita del usuario para ese envío, tras
verificación completa y árbol limpio; nunca relajar el script silenciosamente.
Después del push autorizado ejecutar estricto para confirmar igualdad remota.

## Memoria mínima

progress/actual.md conserva feature, inicio, rol, aprobación, plan inmediato,
evidencias, bloqueos y próximo paso. progress/historial.md registra únicamente
features terminadas, resultado, revisión, pruebas y referencia de commit.
Los informes impl_<id>.md, revision_<id>.md y explora_<tema>.md se crean cuando
se usan esos roles; no duplican estas instrucciones. No crear otros archivos
de políticas. La instalación inicial del arnés está autorizada por la solicitud
del usuario y deja el registro vacío, sin inventar features ni aprobaciones.

# Implementación F3

- Autor: agente principal como Implementador; Líder para registro y coordinación operativa.
- Fecha: 2026-11-01. Usuario aprobó F3 y excepción con F1/F2 en revisión, sin commit ni push.
- Alcance: frontend React/Nginx y backend Node en imágenes y servicios independientes, MongoDB y volumen existentes conservados. Backend solo API: rutas de interfaz devuelven 404 JSON. Frontend proxy /api con Host/Origin, DNS Docker dinámico y errores JSON.
- Archivos: Dockerfile raíz sustituido por backend/Dockerfile y frontend/Dockerfile; frontend/nginx.conf, compose.yaml, backend/src/server.js, scripts/probar-docker.mjs, scripts/entorno.mjs, backend/test/entorno.test.js, backend/test/recursos-api.test.js, scripts/verificar.mjs, package.json, README.md, descripción del stack AGENTS.md.
- Comando habitual: npm.cmd run docker:up recupera credenciales desde configuración Docker, compila antes de detener aplicacion anterior y mantiene volumen; genera credenciales solo sin volumen previo. Stop conserva contenedores y volumen. No se escriben secretos ni se imprimen variables.
- Ajuste operativo: frontend en 3002 porque se comprobó que otro proyecto ocupa 3000. Backend conserva 3001; no se detiene ni modifica el otro proyecto. Ajuste registrado en F3.
- Pruebas agregadas: configuración nueva/existente, codificación URI, credenciales parciales, volumen sin credenciales, credenciales originales externas, orden build/stop/up, status/stop, acción inválida y Docker inaccesible. API no sirve /, /index.html ni assets. Driver Docker comprueba HTML/JS, backend JSON, archivos ausentes, proxy de escritura con Origin, PDF de 5 MiB y bytes exactos, errores 400/413 JSON, Host/Origin ajenos, redes, reinicios, volumen, caída de Mongo, caída de backend con frontend disponible y recuperación.
- Comandos: node --test backend/test/entorno.test.js (0, 2/2); node scripts/verificar.mjs --estado (0); node scripts/verificar.mjs completo (0, 15/15 y build). Log .arnes/2026-11-01T22-24-14-069Z-34452.log y .arnes/verificacion-F3-implementacion.log.
- Incidencias corregidas: herencia de error_page Nginx impedía JSON en 413; agregada regla en ubicación /api. Prueba de Host usa node:http explícito porque fetch de esta versión no transmitía el Host personalizado.
- Después de esa suite se precisó mensaje de puertos configurables y comprobación explícita de ausencia de frontend/dist en imagen backend. Verificación de versión final pendiente al rol Revisor.
- Excepción del arnés comprobada con cinco escenarios usando su función real en VM; evidencia .arnes/F3-excepcion.log. No se relaja la regla para otras features.
- Limitaciones: lint/typecheck no configurados; revisión propia, sin auditor independiente. Datos habituales todavía sin tocar; despliegue autorizado tras verificación final, solo lecturas de comprobación.
- Próximo paso: Revisor ejecuta init completo sobre versión final; después Líder actualiza entorno habitual conservando volumen/credenciales y registra evidencia operativa.

- Ajuste de cobertura solicitado durante revisión: prueba del proceso CLI real con argumento inválido y Docker fuera de PATH; verifica código 1, diagnóstico y ausencia de salida de configuración. Requiere nueva verificación final.

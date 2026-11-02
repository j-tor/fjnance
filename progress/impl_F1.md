# Implementación F1

- Autor: agente principal, rol Implementador; Líder únicamente al actualizar registro y memoria compartida.
- Fecha: 2026-10-31. Aprobación conservada de F1 y solicitud actual. Sin commit ni push.
- Alcance: imagen multietapa React + backend HTTP; MongoDB 8.0.16 con volumen persistente; driver oficial 6.21.0; red interna de base y red de entrada de aplicación, loopback; salud y cierre de conexión; pruebas aisladas y documentación.
- Archivos: Dockerfile, compose.yaml, .dockerignore, backend/package.json y package-lock.json, backend/src/server.js, backend/src/persistencia-mongodb.js, backend/test/persistencia-mongodb.test.js, backend/test/soporte-mongodb.js, scripts/probar-docker.mjs, package.json, README.md y actualización descriptiva del stack en AGENTS.md.
- Contratos HTTP e identificadores preservados. JSON existente sin leer ni modificar para pruebas. Pruebas legadas usan directorios temporales explícitos.
- Pruebas agregadas: configuración inválida y Mongo inaccesible; API con persistencia Mongo, validaciones, límites de comprobantes, edición, eliminación, suscripciones, concurrencia y reconexión; rechazo de revisión obsoleta y escritura con cliente cerrado. Prueba Docker: HTML, salud, API, puertos, reinicio, recreación con volumen, caída de Mongo y recuperación sin confirmar escritura fallida.
- Comandos: npm.cmd --prefix backend install --save-exact mongodb@6.21.0 (0, autorizado); node --test backend/test/api.test.js backend/test/management.test.js (0 fuera del sandbox, 4/4); npm.cmd run build (0); node scripts/verificar.mjs --rapido (0); node scripts/verificar.mjs (0, 7/7 y build).
- Evidencia final: .arnes/2026-10-31T06-30-06-319Z-32844.log y .arnes/verificacion-F1-final.log. No pruebas omitidas.
- Incidencias resueltas: sandbox impedía acceso a Docker, red npm y rename temporal; ejecución ampliada autorizada. Prueba inicial detectó falta de publicación desde red exclusivamente interna; se agregó entrada bridge solo a aplicación. Docker reasigna puerto efímero al reiniciar: el verificador consulta el puerto tras cada recreación/reinicio y evita reutilizar conexiones HTTP cerradas.
- Limpieza: recursos Docker aleatorios de prueba eliminados, incluidos volúmenes e imágenes; sin cambios en otros proyectos.
- Limitaciones: lint/typecheck NO CONFIGURADO; Mongo debe estar disponible para pruebas; no migración automática de JSON. Comprobantes retirados se conservan físicamente; metadatos sujetos a BSON 16 MiB; una sola instancia prevista. npm ci del frontend informó una vulnerabilidad alta preexistente; no se actualizaron dependencias ajenas a F1.
- Próximo paso: revisión técnica, revisión del usuario por ausencia de auditor independiente y autorización separada para cualquier commit.

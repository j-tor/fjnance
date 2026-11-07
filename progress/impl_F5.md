# Implementación F5

- Autor: agente principal, rol Implementador F5. Aprobación: «apruebao la f5 y has push de las 1 a la 4». No autoriza commit ni push F5.
- Base: cc27135, main; F1–F4 publicadas por Líder con excepción expresa del usuario. Archivo previo arnes.md conservado fuera del alcance.
- Alcance: modelo opcional cartera por usuario; cuentas bancarias/efectivo, tarjetas débito/crédito, origen de gastos, capital/operaciones/anulación trazable, reservas/general/metas/proyecciones y perfil inferior. Datos anteriores sin distribución inventada. No migración global ni nuevos fondos de ejemplo.
- Archivos: shared/cuentas-ahorros.js; backend/src/{cuentas-ahorros,server,esquemas-mongodb}.js; backend/test/{cuentas-ahorros,cuentas-api,cliente-api,recursos-api}.test.js; frontend/src/api.js, main.jsx, styles.css, components/{Forms,Perfil,PerfilSidebar}.jsx, pages/{Dashboard,Movements,Cuentas,Ahorros,ObjetivoAhorro}.jsx; scripts/probar-usuarios-ui.mjs; docs/openapi.json y README.md. Todos incluidos en alcance F5.
- Pruebas nuevas: contabilidad de 10+25, reparto sin duplicación, transferencias/aportes/retiros, débito/crédito y cambios de origen, pago/anulación/reversión, archivo y referencias, reservas separadas/general sin doble conteo, redondeo/proyecciones/cero/vencida/cumplida; API autenticada con CSRF/propiedad, concurrencia, persistencia y validación MongoDB; cliente y recorrido UI real con tarjetas/metas/aportes/retiros/perfil.
- Comandos: node --test backend/test/cuentas-ahorros.test.js backend/test/cliente-api.test.js (9/9, salida 0); node scripts/verificar.mjs (27/27, ninguna omitida, UI real escritorio/móvil y build 37 módulos; salida 0).
- Evidencia: .arnes/F5-final.log y .arnes/2026-11-02T12-42-06-080Z-41040.log. Capturas .arnes/F4-tarjetas-{escritorio,movil}.png y F4-objetivo-{escritorio,movil}.png; prefijo histórico del runner preservado. Inspección visual final muestra barra de progreso, perfil inferior y formularios legibles. Captura a viewport móvil CSS con emulación touch desactivada para evitar artefacto de captura completa de Chromium.
- Primera verificación estricta: .arnes/F5-verificacion.log, pruebas/UI/build aprobados, salida 1 solo por árbol sucio (F5 y arnes.md). No se modificó el verificador. git fetch origin y rev-list HEAD...origin/main: 0/0. Ese rechazo no revierte el push autorizado de cc27135.
- Hallazgos corregidos: color de progress heredado y artefactos de captura móvil. Sin herramientas/dependencias nuevas. Lint/typecheck NO CONFIGURADO en raíz/backend/frontend.
- Limitación: autorrevisión del mismo agente; requiere revisión del usuario. Próximo paso: Líder solicita en_revision, Revisor ejecuta init completo y coteja criterios, después actualización autorizada del entorno con huellas de datos. No staging/commit/push F5.

## Ajustes de revisión

Implementador: corregido aviso de cuenta histórica en ExpenseForm, cobertura explícita de empate/mes sin consumo y límite menor a deuda actual; OpenAPI GET de listas como arrays y resumenCuentas documentado. node --test backend/test/cuentas-ahorros.test.js: 6/6, salida 0. Sin cambios de infraestructura. Líder solicita volver a en_revision y Revisor repetirá init completo de la versión final.

## Ampliación solicitada 2026-11-02

Implementador F5: retirados últimos cuatro dígitos de captura/selección/visualización, con preservación de campos anteriores; categorías por usuario en perfil y catálogo dinámico con renombrado atómico/archivo; cálculos bidireccionales meses/semanas y selector de tarjeta propia en suscripciones, sin cargos automáticos. Cambios dentro del alcance ampliado registrado; SubscriptionForm.jsx/Subscriptions.jsx agregados expresamente.

Unitarias focalizadas: 12/12, salida 0. Primera verificación completa .arnes/F5-ampliacion.log: 30/30 pruebas backend, salida global 1 por espera de UI equivocada (innerText no incluye valor de input); corregida para leer valor del campo. Recorrido ampliado además verifica categoría personalizada/renombrado/archivo conservado, cálculo bidireccional y semanas. Se solicita en_revision e init completo con este arreglo. API/OpenAPI/README actualizados, sin dependencias nuevas, sin commit/push.

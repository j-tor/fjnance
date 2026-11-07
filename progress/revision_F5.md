# Revisión F5

- Autor: agente principal alternando al rol Revisor. AUTORREVISIÓN TÉCNICA, no auditoría independiente; se solicita revisión del usuario.
- Base: cc27135427c7d90c58b9224b510716bd46bad7b5. Diff revisado: 22 archivos de implementación/documentación, huella SHA256 8d8842594de7ad3362bc9767157d7b7a84b4a3fa4a087ae800b7b977527fddba (.arnes/F5-diff-huella.txt). Incluye archivos nuevos; git diff --cached vacío y git diff --check 0. Registro y memoria son cambios del Líder, no código adicional. arnes.md previo excluido y conservado.
- Init completo final: node scripts/verificar.mjs, salida 0. 28/28 pruebas, cero fallos/omitidas, UI real y build Vite 37 módulos. Logs .arnes/F5-revision-final.log y .arnes/2026-11-02T12-46-36-996Z-15172.log. Verificación previa .arnes/F5-final.log 27/27; ajustes posteriores nuevamente verificados.

| Criterio | Evidencia ejecutable |
| --- | --- |
| 1. Cuentas/tarjetas propias | cuentas-ahorros.test.js y cuentas-api.test.js crean/editan/archivan/reactivan, validan tipo, cuenta bancaria de débito, datos sensibles, últimos cuatro, referencias ajenas 404, cuenta con fondos no archivable. Historial conservado. |
| 2. Origen y reversión de gastos | Unitarias cambian débito a crédito y preservan cuenta histórica al cambiar vínculo; API crea/edita/elimina, rechaza tarjeta incorrecta y dos cargos concurrentes no sobregiran. Pago ya efectuado impide borrar deuda hasta anular pago. UI selecciona efectivo/débito/crédito y orígenes dependientes. |
| 3. Capital y crédito | Unitarias distribuyen 10+25=35 sin duplicar, prueban transferencia/aporte/retiro y saldos insuficientes; crédito aumenta deuda, pago reduce capital sin nuevo consumo, límite menor a deuda rechazado. Anulación preserva operación y rechaza reversión inconsistente/repetida. API conserva estado al reiniciar. |
| 4. Comparativa | Ranking mensual comprueba empate A/B, otro mes y tarjeta sin gasto, sin mutar entradas. Pagos no son expenses. UI exige Crédito UI como mayor gasto frente a Débito UI. Orígenes archivados conservan objetos e identificadores históricos. |
| 5. Reservas | Unitarias y API prueban capital constante, disponible descontado, general cuenta aportes específicos una vez; retirada por meta/cuenta, excedente rechazado, no archivo de meta con reserva. UI aporta 20 y retira 5; snapshot exige capital 17550, reservado 1500, tres compras. |
| 6. Objetivos y plazos | Unitarias cubren cero aporte, cumplida, vencida, meses/fechas inválidos, fin de mes bisiesto y redondeo al centavo. General protegido; crear/editar/archivar/reactivar metas. UI configura general y específica, detalle exige estimación cuatro meses. |
| 7. Perfil e interfaz | Runner CDP con Edge/Chromium existente registra usuarios, gestiona bancos/tarjetas y metas, pago, aportes/retiros y perfil/clave/salida; conserva permisos/admin. Capturas inspeccionadas escritorio y viewport 390 px sin desbordamiento global. Perfil con iniciales/nombre de sesión al pie del sidebar; móvil debajo de navegación. |
| 8. Compatibilidad y propiedad | Modelo opcional sin escritura en GET para estados previos; saldo/origen sin distribuir explícitos. Mongo valida tipos/CVV directo, rechaza documento inválido. API exige 401 sin sesión y 403 sin CSRF en nuevas escrituras; referencias cruzadas no acceden al propietario ajeno. Legacy global intacto comprobado en pruebas. No se ejecutan pruebas contra datos habituales. |
| 9. Arnés/documentación | Init completo final 0, suites previas y nuevas/UI/build. Cliente nuevo cubierto; OpenAPI 3.0.3 documento v3 incluye 48 operaciones y resumenCuentas; README explica reglas, reservas y operaciones/anulación. Alcance contrastado con registro. |

N1: validaciones disponibles aprobadas; lint y typecheck NO CONFIGURADO en raíz/backend/frontend, sintaxis/build no los sustituyen. N2: éxito/errores/bordes de lógica y API, UI real y regresión; helpers de presentación sin rutas propias cubiertos por recorrido compartido. No existe suite unitaria de componentes independiente. N3: sin staging/commit/push F5 ni modificaciones de seed/credenciales/secretos, sin nuevas dependencias/infraestructura; datos sintéticos aislados.

Hallazgos CAMBIOS_REQUERIDOS resueltos: cobertura de empate/límite, listas GET documentadas como arrays, aviso de cuenta histórica en edición. Init completo se repitió después; no cambios de código posteriores.

Veredicto: APROBADO.

Limitaciones: autorrevisión del mismo agente; revisión del usuario pendiente. Reservas son anotaciones internas, proyecciones aritméticas sin intereses y aportes manuales; sin integración bancaria. En móvil navegación horizontal existente. F5 sigue en_revision, sin autorización de commit ni push. Estricto posterior a publicación cc27135 ejecutado y rechazado solo por árbol sucio (.arnes/F5-verificacion.log), sin alterar barrera; fetch y diferencia HEAD/origin/main 0/0. No se afirma estricto aprobado.

## Revisión vigente de ampliación — 2026-11-02

Esta sección sustituye la certificación anterior de código de F5, invalidada por la ampliación expresa del usuario. Revisor: mismo agente principal, autorrevisión técnica, no auditor independiente. Base cc27135; diff de 25 archivos aprobado contra el alcance ampliado, incluidos nuevos sin seguimiento. Huella ed576b952e4ba06aa664fe5449a0ff4902586dbb973de21f85eab46fe90ed459 (.arnes/F5-ampliacion-huella.txt); staging vacío y git diff --check 0. arnes.md previo intacto.

Init completo final: node scripts/verificar.mjs, salida 0; 30/30 pruebas, cero omitidas, UI real y build Vite 37 módulos. .arnes/F5-ampliacion-revision.log y .arnes/2026-11-02T16-46-18-720Z-32988.log. La primera ejecución .arnes/F5-ampliacion.log tuvo 30/30 backend pero falló una espera de prueba UI sobre innerText de un input; corregida para inspeccionar value y repetida suite completa.

- Criterios 1–9 originales: regresión completa mantiene cuentas, tarjetas, gasto/origen, capital, anulación, reservas/metas, perfil, propiedad/CSRF y datos legados. La eliminación solicitada de últimos cuatro dígitos aplica a captura/visualización; esquema opcional previo se conserva para no borrar datos. UI exige ausencia del campo y crea ambas tarjetas sin dígitos.
- Criterio ampliado categorías: unitarias crean/renombran/archivan/reactivan y rechazan vacío, duplicado, estado inválido e ID ajeno. API registra gasto personalizado, renombra su historial atómicamente, archiva sin borrarlo y rechaza nuevo gasto archivado; dos usuarios tienen catálogos independientes. UI crea Transporte UI, registra gasto, renombra Movilidad UI, archiva y verifica historial visible. Perfil gestiona catálogo propio; resumen incluye categorías históricas.
- Criterio ampliado ahorro: pure calcularPlan/proyeccionMeta/sumarSemanas probadas con semanas, bisiesto, saldo ya reservado, redondeo, cero/cumplida e inválidos. API calcula 100/4 semanas=25, rechaza unidad inválida. UI verifica 100/5 meses=20; cambiar aporte a25 da4 meses; 100/4 semanas=25 y aporte10 da10 semanas; guarda y detalle conserva unidad. Sin intereses ni cargos automáticos.
- Criterio ampliado suscripciones: unitarias/API validan tarjeta propia, inexistente/ajena, archivo y preservación histórica, cambio de débito a crédito y eliminación de vínculo. UI elige Débito UI y exige alias en tabla; las suscripciones previas sin tarjeta permanecen válidas. Registrar recordatorio no mueve fondos ni crea gastos.
- Documentación/API: OpenAPI extiende categorías, unidad/modo y tarjetaId; README explica renombrado histórico, archivo, preservación de dígitos previos y campos compatibles meses/mensual como períodos/importes de la unidad elegida. Sin herramientas ni dependencias nuevas.

Capturas inspeccionadas en una ronda: .arnes/F4-categorias-escritorio.png y F4-plan-semanal-movil.png; además runner captura categorías móvil y tarjetas escritorio/móvil. Diseño existente conservado, sin desbordamiento global; modales móviles permiten desplazamiento vertical. Prefijo F4 histórico del runner conservado.

N1 aprobado para comprobaciones disponibles; lint/typecheck NO CONFIGURADO en raíz/backend/frontend. N2 éxito/errores/bordes cubiertos por pruebas unitarias/API y navegador. N3 alcance aprobado, sin archivos de secretos/seed/datos habituales alterados por pruebas ni staging/commit/push.

Veredicto vigente: APROBADO.

Limitación: autorrevisión técnica del mismo agente; se solicita revisión del usuario. F5 sigue en_revision sin commit/push. No se afirma auditoría independiente ni estricto aprobado (árbol local sucio preservado).

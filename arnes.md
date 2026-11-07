Aquí tienes un **prompt universal de inicialización**. 

Está diseñado para que lo pegues en cualquier asistente (Claude, GPT-4, Gemini, Cursor, Antigravity, etc.) en un proyecto nuevo o existente. Su objetivo es **instalar el arnés consolidado en un único punto de verdad agnóstico (`AGENTS.md`)**, reduciendo drásticamente la cantidad de archivos y eliminando configuraciones propietarias innecesarias.

---

### Prompt para copiar y pegar en el nuevo proyecto

```markdown
Actúa como Arquitecto de Sistemas y Agentes de Software. Necesito que instales y configures en este repositorio un "Arnés de Desarrollo Autónomo Multi-Agente" estándar, minimalista y agnóstico (compatible con Claude, GPT, Gemini, Cursor, Antigravity y cualquier LLM).

El objetivo es tener un sistema robusto de trabajo basado en features, auditoría y pruebas, pero CONCENTRADO en un único archivo de instrucciones central (`AGENTS.md`) para evitar fragmentación de archivos.

Por favor, inspecciona el proyecto actual (lenguaje, framework, gestor de paquetes, base de datos si existe, linter y suite de tests) y genera los siguientes componentes:

---

### 1. Archivo Central Universal: `AGENTS.md`
Crea `AGENTS.md` en la raíz del proyecto. Este archivo será la única fuente de verdad leída por cualquier agente. Debe contener:
1. **Reglas Generales:**
   - Idioma del proyecto (código, commits y documentación en español).
   - Política de Git: trabajo en `main` salvo autorización explícita; commits atómicos con formato de tipo (`feat(F<n>): ...`); nunca modificar archivos de secretos (`.env`).
   - Principio: *"El agente no dice 'funciona', lo demuestra con pruebas ejecutables"*.
2. **Distribución de Roles (en la misma sesión o subagentes):**
   - **Líder (Orquestador):** Descompone tareas en `feature_list.json`, pide aprobación al usuario, coordina, no edita código directamente, actualiza el historial y hace commit tras aprobación.
   - **Implementador:** Trabaja exactamente UNA feature a la vez. Crea/edita código y sus pruebas correspondientes. Ejecuta validaciones locales y documenta en `progress/impl_<id>.md`.
   - **Revisor (Auditor):** No edita código. Revisa `git diff`, ejecuta el script de verificación y audita criterio por criterio. Emite veredicto: `APROBADO`, `CAMBIOS_REQUERIDOS` o `BLOQUEADO` en `progress/revision_<id>.md`.
   - **Explorador:** Consulta de solo lectura para investigar arquitectura antes de proponer cambios grandes (`progress/explora_<tema>.md`).
3. **Flujo de Trabajo:**
   `propuesta` ──(usuario aprueba)──▶ `pendiente` ──▶ `en_curso` (implementador) ──▶ `en_revision` (revisor) ──▶ `hecha` (líder commitea) ──▶ (usuario autoriza) ──▶ `push`
4. **Definición de Terminado (DoD):**
   - N1: Script de verificación (`init.sh`) en verde (lint, tipos, tests y build).
   - N2: Cobertura de pruebas para cada nueva función, ruta o módulo (happy path, error de validación, casos borde).
   - N3: Respeto estricto del alcance (no tocar archivos ajenos a la feature ni dejar código muerto o archivos temporales).
5. **Estructura de Archivos Permitidos:**
   - Tabla clara indicando qué archivos lee y escribe cada rol.

---

### 2. Barrera de Calidad: `init.sh` (y `init.ps1` para Windows)
Crea un script ejecutable que concentre las validaciones del proyecto según su stack detectado:
- Modo `--estado`: Revisa estado de Git, limpieza del árbol y sintaxis de `feature_list.json`.
- Modo `--rapido`: Comprueba herramientas del sistema (node/python/go/rust/etc.), dependencias, linter y chequeo de tipos.
- Modo por defecto (completo): Incluye `--rapido` + ejecución de pruebas unitarias y de integración + compilación/build.
- Modo `--estricto`: Modo completo + validación de árbol Git 100% limpio y sincronizado con el remoto (requerido antes de hacer push).
- Crea también `init.ps1` como atajo compatible para entornos Windows PowerShell.

---

### 3. Registro de Features: `feature_list.json`
Crea en la raíz `feature_list.json` con la siguiente estructura base:
```json
{
  "proyecto": "<nombre_del_proyecto>",
  "siguiente_id": "F1",
  "ids_retirados": [],
  "reglas": {
    "una_feature_activa": true,
    "requiere_aprobacion_del_usuario": true,
    "requiere_revision_aprobada": true,
    "estados": ["propuesta", "pendiente", "en_curso", "en_revision", "hecha", "bloqueada", "descartada"]
  },
  "features": []
}
```

---

### 4. Directorio de Progreso y Memoria: `progress/`
Crea la carpeta `progress/` con:
- `actual.md`: Plantilla de sesión activa (feature en curso, fecha de inicio, plan inmediato y próximo paso).
- `historial.md`: Bitácora vacía con cabecera donde se registrarán las features terminadas (`F1`, `F2`, ...).
- Asegúrate de que `.gitignore` ignore la carpeta temporal `.arnes/` (donde `init.sh` almacena logs de ejecución).

---

Inicia analizando este proyecto e implementando estos 4 elementos adaptados a sus tecnologías.
```

---

## ¿Por qué este formato simplificado funciona mejor?

1. **Agnóstico (Multi-LLM):** Modelos como Claude, GPT, Gemini, Cursor o Antigravity leen automáticamente `AGENTS.md` si existe en la raíz del repositorio. No depende de extensiones propietarias.
2. **Cero redundancia:** Los roles, las reglas y la definición de terminado están en un solo documento (`AGENTS.md`). No hay carpetas `.claude/agents/` separadas ni duplicidad de documentos.
3. **Mantiene la disciplina:** Aunque cualquier agente pueda operar el repositorio, el flujo exige:
   - Registrar la feature en `feature_list.json`.
   - Esperar tu aprobación.
   - Pasar `init.sh` en verde.
   - Dejar el informe de implementación y revisión en `progress/`.
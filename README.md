# Comandos

## Instalar dependencias (Node.js 22+)

```powershell
cd frontend
npm.cmd install
cd ../backend
npm.cmd install
cd ..
```

## Desarrollo — terminal 1 (backend)

```powershell
cd backend
npm.cmd run dev
```

## Desarrollo — terminal 2 (frontend)

```powershell
cd frontend
npm.cmd run dev
```

## Abrir frontend

```text
http://127.0.0.1:5173
```

## Compilar y ejecutar desde la raíz

```powershell
npm.cmd run build
npm.cmd start
```

```text
http://127.0.0.1:3001
```

## Pruebas desde la raíz

```powershell
npm.cmd test
```

## Alternativa: instalar y levantar ambos desde la raíz

```powershell
npm.cmd run setup
npm.cmd run dev
```

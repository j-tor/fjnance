# Cuentas de desarrollo

Sitio: http://localhost:3002

| Nombre | Rol | Correo | Contraseña |
| --- | --- | --- | --- |
| admin | Administrador | admin@example.test | AdminPrueba123! |
| Jeffrey Torres | Usuario | jeffrey.torres@example.test | JeffreyPrueba123! |

Seed: `backend/scripts/seed-desarrollo.mjs`.

Para ejecutarlo desde la raíz:

```powershell
node backend/scripts/seed-desarrollo.mjs
```

Usa el backend que ya está en Docker. Crea las cuentas si faltan; si ya son esas cuentas de desarrollo, restablece sus claves, las activa y cierra sus sesiones. Conserva sus movimientos, identificadores y las demás cuentas. Rechaza destinos que tengan otro nombre o rol.

Credenciales de prueba literales, documentadas expresamente para desarrollo.

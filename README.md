# EDURESERVA

Sistema de la **Escuela Técnica N.º 29** para consultar y reservar **Biblioteca**, **Auditorio** y **Aula Digital**.

**Integrantes del proyecto:**
- Axel Chambi
- Steven Gutierrez

Los datos (cuentas, aulas y reservas) están en **Supabase**, no en un archivo local.

## Roles

| Rol | Qué hace |
| --- | --- |
| Profesor | Ve las aulas, elige fecha y módulo, envía una solicitud y sigue su estado. |
| Responsable del aula digital | Aprueba o rechaza las solicitudes. Al aprobar, el aula queda ocupada. |
| Administrador | Registra profesores nuevos. La cuenta se guarda en Supabase y ya puede entrar. |

No hay registro público. Solo el administrador crea cuentas de profesores.

## Cuentas iniciales

Contraseña de las tres: `123456`

- Profesor: `profe@escuela.edu`
- Administrador: `admin@escuela.edu`
- Responsable del aula digital: `responsable@escuela.edu`

## Cómo iniciarlo en esta PC o en otra

Hace falta:

- **Python 3.10 o superior** (en Windows, desde python.org, marcando “Add python to PATH”).
- **Internet.** Sin conexión la página abre, pero el login falla porque Supabase está en la nube.
- La carpeta completa del proyecto (`app.py`, `index.html`, `script.js`, `styles.css`, `escudo.png`, `requirements.txt`). No hace falta copiar `.venv` ni `edureserva.db`.

En la carpeta del proyecto, PowerShell:

```powershell
python -m venv .venv
.\.
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python app.py
```

Si `python` no funciona, probá `py -3`.

Después abrí el navegador en:

http://127.0.0.1:5000

Dejá la ventana de la terminal abierta. Para frenar el servidor: Ctrl+C.

### Si algo falla

- **“python no se reconoce”**: Python no está instalado o no está en el PATH.
- **Error al activar el venv**: ejecutá `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` y volvé a activar.
- **“No hay conexión con Supabase”**: la PC no tiene internet, o un firewall bloquea el puerto 443.
- **El puerto 5000 está ocupado**: cerrá la otra ventana donde ya corre `python app.py`.
- **Credenciales incorrectas**: usá exactamente los correos de arriba. Los profesores nuevos usan el correo y la contraseña que cargó el administrador.

La dirección de Supabase ya está en `app.py`. En otra PC no hay que crear una base nueva: todas usan la misma.

## Qué hace cada archivo

| Archivo | Para qué sirve |
| --- | --- |
| `app.py` | Servidor Flask. Recibe el login y las reservas y las manda a Supabase. |
| `index.html` | Pantalla de acceso y paneles de profesor, responsable y administrador. |
| `styles.css` | Estilos celestes, animaciones y diseño para celular. |
| `script.js` | Muestra cada panel según el rol y llama a la API. |
| `escudo.png` / `escudo.svg` | Escudo de la escuela en la cabecera. |
| `requirements.txt` | Dependencias de Python (Flask). |

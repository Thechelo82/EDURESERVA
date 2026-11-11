"""
EDURESERVA — servidor Flask conectado a Supabase (Postgres).

Qué hace este archivo:
- Sirve la página (login + paneles por rol)
- Llama a las funciones SQL de Supabase (no usa SQLite)
- Traduce los errores de negocio a HTTP 400 / 401 / 403

Las cuentas, aulas y reservas viven en el proyecto Supabase
https://xiohuewlfgqclefspktd.supabase.co  (base edu.reserva / esquema public).
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

from flask import Flask, jsonify, request, send_from_directory, session

# ---------------------------------------------------------------------------
# Conexión a Supabase. Se puede pisar con variables de entorno en otra PC.
# La clave es la publishable/anon: las tablas tienen RLS y la lógica
# sensible corre en funciones SQL (security definer).
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://xiohuewlfgqclefspktd.supabase.co").rstrip("/")
SUPABASE_KEY = os.environ.get(
    "SUPABASE_KEY",
    "sb_publishable_8YtKOIJ-wHYeOj7dL41pAg_S2KTd4oc",
)

MODULOS_HORARIO = [
    {"id": "M1", "etiqueta": "Módulo 1", "horario": "07:30 - 08:50"},
    {"id": "M2", "etiqueta": "Módulo 2", "horario": "09:00 - 10:20"},
    {"id": "M3", "etiqueta": "Módulo 3", "horario": "10:40 - 12:00"},
    {"id": "M4", "etiqueta": "Módulo 4", "horario": "13:00 - 14:20"},
]

app = Flask(__name__, static_folder=BASE_DIR, static_url_path="")
app.secret_key = os.environ.get("EDURESERVA_SECRET", "edureserva-dev-secret-cambiar")
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax")


def rpc(funcion: str, payload: dict) -> dict:
    """Ejecuta una función public.edureserva_* vía la API REST de Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/rpc/{funcion}"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            cuerpo = resp.read().decode("utf-8") or "{}"
            data = json.loads(cuerpo)
            if isinstance(data, list):
                data = data[0] if data else {}
            return data if isinstance(data, dict) else {"ok": False, "error": "Respuesta inesperada"}
    except urllib.error.HTTPError as e:
        try:
            err = json.loads(e.read().decode("utf-8"))
            msg = err.get("message") or err.get("error") or str(e)
        except Exception:
            msg = str(e)
        return {"ok": False, "error": msg}
    except Exception as e:
        return {"ok": False, "error": f"Error de conexión: {e}"}


def responder(data: dict, ok_status: int = 200):
    """Convierte el resultado de una RPC en respuesta HTTP."""
    if data.get("ok"):
        return jsonify(data), ok_status
    codigo = data.get("codigo") or 400
    if "sesión" in str(data.get("error", "")).lower() or "token" in str(data.get("error", "")).lower():
        codigo = 401
    if "permiso" in str(data.get("error", "")).lower() or "rol" in str(data.get("error", "")).lower():
        codigo = 403
    return jsonify(data), codigo


def token_actual() -> str:
    return str(session.get("token") or "")


# ---------------------------------------------------------------------------
# Páginas estáticas
# ---------------------------------------------------------------------------
@app.get("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/<path:path>")
def static_files(path):
    return send_from_directory(BASE_DIR, path)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
@app.post("/api/login")
def api_login():
    datos = request.get_json(silent=True) or {}
    data = rpc("edureserva_login", {
        "p_email": str(datos.get("email", "")).strip(),
        "p_password": str(datos.get("password", "")),
    })
    if not data.get("ok"):
        return responder(data)
    usuario = {
        "token": data.get("token"),
        "rol": data.get("rol"),
        "nombre": data.get("nombre"),
        "email": datos.get("email"),
    }
    session["token"] = data.get("token")
    session["usuario"] = usuario
    return jsonify({
        "ok": True,
        "token": data.get("token"),
        "rol": data.get("rol"),
        "nombre": data.get("nombre"),
        "email": datos.get("email"),
    })


@app.post("/api/logout")
def api_logout():
    session.clear()
    return jsonify({"ok": True})


@app.get("/api/sesion")
def api_sesion():
    """Recupera el usuario guardado en la cookie de Flask."""
    usuario = session.get("usuario")
    if not usuario or not token_actual():
        return jsonify({"ok": True, "autenticado": False})
    return jsonify({"ok": True, "autenticado": True, "usuario": usuario})


@app.get("/api/yo")
def api_yo():
    if not token_actual():
        return jsonify({"ok": False, "error": "Debes iniciar sesión."}), 401
    data = rpc("edureserva_yo", {"p_token": token_actual()})
    return responder(data)


# ---------------------------------------------------------------------------
# Aulas y módulos
# ---------------------------------------------------------------------------
@app.get("/api/aulas")
def api_aulas():
    if not token_actual():
        return jsonify({"ok": False, "error": "Debes iniciar sesión."}), 401
    data = rpc("edureserva_aulas", {"p_token": token_actual()})
    if not data.get("ok"):
        return responder(data)
    return jsonify({"ok": True, "aulas": data.get("aulas", []), "modulos": MODULOS_HORARIO})


@app.get("/api/modulos")
def api_modulos():
    return jsonify({"ok": True, "modulos": MODULOS_HORARIO})


# ---------------------------------------------------------------------------
# Reservas
# ---------------------------------------------------------------------------
@app.post("/api/reservas")
def api_crear_reserva():
    if not token_actual():
        return jsonify({"ok": False, "error": "Debes iniciar sesión."}), 401
    datos = request.get_json(silent=True) or {}
    data = rpc("edureserva_crear_reserva", {
        "p_token": token_actual(),
        "p_aula_id": datos.get("aula_id"),
        "p_fecha": str(datos.get("fecha", "")).strip(),
        "p_modulo": str(datos.get("modulo", "")).strip(),
        "p_motivo": str(datos.get("motivo", "")).strip(),
    })
    return responder(data, ok_status=201)


@app.get("/api/reservas")
def api_listar_reservas():
    if not token_actual():
        return jsonify({"ok": False, "error": "Debes iniciar sesión."}), 401
    data = rpc("edureserva_reservas", {"p_token": token_actual()})
    if not data.get("ok"):
        return responder(data)
    return jsonify({"ok": True, "reservas": data.get("reservas", []), "modulos": MODULOS_HORARIO})


@app.post("/api/reservas/estado")
def api_reservas_estado():
    """Solo el responsable del aula digital aprueba o rechaza."""
    if not token_actual():
        return jsonify({"ok": False, "error": "Debes iniciar sesión."}), 401
    datos = request.get_json(silent=True) or {}
    try:
        id_reserva = int(datos.get("id"))
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": "Identificador de reserva inválido."}), 400
    data = rpc("edureserva_cambiar_estado", {
        "p_token": token_actual(),
        "p_id": id_reserva,
        "p_estado": str(datos.get("estado", "")).strip().lower(),
    })
    return responder(data)


# ---------------------------------------------------------------------------
# Cuentas: solo el administrador registra profesores nuevos
# ---------------------------------------------------------------------------
@app.get("/api/profesores")
def api_profesores():
    if not token_actual():
        return jsonify({"ok": False, "error": "Debes iniciar sesión."}), 401
    data = rpc("edureserva_profesores", {"p_token": token_actual()})
    if not data.get("ok"):
        return responder(data)
    return jsonify({"ok": True, "profesores": data.get("profesores", [])})


@app.post("/api/profesores")
def api_crear_profesor():
    """Guarda un profesor nuevo en Supabase (tabla usuarios)."""
    if not token_actual():
        return jsonify({"ok": False, "error": "Debes iniciar sesión."}), 401
    datos = request.get_json(silent=True) or {}
    data = rpc("edureserva_crear_profesor", {
        "p_token": token_actual(),
        "p_nombre": str(datos.get("nombre", "")).strip(),
        "p_email": str(datos.get("email", "")).strip(),
        "p_password": str(datos.get("password", "")),
    })
    return responder(data, ok_status=201)


if __name__ == "__main__":
    # host 0.0.0.0 permite abrir la página desde otro dispositivo de la misma red
    app.run(host="0.0.0.0", port=5000, debug=True)

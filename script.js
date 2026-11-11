/**
 * EDURESERVA — lógica del cliente.
 *
 * 1) Inicio de sesión (no hay registro público)
 * 2) Panel según el rol:
 *    - profesor: solicita reservas
 *    - responsable: aprueba o rechaza
 *    - administrador: registra profesores (se guardan en Supabase)
 */

const $ = (sel) => document.querySelector(sel);

const ui = {
  auth: $("#vista-auth"),
  app: $("#vista-app"),
  headerUser: $("#header-user"),
  headerRol: $("#header-rol"),
  btnLogout: $("#btn-logout"),
  formLogin: $("#form-login"),
  loginError: $("#login-error"),
  tabs: $("#tabs"),
  panel: $("#panel"),
};

let usuarioActual = null;

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin",
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText || "Error de red");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function mostrarError(el, msg) {
  if (!el) return;
  el.hidden = !msg;
  el.textContent = msg || "";
}

function setVista(autenticado) {
  ui.auth.classList.toggle("active", !autenticado);
  ui.app.classList.toggle("active", autenticado);
}

function entrar(usuario) {
  usuarioActual = usuario;
  ui.headerUser.textContent = usuario.nombre || usuario.email || "Usuario";
  ui.headerRol.textContent = usuario.rol || "";
  ui.headerRol.className = "badge rol-" + (usuario.rol || "");
  setVista(true);
  armarTabs();
  cargarPanelInicial();
}

function salir() {
  usuarioActual = null;
  setVista(false);
  ui.panel.innerHTML = "";
  ui.tabs.innerHTML = "";
}

ui.formLogin?.addEventListener("submit", async (e) => {
  e.preventDefault();
  mostrarError(ui.loginError, "");
  const email = $("#email")?.value?.trim();
  const password = $("#password")?.value || "";
  try {
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    entrar(data);
  } catch (err) {
    mostrarError(ui.loginError, err.message || "Credenciales incorrectas");
  }
});

ui.btnLogout?.addEventListener("click", async () => {
  try {
    await api("/api/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
  salir();
});

function armarTabs() {
  const rol = usuarioActual?.rol;
  const items = [];
  if (rol === "profesor") {
    items.push({ id: "reservar", label: "Reservar" });
    items.push({ id: "mis-reservas", label: "Mis reservas" });
  } else if (rol === "responsable") {
    items.push({ id: "solicitudes", label: "Solicitudes" });
  } else if (rol === "administrador") {
    items.push({ id: "profesores", label: "Profesores" });
  }
  ui.tabs.innerHTML = items
    .map(
      (t, i) =>
        `<button type="button" class="tab${i === 0 ? " active" : ""}" data-tab="${t.id}">${t.label}</button>`
    )
    .join("");
  ui.tabs.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      ui.tabs.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      mostrarPanel(btn.dataset.tab);
    });
  });
}

async function cargarPanelInicial() {
  const first = ui.tabs.querySelector(".tab");
  if (first) mostrarPanel(first.dataset.tab);
}

async function mostrarPanel(id) {
  ui.panel.innerHTML = "<p class=\"cargando\">Cargando…</p>";
  try {
    if (id === "reservar") await panelReservar();
    else if (id === "mis-reservas") await panelMisReservas();
    else if (id === "solicitudes") await panelSolicitudes();
    else if (id === "profesores") await panelProfesores();
  } catch (err) {
    ui.panel.innerHTML = `<p class="error">${err.message || "Error al cargar"}</p>`;
  }
}

async function panelReservar() {
  const aulasData = await api("/api/aulas");
  const aulas = aulasData.aulas || [];
  const modulos = aulasData.modulos || [];
  ui.panel.innerHTML = `
    <h2>Nueva reserva</h2>
    <form id="form-reserva" class="form-card">
      <label>Aula / espacio
        <select id="aula_id" required>
          <option value="">Seleccionar…</option>
          ${aulas.map((a) => `<option value="${a.id}">${a.nombre}</option>`).join("")}
        </select>
      </label>
      <label>Fecha
        <input type="date" id="fecha" required />
      </label>
      <label>Módulo
        <select id="modulo" required>
          <option value="">Seleccionar…</option>
          ${modulos.map((m) => `<option value="${m.id}">${m.etiqueta} (${m.horario})</option>`).join("")}
        </select>
      </label>
      <label>Motivo
        <textarea id="motivo" rows="3" required placeholder="Motivo de la reserva"></textarea>
      </label>
      <button type="submit" class="btn primary">Enviar solicitud</button>
      <p id="reserva-msg" class="mensaje" role="status"></p>
    </form>
  `;
  $("#form-reserva").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#reserva-msg");
    mostrarError(msg, "");
    try {
      await api("/api/reservas", {
        method: "POST",
        body: JSON.stringify({
          aula_id: $("#aula_id").value,
          fecha: $("#fecha").value,
          modulo: $("#modulo").value,
          motivo: $("#motivo").value.trim(),
        }),
      });
      msg.className = "mensaje ok";
      msg.textContent = "Solicitud enviada correctamente.";
      e.target.reset();
    } catch (err) {
      msg.className = "mensaje error";
      msg.textContent = err.message || "No se pudo enviar";
    }
  });
}

async function panelMisReservas() {
  const data = await api("/api/reservas");
  const reservas = data.reservas || [];
  if (!reservas.length) {
    ui.panel.innerHTML = "<h2>Mis reservas</h2><p>No tenés reservas todavía.</p>";
    return;
  }
  ui.panel.innerHTML = `
    <h2>Mis reservas</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Espacio</th><th>Fecha</th><th>Módulo</th><th>Estado</th><th>Motivo</th></tr></thead>
        <tbody>
          ${reservas
            .map(
              (r) => `
            <tr>
              <td>${r.aula_nombre || r.aula_id}</td>
              <td>${r.fecha}</td>
              <td>${r.modulo}</td>
              <td><span class="estado ${r.estado}">${r.estado}</span></td>
              <td>${r.motivo || ""}</td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function panelSolicitudes() {
  const data = await api("/api/reservas");
  const reservas = (data.reservas || []).filter((r) => r.estado === "pendiente");
  if (!reservas.length) {
    ui.panel.innerHTML = "<h2>Solicitudes pendientes</h2><p>No hay solicitudes pendientes.</p>";
    return;
  }
  ui.panel.innerHTML = `
    <h2>Solicitudes pendientes</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Profesor</th><th>Espacio</th><th>Fecha</th><th>Módulo</th><th>Motivo</th><th>Acciones</th></tr></thead>
        <tbody>
          ${reservas
            .map(
              (r) => `
            <tr data-id="${r.id}">
              <td>${r.profesor_nombre || r.email || ""}</td>
              <td>${r.aula_nombre || r.aula_id}</td>
              <td>${r.fecha}</td>
              <td>${r.modulo}</td>
              <td>${r.motivo || ""}</td>
              <td class="acciones">
                <button type="button" class="btn small ok" data-accion="aprobada">Aprobar</button>
                <button type="button" class="btn small danger" data-accion="rechazada">Rechazar</button>
              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <p id="encargado-mensaje" class="mensaje" role="status"></p>
  `;
  ui.panel.querySelectorAll("[data-accion]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const tr = btn.closest("tr");
      const id = tr?.dataset.id;
      const estado = btn.dataset.accion;
      const msg = $("#encargado-mensaje");
      try {
        await api("/api/reservas/estado", {
          method: "POST",
          body: JSON.stringify({ id: Number(id), estado }),
        });
        tr.remove();
        msg.className = "mensaje ok";
        msg.textContent = `Reserva ${estado}.`;
      } catch (err) {
        msg.className = "mensaje error";
        msg.textContent = err.message || "Error";
      }
    });
  });
}

async function panelProfesores() {
  const data = await api("/api/profesores");
  const profesores = data.profesores || [];
  ui.panel.innerHTML = `
    <h2>Profesores</h2>
    <form id="form-profesor" class="form-card">
      <h3>Registrar profesor</h3>
      <label>Nombre <input type="text" id="prof-nombre" required /></label>
      <label>Email <input type="email" id="prof-email" required /></label>
      <label>Contraseña <input type="password" id="prof-password" required minlength="4" /></label>
      <button type="submit" class="btn primary">Crear cuenta</button>
      <p id="prof-msg" class="mensaje" role="status"></p>
    </form>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Nombre</th><th>Email</th></tr></thead>
        <tbody>
          ${profesores
            .map((p) => `<tr><td>${p.nombre}</td><td>${p.email}</td></tr>`)
            .join("") || "<tr><td colspan=\"2\">Sin profesores registrados</td></tr>"}
        </tbody>
      </table>
    </div>
  `;
  $("#form-profesor").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#prof-msg");
    try {
      await api("/api/profesores", {
        method: "POST",
        body: JSON.stringify({
          nombre: $("#prof-nombre").value.trim(),
          email: $("#prof-email").value.trim(),
          password: $("#prof-password").value,
        }),
      });
      msg.className = "mensaje ok";
      msg.textContent = "Profesor creado.";
      e.target.reset();
      panelProfesores();
    } catch (err) {
      msg.className = "mensaje error";
      msg.textContent = err.message || "Error al crear";
    }
  });
}

(async function iniciar() {
  try {
    const data = await api("/api/sesion");
    if (data.autenticado) entrar(data.usuario);
  } catch {
    /* sin sesión: se muestra el login */
  }
})();

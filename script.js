document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const notify = message => alert(message);

  let activeUser = null;
  let appointmentsList = [];
  let calendarDate = new Date();
  let currentPage = "dashboard";

  async function apiRequest(action, options = {}) {
    try {
      const res = await fetch(`api.php?action=${action}`, {
        headers: { "Content-Type": "application/json" },
        ...options
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "An error occurred");
      return data;
    } catch (err) {
      throw err;
    }
  }

  function showError(element, message) {
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
  }

  function hideError(element) {
    if (!element) return;
    element.textContent = "";
    element.hidden = true;
  }

  function switchAuthView(target = "login") {
    document.body.classList.remove("dashboard-mode");
    $$(".view-screen").forEach(screen => screen.classList.toggle("active", screen.id === `${target}-view`));
    if ($("#authSwitcher")) $("#authSwitcher").style.display = "flex";
  }

  async function initSession() {
    try {
      const res = await apiRequest("session");
      if (res.isLoggedIn) {
        activeUser = res.user;
        showDashboard();
      } else {
        switchAuthView("login");
      }
    } catch {
      switchAuthView("login");
    }
  }

  async function showDashboard() {
    document.body.classList.add("dashboard-mode");
    $$(".view-screen").forEach(screen => screen.classList.toggle("active", screen.id === "dashboard-view"));
    if ($("#authSwitcher")) $("#authSwitcher").style.display = "none";

    updateProfile();
    await loadAppointments();
    renderPage("dashboard");
  }

  function updateProfile() {
    if (!activeUser) return;
    $("#displayUsername").textContent = activeUser.name;
    const roleElem = $(".user-role");
    if (roleElem) roleElem.textContent = activeUser.role.toUpperCase();
    const initialsElem = $("#profileInitials");
    if (initialsElem) initialsElem.textContent = activeUser.name.split(" ").map(n => n[0]).join("").toUpperCase();
  }

  async function loadAppointments() {
    try {
      appointmentsList = await apiRequest("get_appointments");
    } catch (err) {
      notify(err.message);
    }
  }

  // Auth Events
  const loginForm = $("#loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async e => {
      e.preventDefault();
      hideError($("#loginError"));
      try {
        const res = await apiRequest("login", {
          method: "POST",
          body: JSON.stringify({
            username: $("#loginUsername").value,
            password: $("#loginPassword").value
          })
        });
        activeUser = res.user;
        showDashboard();
      } catch (err) {
        showError($("#loginError"), err.message);
      }
    });
  }

  const signupForm = $("#signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", async e => {
      e.preventDefault();
      hideError($("#signupError"));
      try {
        await apiRequest("signup", {
          method: "POST",
          body: JSON.stringify({
            name: $("#fullName").value,
            email: $("#signupEmail").value,
            password: $("#signupPassword").value
          })
        });
        notify("Account created successfully! You can now log in.");
        switchAuthView("login");
      } catch (err) {
        showError($("#signupError"), err.message);
      }
    });
  }

  const logoutBtn = $("#logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async e => {
      e.preventDefault();
      await apiRequest("logout");
      activeUser = null;
      switchAuthView("login");
    });
  }

  $$(".switcher-btn").forEach(button => {
    button.addEventListener("click", () => {
      switchAuthView(button.dataset.target);
    });
  });

  $$(".switch-to-signup").forEach(button => {
    button.addEventListener("click", () => {
      hideError($("#loginError"));
      switchAuthView("signup");
    });
  });

  $$(".switch-to-login").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      hideError($("#signupError"));
      switchAuthView("login");
    });
  });

  $$(".toggle-password").forEach(button => {
    button.addEventListener("click", () => {
      const input = $(`#${button.dataset.for}`);
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      const icon = $("i", button);
      if (icon) {
        icon.classList.toggle("fa-eye", !show);
        icon.classList.toggle("fa-eye-slash", show);
      }
      button.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });

  function formatDate(dateString) {
    const date = new Date(`${dateString}T12:00:00`);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function formatTime(timeString) {
    const [hours, minutes] = timeString.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }

  function getUpcoming() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return appointmentsList
      .filter(item => new Date(`${item.date}T00:00:00`) >= today && !["Cancelled", "Completed"].includes(item.status))
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }

  function appointmentRow(item) {
    const isAdmin = activeUser?.role === "admin";
    return `
      <tr>
        <td>
          <div class="date-cell">
            <i class="fa-regular fa-calendar icon"></i>
            <div>
              <strong>${escapeHTML(formatDate(item.date))}</strong>
              <span class="time-sub">${escapeHTML(formatTime(item.time))}</span>
            </div>
          </div>
        </td>
        ${isAdmin ? `<td>${escapeHTML(item.owner)}</td>` : ""}
        <td>${escapeHTML(item.service)}</td>
        <td><span class="status-badge ${item.status.toLowerCase()}">${escapeHTML(item.status)}</span></td>
        <td>
          <div class="action-cell">
            ${isAdmin ? `
              <button class="table-action-btn" data-admin-action="Confirmed" data-id="${item.id}">Confirm</button>
              <button class="table-action-btn" data-admin-action="Completed" data-id="${item.id}">Complete</button>
            ` : ""}
            <button type="button" class="table-action-btn" data-action="view" data-id="${item.id}">View</button>
            ${!["Cancelled", "Completed"].includes(item.status) ? `
              <button type="button" class="table-action-btn cancel" data-action="cancel" data-id="${item.id}">Cancel</button>
            ` : ""}
          </div>
        </td>
      </tr>
    `;
  }

  function appointmentsTable(items, emptyMessage = "No appointments found.") {
    const search = $("#searchInput")?.value.trim().toLowerCase() || "";
    const filtered = items.filter(item =>
      `${item.service} ${item.status} ${item.date} ${item.time} ${item.owner || ""}`
        .toLowerCase()
        .includes(search)
    );
    const isAdmin = activeUser?.role === "admin";

    return `
      <div class="table-responsive">
        <table class="appointments-table">
          <thead>
            <tr>
              <th>Date &amp; Time</th>
              ${isAdmin ? "<th>Student / User</th>" : ""}
              <th>Service</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${
              filtered.length
                ? filtered.map(appointmentRow).join("")
                : `<tr><td colspan="${isAdmin ? 5 : 4}" class="empty-state">${escapeHTML(emptyMessage)}</td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;
  }

  function getMetrics() {
    const completed = appointmentsList.filter(a => a.status === "Completed").length;
    const pending = appointmentsList.filter(a => a.status === "Pending").length;
    const cancelled = appointmentsList.filter(a => a.status === "Cancelled").length;
    return {
      upcoming: getUpcoming().length,
      completed,
      pending,
      cancelled,
      total: appointmentsList.length
    };
  }

  function dashboardTemplate() {
    const metrics = getMetrics();
    const upcoming = getUpcoming().slice(0, 5);
    const recent = [...appointmentsList]
      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
      .slice(0, 4);

    return `
      <div class="dashboard-greeting">
        <div>
          <h2 id="greetingText">Welcome, ${escapeHTML(activeUser?.name.split(" ")[0])}!</h2>
          <p>Here's what's happening with your appointments.</p>
        </div>
        <div class="current-date">
          <span>${escapeHTML(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }))}</span>
          <i class="fa-regular fa-calendar"></i>
        </div>
      </div>

      <div class="metrics-grid">
        ${metricCard("blue", "Upcoming Appointments", metrics.upcoming, "fa-calendar")}
        ${metricCard("green", "Completed", metrics.completed, "fa-square-check")}
        ${metricCard("yellow", "Pending", metrics.pending, "fa-clock")}
        ${metricCard("red", "Cancelled", metrics.cancelled, "fa-circle-xmark")}
      </div>

      <div class="content-grid">
        <div class="left-column">
          <div class="panel calendar-panel">
            <div class="calendar-header">
              <span class="calendar-month"></span>
              <div class="calendar-nav">
                <button type="button" class="cal-btn" id="prevMonth" aria-label="Previous month"><i class="fa-solid fa-chevron-left"></i></button>
                <button type="button" class="cal-btn" id="nextMonth" aria-label="Next month"><i class="fa-solid fa-chevron-right"></i></button>
              </div>
            </div>
            <div class="calendar-grid"></div>
          </div>
          <button class="btn btn-primary btn-block" data-page="book">
            <i class="fa-regular fa-calendar-plus"></i> Book an Appointment
          </button>
        </div>

        <div class="right-column">
          <div class="panel">
            <div class="panel-header">
              <h3>Upcoming Appointments</h3>
              <a href="#" class="view-all-link" data-page="appointments">View All</a>
            </div>
            ${appointmentsTable(upcoming, "No upcoming appointments.")}
          </div>
        </div>
      </div>

      <div class="bottom-grid">
        <div class="panel">
          <div class="panel-header"><h3>Recent Appointments</h3></div>
          <div class="recent-list">
            ${
              recent.length
                ? recent.map(item => `
                  <div class="recent-item">
                    <div class="recent-info">
                      <i class="fa-regular fa-calendar-check icon ${
                        item.status === "Completed" ? "green-icon" :
                        item.status === "Cancelled" ? "red-icon" : "yellow-icon"
                      }"></i>
                      <div>
                        <div class="recent-date">${escapeHTML(formatDate(item.date))} • ${escapeHTML(formatTime(item.time))}</div>
                        <div class="recent-service">${escapeHTML(item.service)}</div>
                      </div>
                    </div>
                    <span class="status-tag ${
                      item.status === "Completed" ? "green" :
                      item.status === "Cancelled" ? "red" : "yellow"
                    }">${escapeHTML(item.status)}</span>
                  </div>
                `).join("")
                : `<p class="form-note">No appointment history yet.</p>`
            }
          </div>
          <div class="recent-footer">
            <a href="#" data-page="history">View History <i class="fa-solid fa-arrow-right"></i></a>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header"><h3>Quick Actions</h3></div>
          <div class="quick-actions-grid">
            <button class="quick-action-card" data-page="book">
              <i class="fa-regular fa-calendar-plus icon"></i><span>Book Appointment</span>
            </button>
            <button class="quick-action-card" data-page="appointments">
              <i class="fa-regular fa-calendar-days icon"></i><span>Manage Schedule</span>
            </button>
            <button class="quick-action-card" data-page="reports">
              <i class="fa-solid fa-chart-column icon"></i><span>View Reports</span>
            </button>
            <button class="quick-action-card" data-page="history">
              <i class="fa-regular fa-clock icon"></i><span>Appointment History</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function metricCard(color, title, value, icon) {
    return `
      <div class="metric-card ${color}" role="button" tabindex="0" data-metric="${escapeHTML(title)}">
        <div class="metric-header">
          <div class="icon-wrapper"><i class="fa-regular ${icon.includes("calendar") ? "fa-calendar" : ""} fa-${icon}"></i></div>
        </div>
        <div class="metric-title">${escapeHTML(title)}</div>
        <div class="metric-value-row">
          <span class="metric-value">${value}</span>
          <i class="fa-solid fa-chevron-right arrow"></i>
        </div>
      </div>
    `;
  }

  const pageNames = {
    dashboard: "Dashboard",
    book: "Book Appointment",
    appointments: "My Appointments",
    history: "Appointment History",
    reports: "Reports",
    settings: "Settings"
  };

  function setActiveNav(page) {
    $$(".sidebar-nav li").forEach(li => li.classList.remove("active"));
    const link = $(`.nav-item-btn[data-page="${page}"]`);
    if (link) link.closest("li")?.classList.add("active");
    $$('.sidebar-footer [data-page]').forEach(item => {
      item.classList.toggle("active", item.dataset.page === page);
    });
  }

  function pageHeading(title, subtitle) {
    return `
      <div class="page-heading">
        <div>
          <h2>${escapeHTML(title)}</h2>
          <p>${escapeHTML(subtitle)}</p>
        </div>
      </div>
    `;
  }

  function renderAppointmentsPage(historyOnly = false) {
    const items = historyOnly
      ? appointmentsList.filter(a => ["Completed", "Cancelled"].includes(a.status))
      : appointmentsList;

    return `
      ${pageHeading(
        historyOnly ? "Appointment History" : "My Appointments",
        historyOnly ? "Review your completed and cancelled appointments." : "View and manage all appointments."
      )}
      <div class="page-card">
        <div class="panel-header">
          <h3>${historyOnly ? "Past Appointments" : "All Appointments"}</h3>
          ${!historyOnly ? `
            <button type="button" class="btn btn-primary" data-page="book">
              <i class="fa-solid fa-plus"></i> Book Appointment
            </button>` : ""}
        </div>
        ${appointmentsTable(items)}
      </div>
    `;
  }

  function renderReportsPage() {
    const metrics = getMetrics();
    return `
      ${pageHeading("Reports", "Summary of system appointment activity.")}
      <div class="report-cards">
        <div class="report-card"><span>Total Appointments</span><strong>${metrics.total}</strong></div>
        <div class="report-card"><span>Upcoming</span><strong>${metrics.upcoming}</strong></div>
        <div class="report-card"><span>Completed</span><strong>${metrics.completed}</strong></div>
        <div class="report-card"><span>Cancelled</span><strong>${metrics.cancelled}</strong></div>
      </div>
      <div class="page-card">
        <div class="panel-header"><h3>Appointment Report</h3></div>
        ${appointmentsTable(appointmentsList, "No data available for the report.")}
        <p class="form-note">This report displays records stored in the MySQL database.</p>
        <button type="button" class="btn btn-outline" id="printReport">
          <i class="fa-solid fa-print"></i> Print Report
        </button>
      </div>
    `;
  }

  function renderBookingPage() {
    const today = new Date();
    const minDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0")
    ].join("-");

    return `
      ${pageHeading("Book Appointment", "Fill out the form to schedule an appointment.")}
      <div class="page-card">
        <form id="bookingForm" class="booking-form">
          <label for="bookingService">Service</label>
          <select id="bookingService" required>
            <option value="">Select a service</option>
            <option>Consultation</option>
            <option>Follow-up</option>
            <option>Document Request</option>
            <option>General Inquiry</option>
          </select>

          <label for="bookingDate">Appointment Date</label>
          <input id="bookingDate" type="date" min="${minDate}" required>

          <label for="bookingTime">Appointment Time</label>
          <input id="bookingTime" type="time" required>

          <button type="submit" class="btn btn-primary">
            <i class="fa-regular fa-calendar-check"></i> Confirm Appointment
          </button>
        </form>
      </div>
    `;
  }

  function renderSettingsPage() {
    return `
      ${pageHeading("Settings", "Update your account information.")}
      <div class="page-card">
        <form id="settingsForm" class="settings-form">
          <label for="settingsName">Full Name</label>
          <input id="settingsName" type="text" value="${escapeHTML(activeUser?.name || "")}" required>

          <label for="settingsEmail">Email Address</label>
          <input id="settingsEmail" type="email" value="${escapeHTML(activeUser?.email || "")}" disabled>

          <button type="submit" class="btn btn-primary">
            <i class="fa-solid fa-floppy-disk"></i> Save Changes
          </button>
        </form>
      </div>
    `;
  }

  async function renderPage(page) {
    if (!activeUser) {
      switchAuthView("login");
      return;
    }
    if (!pageNames[page]) page = "dashboard";
    currentPage = page;
    setActiveNav(page);
    if ($("#searchInput")) $("#searchInput").value = "";

    await loadAppointments();

    const pageContent = $("#pageContent");
    if (!pageContent) return;

    switch (page) {
      case "dashboard":
        pageContent.innerHTML = dashboardTemplate();
        updateProfile();
        renderCalendar();
        break;
      case "book":
        pageContent.innerHTML = renderBookingPage();
        break;
      case "appointments":
        pageContent.innerHTML = renderAppointmentsPage(false);
        break;
      case "history":
        pageContent.innerHTML = renderAppointmentsPage(true);
        break;
      case "reports":
        pageContent.innerHTML = renderReportsPage();
        break;
      case "settings":
        pageContent.innerHTML = renderSettingsPage();
        break;
    }
  }

  document.addEventListener("click", event => {
    const pageButton = event.target.closest("[data-page]");
    if (pageButton) {
      event.preventDefault();
      if (!activeUser) {
        switchAuthView("login");
        return;
      }
      renderPage(pageButton.dataset.page);
    }
  });

  document.addEventListener("submit", async event => {
    if (event.target.id === "bookingForm") {
      event.preventDefault();
      try {
        await apiRequest("book_appointment", {
          method: "POST",
          body: JSON.stringify({
            service: $("#bookingService").value,
            date: $("#bookingDate").value,
            time: $("#bookingTime").value
          })
        });
        notify("Appointment booked successfully!");
        renderPage("appointments");
      } catch (err) {
        notify(err.message);
      }
    } else if (event.target.id === "settingsForm") {
      event.preventDefault();
      const newName = $("#settingsName").value.trim();
      if (!newName) return;
      try {
        await apiRequest("update_profile", {
          method: "POST",
          body: JSON.stringify({ name: newName })
        });
        activeUser.name = newName;
        updateProfile();
        renderPage("settings");
        notify("Account updated successfully.");
      } catch (err) {
        notify(err.message);
      }
    }
  });

  document.addEventListener("click", async event => {
    const cancelBtn = event.target.closest('[data-action="cancel"]');
    const adminBtn = event.target.closest('[data-admin-action]');
    const viewBtn = event.target.closest('[data-action="view"]');

    if (cancelBtn) {
      if (!confirm("Are you sure you want to cancel this appointment?")) return;
      await apiRequest("update_status", {
        method: "POST",
        body: JSON.stringify({ id: Number(cancelBtn.dataset.id), status: "Cancelled" })
      });
      renderPage(currentPage);
    }

    if (adminBtn) {
      await apiRequest("update_status", {
        method: "POST",
        body: JSON.stringify({ id: Number(adminBtn.dataset.id), status: adminBtn.dataset.adminAction })
      });
      renderPage(currentPage);
    }

    if (viewBtn) {
      const id = Number(viewBtn.dataset.id);
      const item = appointmentsList.find(a => a.id === id);
      if (item) {
        notify(
          `Appointment Details\n\nService: ${item.service}\n` +
          `Date: ${formatDate(item.date)}\n` +
          `Time: ${formatTime(item.time)}\nStatus: ${item.status}` +
          (item.owner ? `\nUser: ${item.owner}` : "")
        );
      }
    }
  });

  function renderCalendar() {
    const grid = $(".calendar-grid");
    const label = $(".calendar-month");
    if (!grid || !label) return;

    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    label.textContent = calendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayString = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0")
    ].join("-");

    const appointmentDates = new Set(
      appointmentsList.filter(a => a.status !== "Cancelled").map(a => a.date)
    );

    let html = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      .map(day => `<div class="day-name">${day}</div>`)
      .join("");

    for (let i = 0; i < firstDay; i++) {
      html += `<div class="day-cell" aria-hidden="true"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const hasAppointment = appointmentDates.has(dateString);
      const active = dateString === todayString;

      html += `
        <button type="button"
          class="day-cell ${active ? "active" : ""} ${hasAppointment ? "has-appointment" : ""}"
          data-date="${dateString}">
          ${day}
        </button>
      `;
    }
    grid.innerHTML = html;
  }

  document.addEventListener("click", event => {
    if (event.target.closest("#prevMonth")) {
      calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
      renderCalendar();
    }
    if (event.target.closest("#nextMonth")) {
      calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
      renderCalendar();
    }
    const dateButton = event.target.closest(".calendar-grid [data-date]");
    if (dateButton) {
      const date = dateButton.dataset.date;
      const matches = appointmentsList.filter(a => a.date === date);
      notify(
        `${formatDate(date)}\n\n` +
        (matches.length
          ? matches.map(a => `${formatTime(a.time)} — ${a.service} (${a.status})`).join("\n")
          : "No appointments scheduled for this date.")
      );
    }
  });

  document.addEventListener("input", event => {
    if (event.target.id === "searchInput") {
      const query = event.target.value.trim().toLowerCase();
      $$(".appointments-table tbody tr").forEach(row => {
        row.hidden = !row.textContent.toLowerCase().includes(query);
      });
    }
  });

  document.addEventListener("click", event => {
    if (event.target.closest("#printReport")) {
      window.print();
    }
  });

  const bellBtn = $("#bellBtn");
  if (bellBtn) {
    bellBtn.addEventListener("click", () => {
      const pending = appointmentsList.filter(a => a.status === "Pending");
      notify(
        pending.length
          ? `You have ${pending.length} pending appointment(s).`
          : "You have no pending appointment notifications."
      );
    });
  }

  initSession();
});
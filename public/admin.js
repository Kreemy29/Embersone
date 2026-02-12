/* ============================================
   EMBERSOME ADMIN — Dashboard (Real Data Only)
   ============================================ */
(function () {
  'use strict';

  var mainEl = document.getElementById('main');
  var sidebar = document.getElementById('sidebar');
  var menuToggle = document.getElementById('menuToggle');
  var sidebarLinks = document.querySelectorAll('.sidebar__link');
  var logoutBtn = document.getElementById('logoutBtn');
  var currentView = 'overview';

  // ---- Auth Check ----
  fetch('/api/auth/check')
    .then(function (r) { return r.json(); })
    .then(function (d) { if (!d.authenticated) window.location.href = '/login'; })
    .catch(function () { window.location.href = '/login'; });

  // ---- Logout ----
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      fetch('/api/auth/logout', { method: 'POST' })
        .then(function () { window.location.href = '/login'; });
    });
  }

  // ---- Mobile Menu ----
  menuToggle.addEventListener('click', function () {
    sidebar.classList.toggle('open');
  });

  // ---- Helpers ----
  function timeAgo(dateStr) {
    if (!dateStr) return '—';
    var diff = Date.now() - new Date(dateStr).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    if (days < 7) return days + 'd ago';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  function escHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Navigation ----
  function setActiveNav(view) {
    currentView = view;
    sidebarLinks.forEach(function (l) {
      l.classList.toggle('active', l.getAttribute('data-view') === view);
    });
  }

  sidebarLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      var view = link.getAttribute('data-view');
      setActiveNav(view);
      renderView(view);
      sidebar.classList.remove('open');
    });
  });

  function renderView(view) {
    switch (view) {
      case 'overview': renderOverview(); break;
      case 'applications': renderApplications(); break;
      case 'bookings': renderBookings(); break;
    }
  }

  // ============================================
  //  OVERVIEW
  // ============================================
  function renderOverview() {
    mainEl.innerHTML = '<div class="loading-screen"><div class="loader"></div></div>';

    fetch('/api/admin/dashboard')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var a = data.applications;
        var b = data.bookings;

        var html = '<div class="view-header"><h1>Overview</h1><p>Real-time request tracking</p></div>';

        // Stat cards
        html += '<div class="stats-grid">';
        html += statCard('Total Requests', data.totalRequests, 'All time', 'ember');
        html += statCard('Applications', a.total, a.today + ' today · ' + a.thisWeek + ' this week', 'amber');
        html += statCard('Call Bookings', b.total, b.today + ' today · ' + b.thisWeek + ' this week', 'blue');
        html += statCard('Today', a.today + b.today, 'New requests today', a.today + b.today > 0 ? 'green' : '');
        html += '</div>';

        // Show empty state or recent requests
        if (data.totalRequests === 0) {
          html += '<div class="empty-state">';
          html += '<div class="empty-state__icon">📭</div>';
          html += '<h3>No requests yet</h3>';
          html += '<p>When someone submits an application or books a call on the site, it\'ll show up here.</p>';
          html += '</div>';
        } else {
          // Load recent of both
          Promise.all([
            fetch('/api/admin/applications').then(function (r) { return r.json(); }),
            fetch('/api/admin/bookings').then(function (r) { return r.json(); })
          ]).then(function (results) {
            var apps = results[0].slice(0, 5);
            var books = results[1].slice(0, 5);
            var recentHtml = '';

            if (apps.length > 0) {
              recentHtml += '<div class="table-wrap"><div class="table-wrap__header"><span class="table-wrap__title">Recent Applications</span><span class="table-wrap__badge">' + a.total + ' total</span></div>';
              recentHtml += '<div class="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Platforms</th><th>Audience</th><th>When</th></tr></thead><tbody>';
              apps.forEach(function (app) {
                recentHtml += '<tr><td><strong>' + escHtml(app.name) + '</strong></td>';
                recentHtml += '<td><a href="mailto:' + escHtml(app.email) + '" style="color:var(--amber)">' + escHtml(app.email) + '</a></td>';
                recentHtml += '<td>' + (escHtml(app.platforms) || '<span style="color:var(--text-dim)">—</span>') + '</td>';
                recentHtml += '<td>' + (escHtml(app.audience) || '<span style="color:var(--text-dim)">—</span>') + '</td>';
                recentHtml += '<td>' + timeAgo(app.submittedAt) + '</td></tr>';
              });
              recentHtml += '</tbody></table></div></div>';
            }

            if (books.length > 0) {
              recentHtml += '<div class="table-wrap"><div class="table-wrap__header"><span class="table-wrap__title">Recent Call Bookings</span><span class="table-wrap__badge">' + b.total + ' total</span></div>';
              recentHtml += '<div class="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Preferred Time</th><th>Topic</th><th>When</th></tr></thead><tbody>';
              books.forEach(function (bk) {
                recentHtml += '<tr><td><strong>' + escHtml(bk.name) + '</strong></td>';
                recentHtml += '<td><a href="mailto:' + escHtml(bk.email) + '" style="color:var(--amber)">' + escHtml(bk.email) + '</a></td>';
                recentHtml += '<td>' + (escHtml(bk.preferredTime) || '<span style="color:var(--text-dim)">—</span>') + '</td>';
                recentHtml += '<td>' + (escHtml(bk.topic) || '<span style="color:var(--text-dim)">—</span>') + '</td>';
                recentHtml += '<td>' + timeAgo(bk.submittedAt) + '</td></tr>';
              });
              recentHtml += '</tbody></table></div></div>';
            }

            var target = document.getElementById('recentArea');
            if (target) target.innerHTML = recentHtml;
          });

          html += '<div id="recentArea"><div class="loading-screen" style="min-height:200px"><div class="loader"></div></div></div>';
        }

        mainEl.innerHTML = html;
      });
  }

  // ============================================
  //  APPLICATIONS
  // ============================================
  function renderApplications() {
    mainEl.innerHTML = '<div class="loading-screen"><div class="loader"></div></div>';

    fetch('/api/admin/applications')
      .then(function (r) { return r.json(); })
      .then(function (apps) {
        var html = '<div class="view-header"><h1>Applications</h1><p>' + apps.length + ' total</p></div>';

        if (apps.length === 0) {
          html += '<div class="empty-state"><div class="empty-state__icon">📋</div><h3>No applications yet</h3><p>Applications from the "Apply" form will appear here.</p></div>';
          mainEl.innerHTML = html;
          return;
        }

        html += '<div class="table-wrap"><div class="table-wrap__header"><span class="table-wrap__title">All Applications</span><span class="table-wrap__badge">' + apps.length + '</span></div>';
        html += '<div class="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Platforms</th><th>Audience</th><th>Message</th><th>Submitted</th><th></th></tr></thead><tbody>';

        apps.forEach(function (app) {
          html += '<tr data-id="' + app.id + '">';
          html += '<td><strong>' + escHtml(app.name) + '</strong></td>';
          html += '<td><a href="mailto:' + escHtml(app.email) + '" style="color:var(--amber)">' + escHtml(app.email) + '</a></td>';
          html += '<td>' + (escHtml(app.platforms) || '<span style="color:var(--text-dim)">—</span>') + '</td>';
          html += '<td>' + (escHtml(app.audience) || '<span style="color:var(--text-dim)">—</span>') + '</td>';
          html += '<td style="max-width:200px;white-space:normal;line-height:1.5">' + (escHtml(app.message) || '<span style="color:var(--text-dim)">—</span>') + '</td>';
          html += '<td>' + formatDate(app.submittedAt) + '</td>';
          html += '<td><button class="delete-btn" data-type="applications" data-id="' + app.id + '" title="Delete">✕</button></td>';
          html += '</tr>';
        });

        html += '</tbody></table></div></div>';
        mainEl.innerHTML = html;
        bindDeleteButtons();
      });
  }

  // ============================================
  //  BOOKINGS
  // ============================================
  function renderBookings() {
    mainEl.innerHTML = '<div class="loading-screen"><div class="loader"></div></div>';

    fetch('/api/admin/bookings')
      .then(function (r) { return r.json(); })
      .then(function (books) {
        var html = '<div class="view-header"><h1>Call Bookings</h1><p>' + books.length + ' total</p></div>';

        if (books.length === 0) {
          html += '<div class="empty-state"><div class="empty-state__icon">📞</div><h3>No call bookings yet</h3><p>Bookings from the "Book a Call" form will appear here.</p></div>';
          mainEl.innerHTML = html;
          return;
        }

        html += '<div class="table-wrap"><div class="table-wrap__header"><span class="table-wrap__title">All Call Bookings</span><span class="table-wrap__badge">' + books.length + '</span></div>';
        html += '<div class="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Preferred Time</th><th>Topic</th><th>Submitted</th><th></th></tr></thead><tbody>';

        books.forEach(function (bk) {
          html += '<tr data-id="' + bk.id + '">';
          html += '<td><strong>' + escHtml(bk.name) + '</strong></td>';
          html += '<td><a href="mailto:' + escHtml(bk.email) + '" style="color:var(--amber)">' + escHtml(bk.email) + '</a></td>';
          html += '<td>' + (escHtml(bk.preferredTime) || '<span style="color:var(--text-dim)">—</span>') + '</td>';
          html += '<td style="max-width:250px;white-space:normal;line-height:1.5">' + (escHtml(bk.topic) || '<span style="color:var(--text-dim)">—</span>') + '</td>';
          html += '<td>' + formatDate(bk.submittedAt) + '</td>';
          html += '<td><button class="delete-btn" data-type="bookings" data-id="' + bk.id + '" title="Delete">✕</button></td>';
          html += '</tr>';
        });

        html += '</tbody></table></div></div>';
        mainEl.innerHTML = html;
        bindDeleteButtons();
      });
  }

  // ---- Stat card helper ----
  function statCard(label, value, sub, color) {
    var cls = color ? ' stat-card--' + color : '';
    return '<div class="stat-card' + cls + '">' +
      '<div class="stat-card__label">' + label + '</div>' +
      '<div class="stat-card__value">' + value + '</div>' +
      '<div class="stat-card__sub">' + sub + '</div></div>';
  }

  // ---- Delete handler ----
  function bindDeleteButtons() {
    document.querySelectorAll('.delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var type = btn.getAttribute('data-type');
        var id = btn.getAttribute('data-id');
        if (!confirm('Delete this entry?')) return;

        fetch('/api/admin/' + type + '/' + id, { method: 'DELETE' })
          .then(function (r) { return r.json(); })
          .then(function () {
            // Re-render current view
            renderView(currentView);
          });
      });
    });
  }

  // ---- Inject extra styles ----
  var style = document.createElement('style');
  style.textContent = [
    '.empty-state{text-align:center;padding:80px 24px;color:var(--text-muted)}',
    '.empty-state__icon{font-size:48px;margin-bottom:16px}',
    '.empty-state h3{font-family:var(--font-serif);font-size:20px;color:var(--text-primary);margin-bottom:8px}',
    '.empty-state p{font-size:13px;max-width:360px;margin:0 auto}',
    '.delete-btn{background:none;border:none;color:var(--text-dim);font-size:14px;cursor:pointer;padding:4px 8px;border-radius:6px;transition:all 0.2s}',
    '.delete-btn:hover{color:var(--flame);background:rgba(229,57,45,0.1)}',
  ].join('\n');
  document.head.appendChild(style);

  // ---- Init ----
  renderOverview();

})();

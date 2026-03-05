/* ==========================================
   GoldMine Admin Panel - Vanilla JS SPA
   ========================================== */

// ===== State =====
const state = {
  authenticated: false,
  currentPage: 'dashboard',
  dashboardTimer: null,
};

// ===== API Helper =====
const API = {
  async request(method, url, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    };
    if (body) opts.body = JSON.stringify(body);

    const resp = await fetch(url, opts);

    if (resp.status === 401) {
      state.authenticated = false;
      navigate('login');
      throw new Error('Unauthorized');
    }

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error || `HTTP ${resp.status}`);
    }

    return data;
  },

  get: (url) => API.request('GET', url),
  post: (url, body) => API.request('POST', url, body),
  put: (url, body) => API.request('PUT', url, body),
  delete: (url) => API.request('DELETE', url),
};

// ===== Toast Notifications =====
function showToast(message, type = 'info') {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const container = document.getElementById('toast-container');

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || '•'}</span>
    <span class="toast-message">${escHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 350);
  }, 3500);
}

// ===== Utilities =====
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtDate(ts) {
  if (!ts) return '-';
  return new Date(ts * 1000).toLocaleString('ru-RU');
}

function fmtDuration(seconds) {
  if (!seconds) return '-';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function statusBadge(status) {
  return `<span class="badge badge-${escHtml(status)}">${escHtml(status)}</span>`;
}

function confirmDialog(msg) {
  return window.confirm(msg);
}

// ===== Router =====
function navigate(page) {
  if (page === 'login') {
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    return;
  }

  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').style.display = 'flex';

  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Update pages
  document.querySelectorAll('.page').forEach(el => {
    el.classList.toggle('active', el.id === `page-${page}`);
  });

  // Update header title
  const titles = {
    dashboard: 'Dashboard',
    queue: 'Очередь задач',
    schedule: 'Расписание публикаций',
    moderation: 'Модерация',
    minecraft: 'Minecraft',
    settings: 'Настройки',
    logs: 'Логи',
  };
  document.getElementById('header-title').textContent = titles[page] || page;

  state.currentPage = page;
  window.location.hash = page;

  // Load page data
  loadPage(page);
}

function loadPage(page) {
  switch (page) {
    case 'dashboard': loadDashboard(); break;
    case 'queue': loadQueue(); break;
    case 'schedule': loadSchedule(); break;
    case 'moderation': loadModeration(); break;
    case 'minecraft': loadMinecraft(); break;
    case 'settings': loadSettings(); break;
    case 'logs': loadLogs(); break;
  }
}

// ===== Auth =====
async function checkAuth() {
  try {
    const data = await fetch('/api/auth/status', { credentials: 'include' }).then(r => r.json());
    if (data.authenticated) {
      state.authenticated = true;
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      navigate(hash);
    } else {
      navigate('login');
    }
  } catch {
    navigate('login');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  try {
    await API.post('/api/auth/login', { password });
    state.authenticated = true;
    navigate('dashboard');
  } catch (err) {
    errEl.textContent = err.message === 'Invalid password' ? 'Неверный пароль' : `Ошибка: ${err.message}`;
    errEl.style.display = 'block';
  }
}

async function handleLogout() {
  try {
    await API.post('/api/auth/logout', {});
  } catch {}
  state.authenticated = false;
  navigate('login');
}

// ===== Dashboard =====
async function loadDashboard() {
  try {
    const data = await API.get('/api/dashboard');
    renderDashboard(data);
  } catch (err) {
    showToast('Ошибка загрузки dashboard: ' + err.message, 'error');
  }

  // Auto-refresh every 30s
  if (state.dashboardTimer) clearInterval(state.dashboardTimer);
  state.dashboardTimer = setInterval(() => {
    if (state.currentPage === 'dashboard') loadDashboard();
  }, 30000);
}

function renderDashboard(data) {
  const el = document.getElementById('page-dashboard');

  const mcOnline = data.minecraft?.online;
  const mcPlayers = data.minecraft?.players?.online ?? 0;
  const mcMax = data.minecraft?.players?.max ?? 0;
  const mcBadge = mcOnline
    ? `<span class="badge badge-online">● Online</span>`
    : `<span class="badge badge-offline">● Offline</span>`;

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">Общая статистика системы</p>
      </div>
      <button class="btn btn-secondary" onclick="loadDashboard()">🔄 Обновить</button>
    </div>

    <div class="stats-grid">
      <div class="stat-card info">
        <div class="stat-icon">📋</div>
        <div class="stat-value">${(data.queue?.pending || 0) + (data.queue?.processing || 0)}</div>
        <div class="stat-label">Активных задач</div>
      </div>
      <div class="stat-card success">
        <div class="stat-icon">📹</div>
        <div class="stat-value">${data.content?.todayPosts || 0} / ${data.content?.dailyLimit || 3}</div>
        <div class="stat-label">Постов сегодня</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-icon">🔇</div>
        <div class="stat-value">${data.moderation?.activeMutes || 0}</div>
        <div class="stat-label">Мутов сегодня</div>
      </div>
      <div class="stat-card danger">
        <div class="stat-icon">🚫</div>
        <div class="stat-value">${data.moderation?.activeBans || 0}</div>
        <div class="stat-label">Забанено</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <span class="card-title">⛏ Minecraft Server</span>
          ${mcBadge}
        </div>
        <div class="card-body">
          <div class="mc-status-card">
            <div class="mc-icon">⛏️</div>
            <div class="mc-info">
              <h2>${mcOnline ? (escHtml(data.minecraft?.version || '')) : 'Server Offline'}</h2>
              <p>${mcOnline ? escHtml(data.minecraft?.motd || 'GoldMine Server') : 'Сервер недоступен'}</p>
              ${mcOnline ? `<p class="text-muted mt-8">Пинг: ${data.minecraft?.latency ?? '-'}ms</p>` : ''}
            </div>
            ${mcOnline ? `
            <div class="mc-players">
              <div class="mc-players-count">${mcPlayers}</div>
              <div class="mc-players-label">/ ${mcMax} игроков</div>
            </div>` : ''}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">📊 Очередь задач</span>
        </div>
        <div class="card-body">
          ${renderQueueStats(data.queue)}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">📋 Последние действия</span>
      </div>
      <div class="card-body" style="padding: 0 20px">
        ${renderAuditLog(data.recentAudit || [])}
      </div>
    </div>
  `;
}

function renderQueueStats(queue) {
  if (!queue) return '<p class="text-muted">Нет данных</p>';
  const items = [
    { label: 'Ожидают', key: 'pending', color: 'warning' },
    { label: 'Обработка', key: 'processing', color: 'info' },
    { label: 'Запланировано', key: 'scheduled', color: 'info' },
    { label: 'Опубликовано', key: 'posted', color: 'success' },
    { label: 'Ошибок', key: 'failed', color: 'danger' },
  ];
  return items.map(i => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
      <span class="text-muted">${i.label}</span>
      <span class="text-${i.color}" style="font-weight:600">${queue[i.key] || 0}</span>
    </div>
  `).join('');
}

function renderAuditLog(items) {
  if (!items.length) return '<p class="text-muted" style="padding:16px 0">Нет событий</p>';
  const icons = { login: '🔑', setting_update: '⚙️', warn: '⚠️', ban: '🚫', mute: '🔇' };
  return items.map(item => `
    <div class="audit-item">
      <div class="audit-icon">${icons[item.action] || '•'}</div>
      <div class="audit-content">
        <div class="audit-action">${escHtml(item.action)}</div>
        <div class="audit-details">${escHtml(item.details || '-')} ${item.ip ? `· ${escHtml(item.ip)}` : ''}</div>
      </div>
      <div class="audit-time">${fmtDate(item.created_at)}</div>
    </div>
  `).join('');
}

// ===== Queue =====
async function loadQueue() {
  const el = document.getElementById('page-queue');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Очередь задач</h1>
        <p class="page-subtitle">Управление задачами обработки контента</p>
      </div>
      <button class="btn btn-primary" onclick="openFetchModal()">➕ Добавить задачу</button>
    </div>
    <div id="queue-content"><div class="loading"><div class="spinner"></div><br>Загрузка...</div></div>

    <div id="fetch-modal" style="display:none">
      <div class="modal-overlay" onclick="closeFetchModal(event)">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3 class="modal-title">🔍 Поиск видео</h3>
            <button class="modal-close" onclick="closeFetchModal()">×</button>
          </div>
          <div class="form-group">
            <label class="form-label">Поисковый запрос</label>
            <input id="fetch-query" class="form-control" placeholder="Minecraft, GoldMine, ..." />
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeFetchModal()">Отмена</button>
            <button class="btn btn-primary" onclick="submitFetch()">🔍 Найти и добавить</button>
          </div>
        </div>
      </div>
    </div>
  `;
  await refreshQueue();
}

async function refreshQueue() {
  try {
    const tasks = await API.get('/api/queue');
    renderQueueTable(tasks);
  } catch (err) {
    document.getElementById('queue-content').innerHTML = `<p class="text-danger">Ошибка: ${escHtml(err.message)}</p>`;
  }
}

function renderQueueTable(tasks) {
  const el = document.getElementById('queue-content');
  if (!tasks.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📭</div><p class="empty-state-text">Очередь пуста</p></div>`;
    return;
  }

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Задачи (${tasks.length})</span>
        <button class="btn btn-secondary btn-sm" onclick="refreshQueue()">🔄</button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Тип</th>
              <th>Статус</th>
              <th>Прогресс</th>
              <th>Данные</th>
              <th>Создано</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.map(t => `
              <tr>
                <td class="td-mono">${escHtml(t.id.slice(0, 8))}</td>
                <td>${escHtml(t.type)}</td>
                <td>${statusBadge(t.status)}</td>
                <td>
                  <div class="progress" style="min-width:80px">
                    <div class="progress-bar ${t.status === 'posted' ? 'success' : t.status === 'failed' ? '' : 'info'}"
                         style="width:${t.progress || 0}%"></div>
                  </div>
                  <span class="td-muted">${t.progress || 0}%</span>
                </td>
                <td class="td-muted" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                  ${escHtml(t.payload?.title || t.payload?.query || JSON.stringify(t.payload).slice(0, 60))}
                </td>
                <td class="td-muted">${fmtDate(t.createdAt)}</td>
                <td>
                  ${!['posted', 'failed', 'cancelled'].includes(t.status) ? `
                  <button class="btn btn-danger btn-sm" onclick="cancelTask('${escHtml(t.id)}')">✕ Отмена</button>` : ''}
                  ${t.error ? `<span class="text-danger" title="${escHtml(t.error)}" style="cursor:help">⚠</span>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openFetchModal() {
  document.getElementById('fetch-modal').style.display = 'block';
}

function closeFetchModal(e) {
  if (!e || e.target.classList.contains('modal-overlay') || !e.target.classList.contains('modal-overlay') === false || true) {
    document.getElementById('fetch-modal').style.display = 'none';
  }
}

async function submitFetch() {
  const query = document.getElementById('fetch-query').value.trim();
  try {
    const result = await API.post('/api/queue/fetch', { query });
    showToast(`Задача создана: ${result.video?.title || result.task?.id}`, 'success');
    closeFetchModal();
    await refreshQueue();
  } catch (err) {
    showToast('Ошибка: ' + err.message, 'error');
  }
}

async function cancelTask(id) {
  if (!confirmDialog(`Отменить задачу ${id.slice(0, 8)}?`)) return;
  try {
    await API.delete(`/api/queue/${id}`);
    showToast('Задача отменена', 'success');
    await refreshQueue();
  } catch (err) {
    showToast('Ошибка: ' + err.message, 'error');
  }
}

// ===== Schedule =====
async function loadSchedule() {
  const el = document.getElementById('page-schedule');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Расписание публикаций</h1>
        <p class="page-subtitle">Запланированные видео для публикации</p>
      </div>
    </div>
    <div id="schedule-content"><div class="loading"><div class="spinner"></div><br>Загрузка...</div></div>
  `;
  await refreshSchedule();
}

async function refreshSchedule() {
  try {
    const videos = await API.get('/api/schedule');
    renderScheduleTable(videos);
  } catch (err) {
    document.getElementById('schedule-content').innerHTML = `<p class="text-danger">Ошибка: ${escHtml(err.message)}</p>`;
  }
}

function renderScheduleTable(videos) {
  const el = document.getElementById('schedule-content');
  if (!videos.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📅</div><p class="empty-state-text">Нет запланированных публикаций</p></div>`;
    return;
  }

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Запланировано (${videos.length})</span>
        <button class="btn btn-secondary btn-sm" onclick="refreshSchedule()">🔄</button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Название</th>
              <th>YouTube ID</th>
              <th>Запланировано на</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            ${videos.map(v => `
              <tr>
                <td class="td-mono">${v.id}</td>
                <td>${escHtml(v.title || '-')}</td>
                <td class="td-mono">
                  <a href="https://youtube.com/watch?v=${escHtml(v.youtubeId)}" target="_blank">${escHtml(v.youtubeId)}</a>
                </td>
                <td>${fmtDate(v.scheduledAt)}</td>
                <td>${statusBadge(v.status)}</td>
                <td>
                  <button class="btn btn-danger btn-sm" onclick="cancelSchedule(${v.id})">✕ Отмена</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function cancelSchedule(id) {
  if (!confirmDialog(`Отменить запланированную публикацию #${id}?`)) return;
  try {
    await API.delete(`/api/schedule/${id}`);
    showToast('Публикация отменена', 'success');
    await refreshSchedule();
  } catch (err) {
    showToast('Ошибка: ' + err.message, 'error');
  }
}

// ===== Moderation =====
async function loadModeration() {
  const el = document.getElementById('page-moderation');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Модерация</h1>
        <p class="page-subtitle">Управление пользователями и события модерации</p>
      </div>
    </div>

    <div class="card mb-16">
      <div class="card-header"><span class="card-title">🔎 Поиск пользователя</span></div>
      <div class="card-body">
        <div class="form-inline">
          <div class="form-group">
            <label class="form-label">VK User ID</label>
            <input id="mod-user-id" class="form-control" placeholder="123456789" type="number" />
          </div>
          <button class="btn btn-primary" onclick="lookupUser()">Найти</button>
        </div>
        <div id="user-info" class="mt-16"></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">📋 События модерации</span>
        <button class="btn btn-secondary btn-sm" onclick="loadModerationEvents()">🔄</button>
      </div>
      <div id="mod-events-content">
        <div class="loading"><div class="spinner"></div><br>Загрузка...</div>
      </div>
    </div>
  `;
  await loadModerationEvents();
}

async function loadModerationEvents() {
  try {
    const events = await API.get('/api/moderation/events?limit=50');
    renderModerationEvents(events);
  } catch (err) {
    document.getElementById('mod-events-content').innerHTML = `<p class="text-danger" style="padding:16px">Ошибка: ${escHtml(err.message)}</p>`;
  }
}

function renderModerationEvents(events) {
  const el = document.getElementById('mod-events-content');
  if (!events.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✅</div><p class="empty-state-text">Нет событий модерации</p></div>`;
    return;
  }

  const actionColors = { warn: 'warning', mute: 'info', kick: 'warning', ban: 'danger', unban: 'success', unmute: 'success' };

  el.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>User ID</th>
            <th>Действие</th>
            <th>Причина</th>
            <th>Длительность</th>
            <th>Модератор</th>
            <th>Время</th>
          </tr>
        </thead>
        <tbody>
          ${events.map(e => `
            <tr>
              <td class="td-mono">${e.id}</td>
              <td>
                <a href="#" onclick="document.getElementById('mod-user-id').value=${e.user_id};lookupUser();return false">${e.user_id}</a>
              </td>
              <td><span class="badge badge-${actionColors[e.action] || 'pending'}">${escHtml(e.action)}</span></td>
              <td class="td-muted">${escHtml(e.reason || '-')}</td>
              <td class="td-muted">${e.duration ? `${e.duration} мин` : '-'}</td>
              <td class="td-muted">${e.moderator_id || 'auto'}</td>
              <td class="td-muted">${fmtDate(e.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function lookupUser() {
  const userId = document.getElementById('mod-user-id').value;
  if (!userId) return;

  const el = document.getElementById('user-info');
  el.innerHTML = '<div class="loading" style="padding:16px 0"><div class="spinner"></div></div>';

  try {
    const data = await API.get(`/api/moderation/users/${userId}/stats`);
    renderUserInfo(userId, data);
  } catch (err) {
    el.innerHTML = `<p class="text-danger">Ошибка: ${escHtml(err.message)}</p>`;
  }
}

function renderUserInfo(userId, data) {
  const el = document.getElementById('user-info');
  const roles = ['Banned', 'User', 'Trusted', 'Moderator', 'Admin', 'Owner'];
  const roleName = roles[data.role] || 'Unknown';
  const stats = data.stats || {};

  el.innerHTML = `
    <div style="background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-lg);padding:20px">
      <div class="flex justify-between items-center mb-16">
        <div>
          <h3 style="font-size:16px">Пользователь ID: ${escHtml(userId)}</h3>
          <p class="text-muted">Роль: <strong>${escHtml(roleName)}</strong></p>
        </div>
        <div class="flex gap-8">
          <button class="btn btn-secondary btn-sm" onclick="warnUser(${userId})">⚠️ Warn</button>
          <button class="btn btn-secondary btn-sm" onclick="muteUser(${userId})">🔇 Mute</button>
          <button class="btn btn-secondary btn-sm" onclick="banUser(${userId})">🚫 Ban</button>
          <button class="btn btn-success btn-sm" onclick="unbanUser(${userId})">✅ Unban</button>
        </div>
      </div>
      <div class="stats-grid" style="margin-bottom:0">
        <div class="stat-card">
          <div class="stat-value">${stats.message_count || 0}</div>
          <div class="stat-label">Сообщений</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.warns?.length || 0}</div>
          <div class="stat-label">Предупреждений</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${Math.round(stats.risk_score || 0)}</div>
          <div class="stat-label">Risk Score</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${fmtDate(stats.last_message_at)}</div>
          <div class="stat-label">Последнее сообщение</div>
        </div>
      </div>
    </div>
  `;
}

async function warnUser(userId) {
  const reason = window.prompt('Причина предупреждения:');
  if (reason === null) return;
  try {
    await API.post(`/api/moderation/users/${userId}/warn`, { reason });
    showToast('Предупреждение выдано', 'success');
    await lookupUser();
  } catch (err) {
    showToast('Ошибка: ' + err.message, 'error');
  }
}

async function muteUser(userId) {
  const duration = parseInt(window.prompt('Длительность мута (в минутах):', '10') || '0');
  if (!duration) return;
  const reason = window.prompt('Причина:') || 'Admin action';
  try {
    await API.post(`/api/moderation/users/${userId}/mute`, { duration, reason });
    showToast('Мут выдан', 'success');
    loadModerationEvents();
  } catch (err) {
    showToast('Ошибка: ' + err.message, 'error');
  }
}

async function banUser(userId) {
  const reason = window.prompt('Причина бана:');
  if (reason === null) return;
  if (!confirmDialog(`Забанить пользователя ${userId}?`)) return;
  try {
    await API.post(`/api/moderation/users/${userId}/ban`, { reason });
    showToast('Пользователь забанен', 'success');
    await lookupUser();
    loadModerationEvents();
  } catch (err) {
    showToast('Ошибка: ' + err.message, 'error');
  }
}

async function unbanUser(userId) {
  if (!confirmDialog(`Разбанить пользователя ${userId}?`)) return;
  try {
    await API.delete(`/api/moderation/users/${userId}/ban`);
    showToast('Пользователь разбанен', 'success');
    await lookupUser();
    loadModerationEvents();
  } catch (err) {
    showToast('Ошибка: ' + err.message, 'error');
  }
}

// ===== Minecraft =====
async function loadMinecraft() {
  const el = document.getElementById('page-minecraft');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Minecraft Сервер</h1>
        <p class="page-subtitle">Статус и статистика сервера GoldMine</p>
      </div>
      <button class="btn btn-secondary" onclick="loadMinecraft()">🔄 Обновить</button>
    </div>
    <div id="mc-content"><div class="loading"><div class="spinner"></div><br>Загрузка...</div></div>
  `;

  try {
    const status = await API.get('/api/minecraft/status');
    renderMinecraftStatus(status);
  } catch (err) {
    document.getElementById('mc-content').innerHTML = `<p class="text-danger">Ошибка: ${escHtml(err.message)}</p>`;
  }
}

function renderMinecraftStatus(s) {
  const el = document.getElementById('mc-content');
  const online = s.online;

  el.innerHTML = `
    <div class="card">
      <div class="card-body">
        <div class="mc-status-card" style="padding:32px">
          <div class="mc-icon" style="font-size:64px">⛏️</div>
          <div class="mc-info">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
              <h2 style="font-size:24px">GoldMine Server</h2>
              ${online
                ? '<span class="badge badge-online" style="font-size:13px">● Online</span>'
                : '<span class="badge badge-offline" style="font-size:13px">● Offline</span>'}
            </div>
            ${online ? `
            <p style="font-size:16px;color:var(--text-muted)">${escHtml(s.motd || '')}</p>
            <p class="text-muted mt-8">Версия: <strong>${escHtml(s.version || '')}</strong></p>
            <p class="text-muted">Пинг: <strong>${s.latency}ms</strong></p>
            ` : '<p style="font-size:16px;color:var(--danger)">Сервер недоступен</p>'}
          </div>
          ${online ? `
          <div class="mc-players" style="text-align:center;min-width:120px">
            <div class="mc-players-count" style="font-size:48px">${s.players?.online ?? 0}</div>
            <div class="mc-players-label" style="font-size:16px">/ ${s.players?.max ?? 0} игроков</div>
            <div class="mt-16">
              <div class="progress" style="height:8px">
                <div class="progress-bar success" style="width:${s.players?.max > 0 ? Math.round((s.players.online / s.players.max) * 100) : 0}%"></div>
              </div>
            </div>
          </div>` : ''}
        </div>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card ${online ? 'success' : 'danger'}">
        <div class="stat-icon">${online ? '🟢' : '🔴'}</div>
        <div class="stat-value">${online ? 'Online' : 'Offline'}</div>
        <div class="stat-label">Статус</div>
      </div>
      <div class="stat-card info">
        <div class="stat-icon">👥</div>
        <div class="stat-value">${s.players?.online ?? 0}</div>
        <div class="stat-label">Игроков онлайн</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📶</div>
        <div class="stat-value">${online ? s.latency + 'ms' : '-'}</div>
        <div class="stat-label">Пинг</div>
      </div>
    </div>
  `;
}

// ===== Settings =====
async function loadSettings() {
  const el = document.getElementById('page-settings');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Настройки</h1>
        <p class="page-subtitle">Конфигурация бота</p>
      </div>
    </div>
    <div id="settings-content"><div class="loading"><div class="spinner"></div><br>Загрузка...</div></div>
  `;

  try {
    const settings = await API.get('/api/settings');
    renderSettings(settings);
  } catch (err) {
    document.getElementById('settings-content').innerHTML = `<p class="text-danger">Ошибка: ${escHtml(err.message)}</p>`;
  }
}

function renderSettings(settings) {
  const el = document.getElementById('settings-content');
  const entries = Object.entries(settings);

  if (!entries.length) {
    el.innerHTML = `
      <div class="card">
        <div class="card-body">
          <p class="text-muted">Нет сохранённых настроек. Добавьте первую:</p>
          ${renderAddSettingForm()}
        </div>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="card mb-16">
      <div class="card-header"><span class="card-title">➕ Добавить/изменить настройку</span></div>
      <div class="card-body">
        ${renderAddSettingForm()}
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Текущие настройки (${entries.length})</span>
        <button class="btn btn-secondary btn-sm" onclick="loadSettings()">🔄</button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead><tr><th>Ключ</th><th>Значение</th><th>Действия</th></tr></thead>
          <tbody>
            ${entries.map(([k, v]) => `
              <tr>
                <td class="td-mono">${escHtml(k)}</td>
                <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(v)}</td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="editSetting('${escHtml(k)}','${escHtml(v)}')">✏️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderAddSettingForm() {
  return `
    <div class="form-inline">
      <div class="form-group">
        <label class="form-label">Ключ</label>
        <input id="setting-key" class="form-control" placeholder="my_setting" />
      </div>
      <div class="form-group">
        <label class="form-label">Значение</label>
        <input id="setting-value" class="form-control" placeholder="значение" />
      </div>
      <button class="btn btn-primary" onclick="saveSetting()">💾 Сохранить</button>
    </div>
  `;
}

function editSetting(key, value) {
  const keyEl = document.getElementById('setting-key');
  const valEl = document.getElementById('setting-value');
  if (keyEl) keyEl.value = key;
  if (valEl) valEl.value = value;
  keyEl?.scrollIntoView({ behavior: 'smooth' });
}

async function saveSetting() {
  const key = document.getElementById('setting-key')?.value?.trim();
  const value = document.getElementById('setting-value')?.value?.trim();
  if (!key) { showToast('Введите ключ', 'warning'); return; }
  try {
    await API.put(`/api/settings/${encodeURIComponent(key)}`, { value });
    showToast(`Настройка "${key}" сохранена`, 'success');
    await loadSettings();
  } catch (err) {
    showToast('Ошибка: ' + err.message, 'error');
  }
}

// ===== Logs =====
async function loadLogs() {
  const el = document.getElementById('page-logs');
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Логи</h1>
        <p class="page-subtitle">Просмотр системных логов</p>
      </div>
    </div>

    <div class="card mb-16">
      <div class="card-body">
        <div class="form-inline">
          <div class="form-group">
            <label class="form-label">Тип лога</label>
            <select id="log-type" class="form-control" onchange="fetchLogs()">
              <option value="app">App</option>
              <option value="error">Error</option>
              <option value="audit">Audit</option>
              <option value="moderation">Moderation</option>
              <option value="content">Content</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Количество строк</label>
            <select id="log-lines" class="form-control" onchange="fetchLogs()">
              <option value="50">50</option>
              <option value="100" selected>100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
          </div>
          <button class="btn btn-primary" onclick="fetchLogs()">🔄 Обновить</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title" id="log-title">Лог</span>
        <button class="btn btn-secondary btn-sm" onclick="scrollLogsToBottom()">⬇ К концу</button>
      </div>
      <div class="card-body" style="padding:0">
        <div id="log-viewer" class="log-viewer"></div>
      </div>
    </div>
  `;
  await fetchLogs();
}

async function fetchLogs() {
  const type = document.getElementById('log-type')?.value || 'app';
  const lines = document.getElementById('log-lines')?.value || '100';

  try {
    const data = await API.get(`/api/logs?type=${type}&lines=${lines}`);
    renderLogs(data, type);
  } catch (err) {
    document.getElementById('log-viewer').innerHTML = `<span class="text-danger">Ошибка: ${escHtml(err.message)}</span>`;
  }
}

function renderLogs(data, type) {
  const el = document.getElementById('log-viewer');
  const title = document.getElementById('log-title');
  if (title) title.textContent = `${type}.log (${data.total || data.lines?.length || 0} строк)`;

  if (!data.lines?.length) {
    el.innerHTML = '<span class="text-muted">Лог пуст</span>';
    return;
  }

  el.innerHTML = data.lines.map(line => {
    let cls = '';
    const upper = line.toUpperCase();
    if (upper.includes('"level":"error"') || upper.includes(' ERROR ')) cls = 'error';
    else if (upper.includes('"level":"warn"') || upper.includes(' WARN ')) cls = 'warn';
    else if (upper.includes('"level":"info"') || upper.includes(' INFO ')) cls = 'info';
    else if (upper.includes('"level":"debug"') || upper.includes(' DEBUG ')) cls = 'debug';
    return `<div class="log-line ${cls}">${escHtml(line)}</div>`;
  }).join('');

  scrollLogsToBottom();
}

function scrollLogsToBottom() {
  const el = document.getElementById('log-viewer');
  if (el) el.scrollTop = el.scrollHeight;
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  // Login form
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);

  // Nav items
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.page));
  });

  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', handleLogout);

  // Hash change
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash && state.authenticated) navigate(hash);
  });

  // Initial auth check
  checkAuth();
});

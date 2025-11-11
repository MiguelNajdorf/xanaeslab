import { currentUser, logout } from '../apiClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  const info = document.getElementById('admin-info');
  const logoutBtn = document.getElementById('logout');
  const logoutStatus = document.getElementById('logout-status');

  try {
    const user = await currentUser();
    if (user?.role !== 'admin') {
      info.textContent = 'No autorizado. Iniciá sesión nuevamente.';
      info.classList.add('error');
      logoutBtn.disabled = true;
      return;
    }
    info.textContent = `Sesión activa como ${user.email}`;
    info.classList.add('success');
  } catch (error) {
    info.textContent = 'Sesión expirada o inválida. Iniciá sesión.';
    info.classList.add('error');
    logoutBtn.disabled = true;
  }

  logoutBtn?.addEventListener('click', async () => {
    logoutStatus.textContent = 'Cerrando sesión…';
    logoutStatus.className = 'status';
    try {
      await logout();
      logoutStatus.textContent = 'Sesión cerrada. Volvé al login.';
      logoutStatus.classList.add('success');
      setTimeout(() => {
        window.location.href = './admin-login.html';
      }, 700);
    } catch (error) {
      logoutStatus.textContent = error.message || 'No se pudo cerrar la sesión';
      logoutStatus.classList.add('error');
    }
  });
});

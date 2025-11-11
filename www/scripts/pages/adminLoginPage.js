import { login, currentUser } from '../apiClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('login-form');
  const status = document.getElementById('login-status');

  try {
    const me = await currentUser();
    if (me?.email) {
      status.textContent = `Ya iniciastes sesión como ${me.email}.`;
      status.classList.add('success');
    }
  } catch (error) {
    // usuario no autenticado, ignorar
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.textContent = 'Verificando credenciales…';
    status.className = 'status';
    const formData = new FormData(form);
    const email = formData.get('email');
    const password = formData.get('password');
    try {
      await login(email, password);
      status.textContent = 'Inicio de sesión correcto. Redirigiendo al panel…';
      status.classList.add('success');
      setTimeout(() => {
        window.location.href = './admin-dashboard.html';
      }, 600);
    } catch (error) {
      status.textContent = error.message || 'No se pudo iniciar sesión';
      status.classList.add('error');
    }
  });
});

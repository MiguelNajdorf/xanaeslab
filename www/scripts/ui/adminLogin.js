import { setPreference } from '../store.js';

const OTP_KEY = 'xanaeslab:admin:otp';

export function createAdminLogin({ onSuccess }) {
  const container = document.createElement('section');
  container.className = 'section-card admin-login';
  const title = document.createElement('h2');
  title.textContent = 'Acceso administrador';
  container.appendChild(title);

  const form = document.createElement('form');
  form.className = 'admin-login-form';
  const emailField = document.createElement('input');
  emailField.type = 'email';
  emailField.required = true;
  emailField.placeholder = 'tu@email.com';
  const otpField = document.createElement('input');
  otpField.type = 'text';
  otpField.placeholder = 'Código de 6 dígitos';
  otpField.pattern = '\\d{6}';
  otpField.required = true;
  const submit = document.createElement('button');
  submit.className = 'button';
  submit.type = 'submit';
  submit.textContent = 'Ingresar';
  const status = document.createElement('p');
  status.role = 'status';

  form.append(emailField, otpField, submit);
  container.append(form, status);

  let intentos = 0;
  let otp = generarOTP();

  console.info('OTP temporal para admin:', otp);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = emailField.value.trim();
    const codigo = otpField.value.trim();
    if (!email || !codigo) return;
    if (intentos >= 3) {
      status.textContent = 'Demasiados intentos. Solicitá un nuevo OTP.';
      return;
    }
    if (codigo === otp) {
      setPreference(OTP_KEY, { email, validUntil: Date.now() + 10 * 60 * 1000 });
      status.textContent = 'Acceso permitido.';
      onSuccess?.({ email });
      form.reset();
      otp = generarOTP();
      console.info('OTP temporal para admin:', otp);
    } else {
      intentos += 1;
      status.textContent = `Código incorrecto. Intentos restantes: ${3 - intentos}`;
    }
  });

  return container;
}

function generarOTP() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

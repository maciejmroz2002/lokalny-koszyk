const form = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const errorDiv = document.getElementById('errorMessage');
const loading = document.getElementById('loading');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  errorDiv.textContent = '';
  loginBtn.disabled = true;
  if (loading) loading.style.display = 'block';

  try {
    const response = await fetch('http://localhost:8080/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: username,
        password: password
      })
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('token', data.token);
      window.location.href = 'dashboard.html';
    } else {
      errorDiv.textContent = 'Błędna nazwa użytkownika lub hasło';
      loginBtn.disabled = false;
      if (loading) loading.style.display = 'none';
    }
  } catch (error) {
    errorDiv.textContent = 'Błąd połączenia z serwerem';
    loginBtn.disabled = false;
    if (loading) loading.style.display = 'none';
  }
});


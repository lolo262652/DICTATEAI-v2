export function showMessage(id: string, message: string, type: 'success' | 'error') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.className = `message-area ${type}`;
  el.style.display = 'block';

  setTimeout(() => {
    el.style.display = 'none';
  }, 5000);
}

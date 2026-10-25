import { getState } from '../lib/store.js';

const { focus } = await getState(['focus']);
const el = document.getElementById('left');

function update() {
  if (!focus) return (el.textContent = '');
  const left = Math.max(0, focus.endsAt - Date.now());
  el.textContent = `${Math.ceil(left / 60_000)} min left in your focus session`;
}
update();
setInterval(update, 15_000);

const toggleButton = document.getElementById('toggleButton');
const countdownEl = document.getElementById('countdown');
const clearButton = document.getElementById('clearButton');

const telegramToken = document.getElementById('telegramToken');
const telegramChatId = document.getElementById('telegramChatId');
const telegramNotificationsCB = document.getElementById('telegramNotifications');
const telegramFields = document.getElementById('telegramFields');

const inputIds = ['fixedTime', 'minTime', 'maxTime', 'watchText'];
const inputs = Object.fromEntries(inputIds.map(id => [id, document.getElementById(id)]));
const radioInputs = document.getElementsByName('watchMode');

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get([
    'fixedTimeVal', 'minTimeVal', 'maxTimeVal',
    'watchTextVal', 'watchModeVal',
    'telegramTokenVal', 'telegramChatIdVal',
    'shouldRun'
  ], data => {
    inputs.fixedTime.value = data.fixedTimeVal || '';
    inputs.minTime.value = data.minTimeVal || '';
    inputs.maxTime.value = data.maxTimeVal || '';
    inputs.watchText.value = data.watchTextVal || '';
    telegramToken.value = data.telegramTokenVal || '';
    telegramChatId.value = data.telegramChatIdVal || '';

    telegramNotificationsCB.checked = !!data.telegramTokenVal;
    telegramFields.style.display = telegramNotificationsCB.checked ? 'block' : 'none';

    if (data.watchModeVal) {
      const radioToCheck = [...radioInputs].find(r => r.value === data.watchModeVal);
      if (radioToCheck) radioToCheck.checked = true;
    }

    setToggleButtonState(data.shouldRun);
  });
});

toggleButton.addEventListener('click', () => {
  const fixedTime = parseInt(inputs.fixedTime.value);
  const minTime = parseInt(inputs.minTime.value);
  const maxTime = parseInt(inputs.maxTime.value);
  const watchText = inputs.watchText.value.trim();
  const watchMode = [...radioInputs].find(r => r.checked)?.value;
  const shouldRun = toggleButton.dataset.running !== 'true';

  chrome.storage.local.set({
    fixedTimeVal: fixedTime,
    minTimeVal: minTime,
    maxTimeVal: maxTime,
    watchTextVal: watchText,
    watchModeVal: watchMode,
    telegramTokenVal: telegramToken.value,
    telegramChatIdVal: telegramChatId.value,
    shouldRun
  });

  chrome.runtime.sendMessage({ action: shouldRun ? 'start' : 'stop' });
  setToggleButtonState(shouldRun);
});

clearButton.addEventListener('click', () => {
  Object.values(inputs).forEach(input => input.value = '');
  [...radioInputs].forEach(r => r.checked = false);
  telegramToken.value = '';
  telegramChatId.value = '';
  telegramNotificationsCB.checked = false;
  telegramFields.style.display = 'none';
  countdownEl.textContent = '';

  chrome.runtime.sendMessage({ action: 'stop' });
  chrome.storage.local.clear();
  setToggleButtonState(false);
});

telegramNotificationsCB.addEventListener('change', (e) => {
  telegramFields.style.display = e.target.checked ? 'block' : 'none';
});

function setToggleButtonState(isRunning) {
  toggleButton.dataset.running = isRunning;
  toggleButton.innerHTML = isRunning ? '<i class="fas fa-stop"></i> Stop' : '<i class="fas fa-play"></i> Start';
  toggleButton.style.backgroundColor = isRunning ? '#e74c3c' : '#2ecc71';
}

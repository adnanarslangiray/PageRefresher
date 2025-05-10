let shouldRun = false;
const toggleButton = document.getElementById('toggleButton');
const clearButton = document.getElementById('clearButton');
const countdownEl = document.getElementById('countdown');

const inputIds = ['fixedTime', 'minTime', 'maxTime', 'watchText'];
const inputs = Object.fromEntries(inputIds.map(id => [id, document.getElementById(id)]));
const radioInputs = document.getElementsByName('watchMode');

toggleButton.addEventListener('click', async () => {
  if (shouldRun) {
    stopRefreshing();
    return;
  }

  shouldRun = true;
  setToggleButtonState(true);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.update(tab.id, { active: true });

  const fixedTime = parseInt(inputs.fixedTime.value);
  const minTime = parseInt(inputs.minTime.value);
  const maxTime = parseInt(inputs.maxTime.value);
  const watchText = inputs.watchText.value.trim();
  const watchMode = [...radioInputs].find(r => r.checked)?.value;

  // Kaydet
  chrome.storage.local.set({
    fixedTimeVal: fixedTime,
    minTimeVal: minTime,
    maxTimeVal: maxTime,
    watchTextVal: watchText,
    watchModeVal: watchMode
  }, () => console.log('Değerler kaydedildi'));

  while (shouldRun) {
    const delay = fixedTime || (minTime && maxTime ? getRandomInt(minTime, maxTime) : null);
    if (!delay) {
      alert("Please enter a valid time.");
      stopRefreshing();
      return;
    }

    await countdown(delay);
    if (!shouldRun) break;

    if (watchText && watchMode) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (text, mode) => {
          const found = document.body.innerText.includes(text);
          const shouldNotify = (mode === 'appear' && found) || (mode === 'disappear' && !found);
          if (shouldNotify) {
            chrome.runtime.sendMessage({
              type: 'notify',
              text: `Text "${text}" ${mode === 'appear' ? 'appeared' : 'disappeared'}`
            });
          }
        },
        args: [watchText, watchMode]
      });
    }

    chrome.tabs.reload(tab.id);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
});

function stopRefreshing() {
  shouldRun = false;
  countdownEl.textContent = "Stopped.";
  setToggleButtonState(false);
}

function setToggleButtonState(isRunning) {
  toggleButton.innerHTML = isRunning ? '<i class="fas fa-stop"></i> Stop' : '<i class="fas fa-play"></i> Start';
  toggleButton.style.backgroundColor = isRunning ? '#e74c3c' : '#2ecc71';
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function countdown(seconds) {
  for (let i = seconds; i >= 0 && shouldRun; i--) {
    countdownEl.textContent = `Countdown: ${i}s`;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'play-sound') {
    const audio = new Audio(chrome.runtime.getURL("sounds/notify.mp3"));
    audio.play().catch(err => console.error("Ses çalma hatası:", err));
  }
});

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get([
    'fixedTimeVal', 'minTimeVal', 'maxTimeVal', 'watchTextVal', 'watchModeVal'
  ], data => {
    inputs.fixedTime.value = data.fixedTimeVal || '';
    inputs.minTime.value = data.minTimeVal || '';
    inputs.maxTime.value = data.maxTimeVal || '';
    inputs.watchText.value = data.watchTextVal || '';

    if (data.watchModeVal) {
      const radioToCheck = [...radioInputs].find(r => r.value === data.watchModeVal);
      if (radioToCheck) radioToCheck.checked = true;
    }
  });
});

clearButton.addEventListener('click', async () => {
  Object.values(inputs).forEach(input => input.value = '');
  [...radioInputs].forEach(r => r.checked = false);
  countdownEl.textContent = '';
  await chrome.storage.local.clear();
});

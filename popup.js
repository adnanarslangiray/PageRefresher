
let shouldRun = false;
let telegramToken, chatId;
const toggleButton = document.getElementById('toggleButton');
const clearButton = document.getElementById('clearButton');
const countdownEl = document.getElementById('countdown');
const telegramNotificationsCB = document.getElementById('telegramNotifications');

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
      const [{ result: shouldNotify }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (text, mode) => {
          const found = document.body.innerText.includes(text);
          return (mode === 'appear' && found) || (mode === 'disappear' && !found);
        },
        args: [watchText, watchMode]
      });
    
      if (shouldNotify) {
        const url = tab.url;
        const message = `Text "${watchText}" ${watchMode === 'appear' ? 'appeared' : 'disappeared'} on the page.\nURL: ${url}`;
    
        if (telegramNotificationsCB?.checked) {
          console.log("Sending Telegram notification...");
          await sendTelegramNotification(message);
        }
    
        chrome.runtime.sendMessage({
          type: 'notify',
          text: message
        });
      }
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


  fetch(chrome.runtime.getURL('config.json'))
    .then(response => response.json())
    .then(config => {
      console.log("config dosyasının içeriği"); // config dosyasının içeriği
      console.log(config); // config dosyasının içeriği
      telegramToken = config.telegramToken;
      chatId = config.chatId;
    })
    .catch(error => {
      console.error('Config file could not be loaded:', error);
    });

},() => console.log('Değerler getirildi'));

clearButton.addEventListener('click', async () => {
  Object.values(inputs).forEach(input => input.value = '');
  [...radioInputs].forEach(r => r.checked = false);
  countdownEl.textContent = '';
  await chrome.storage.local.clear();
});

// telegram 

async function sendTelegramNotification(text) {
  const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });

  const result = await response.json();
  if (!result.ok) {
    console.error("Telegram API Hatası:", result);
  } else {
    console.log("Telegram mesajı gönderildi:", result);
  }
}
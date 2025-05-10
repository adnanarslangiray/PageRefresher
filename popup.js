let shouldRun = false;

const startButton = document.getElementById('start');
const stopButton = document.getElementById('stop');
const countdownEl = document.getElementById('countdown');

startButton.addEventListener('click', async () => {
  if (shouldRun) return;

  shouldRun = true;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.update(tab.id, { active: true });

  const fixedTime = parseInt(document.getElementById('fixedTime').value);
  const minTime = parseInt(document.getElementById('minTime').value);
  const maxTime = parseInt(document.getElementById('maxTime').value);
  const watchText = document.getElementById('watchText').value.trim();
  const watchMode = document.querySelector('input[name="watchMode"]:checked')?.value;

  // Verileri sakla
  chrome.storage.local.set({
    fixedTimeVal: fixedTime,
    minTimeVal: minTime,
    maxTimeVal: maxTime,
	watchTextVal : watchText,
	watchModeVal : watchMode
  }, function () {
    console.log('Değerler kaydedildi');
  });

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
    await new Promise(resolve => setTimeout(resolve, 1000)); // reload sonrası kısa bekleme
  }
});

stopButton.addEventListener('click', () => {
  stopRefreshing();
});

function stopRefreshing() {
  shouldRun = false;
  countdownEl.textContent = "Stopped.";
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'play-sound') {
    const audio = new Audio(chrome.runtime.getURL("sounds/notify.mp3"));
    audio.play().catch((err) => console.error("Ses çalma hatası:", err));
  }
});

document.addEventListener('DOMContentLoaded', function () {
  // chrome.storage.local'dan veriyi al
    const singleDelay = document.getElementById('fixedTime');
	  const minDelay = document.getElementById('minTime');
	  const maxDelay = document.getElementById('maxTime');
	  const keyword = document.getElementById('watchText');
	  
	  
    chrome.storage.local.get([
    'fixedTimeVal',
    'minTimeVal',
    'maxTimeVal',
    'watchTextVal',
    'watchModeVal'
	
  ], function (data) {
    if (data.fixedTimeVal) singleDelay.value = data.fixedTimeVal;
    if (data.minTimeVal) minDelay.value = data.minTimeVal;
    if (data.maxTimeVal) maxDelay.value = data.maxTimeVal;
    if (data.watchTextVal) keyword.value = data.watchTextVal;
	
    if (data.watchModeVal) {
      const radioToCheck = document.querySelector(`input[name="watchMode"][value="${data.watchModeVal}"]`);
      if (radioToCheck) radioToCheck.checked = true;
    }
  });
  
});

document.getElementById('clearButton').addEventListener('click', async function () {

  document.getElementById('fixedTime').value = '';
  document.getElementById('minTime').value = '';
  document.getElementById('maxTime').value = '';
  document.getElementById('watchText').value = '';
  
 
  const radios = document.getElementsByName('watchMode');
  radios.forEach(r => r.checked = false);

  
  const countdownDisplay = document.getElementById('countdown');
  if (countdownDisplay) countdownDisplay.textContent = '';

  await chrome.storage.local.clear();

});

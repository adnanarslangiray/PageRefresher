let shouldRun = false;
let countdownInterval;
let currentTabId;
let timeoutId = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'start') {
    shouldRun = true;
    startProcess();
  } else if (message.action === 'stop') {
    shouldRun = false;
    clearInterval(countdownInterval);
    chrome.action.setBadgeText({ text: '' });
  }
});

async function startProcess() {

  stopProcess();

  const {
    fixedTimeVal,
    minTimeVal,
    maxTimeVal,
    watchTextVal,
    watchModeVal,
    telegramTokenVal,
    telegramChatIdVal
  } = await chrome.storage.local.get([
    'fixedTimeVal', 'minTimeVal', 'maxTimeVal',
    'watchTextVal', 'watchModeVal',
    'telegramTokenVal', 'telegramChatIdVal'
  ]);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab.id;

  const delay = fixedTimeVal || (minTimeVal && maxTimeVal ? getRandomInt(minTimeVal, maxTimeVal) : null);
  if (!delay) return;

  countdown(delay); // Geri sayım başlat

  timeoutId  = setTimeout(async () => {
    if (!shouldRun) return;

    chrome.tabs.reload(currentTabId);

    await waitForTabLoad(currentTabId);

    if (watchTextVal && watchModeVal) {
      const [{ result: shouldNotify }] = await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        func: (text, mode) => {
          const found = document.body.innerText.includes(text);
          return (mode === 'appear' && found) || (mode === 'disappear' && !found);
        },
        args: [watchTextVal, watchModeVal]
      });

      if (shouldNotify) {
        const message = `Text "${watchTextVal}" ${watchModeVal === 'appear' ? 'appeared' : 'disappeared'}.\nURL: ${tab.url}`;
        if (telegramTokenVal && telegramChatIdVal) {
          await sendTelegramNotification(telegramTokenVal, telegramChatIdVal, message);
        }

        chrome.runtime.sendMessage({ type: 'notify', text: message });
      }
    }

    if (shouldRun) startProcess(); // tekrar başla
  }, delay * 1000);
}

function countdown(seconds) {
  clearInterval(countdownInterval);
  let counter = seconds;
  chrome.action.setBadgeBackgroundColor({ color: '#f00' });

  countdownInterval = setInterval(() => {
    if (!shouldRun || counter < 0) {
      clearInterval(countdownInterval);
      chrome.action.setBadgeText({ text: '' });
      return;
    }
    chrome.action.setBadgeText({ text: counter.toString() });
    counter--;
  }, 1000);
}

function waitForTabLoad(tabId) {
  return new Promise(resolve => {
    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

function stopProcess() {
  clearInterval(countdownInterval);
  clearTimeout(timeoutId);
  chrome.action.setBadgeText({ text: '' });
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function sendTelegramNotification(token, chatId, text) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    const result = await response.json();
    if (!result.ok) console.error("Telegram hatası:", result);
  } catch (err) {
    console.error("Telegram bağlantı hatası:", err);
  }
}


let shouldRun = false;
let countdownInterval;
let currentTabId = null;
let timeoutId = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'start') {
    shouldRun = true;

    // İlk kez başlatıldığında aktif sekmeyi al
    if (!currentTabId) {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        currentTabId = tab.id;
        startProcess();
      });
    } else {
      startProcess();
    }

  } else if (message.action === 'stop') {
    shouldRun = false;
    stopProcess();
    currentTabId = null;
  }
});

async function startProcess() {
  stopProcess(); // önceki işlemi temizle

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

  if (!currentTabId) return;

  // tab bilgilerini güncel al (URL'ye ihtiyacımız olabilir)
  const tab = await chrome.tabs.get(currentTabId);

  // Sistem sekmesi kontrolü
  if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
    console.warn('Sistem sekmesi geçersiz. Yeniden denenecek.');
    await waitForValidTab(currentTabId); // sekme yeniden yüklenene kadar bekle
    if (shouldRun) startProcess();
    return;
  }

  const delay = fixedTimeVal || (minTimeVal && maxTimeVal ? getRandomInt(minTimeVal, maxTimeVal) : null);
  if (!delay) return;

  countdown(delay);

  timeoutId = setTimeout(async () => {
    if (!shouldRun) return;

    chrome.tabs.reload(currentTabId);
    await waitForTabLoad(currentTabId);
    await new Promise(resolve => setTimeout(resolve, 1000));

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

        try {
          showChromeNotification(message);
        } catch (e) {
        }
      }
    }

    if (shouldRun) startProcess(); // döngü
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

function waitForValidTab(tabId) {
  return new Promise(resolve => {
    const check = async () => {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
          resolve();
        } else {
          setTimeout(check, 1000);
        }
      } catch (e) {
        setTimeout(check, 1000);
      }
    };
    check();
  });
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


function showChromeNotification(message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon16.png", // manifest.json'da tanımlı ikon
    title: "Takip Bildirimi",
    message: message
  }, (notificationId) => {
    if (chrome.runtime.lastError) {
      console.warn("Bildirim gösterilemedi:", chrome.runtime.lastError.message);
    }
  });
}



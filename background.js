chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'notify') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Text Watcher',
      message: message.text,
      priority: 2
    });
	
	chrome.runtime.sendMessage({ type: 'play-sound' });
  }
});

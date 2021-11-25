const tabHashes = {};

chrome.action.onClicked.addListener(async () => {
  const curTab = await getCurrentTab();
  const curTabId = curTab.id;

  if (new RegExp('chrome://').test(curTab.url)) return;

  const curWin = await chrome.windows.get(curTab.windowId);

  await chrome.windows.create({
    tabId: curTabId,
    top: curWin.top,
    left: curWin.left,
    height: curWin.height,
    width: curWin.width,
    focused: true,
    type: 'popup',
  });

  tabHashes[curTabId] = {
    windowId: curTab.windowId,
    index: curTab.index,
    width: curWin.width,
    height: curWin.height,
    top: curWin.top,
    left: curWin.left,
  };

  await chrome.scripting.executeScript({
    target: { tabId: curTabId },
    args: [curTabId],
    func: scriptFn,
  });

  chrome.runtime.onMessage.removeListener(handleMessageFromPopup);
  chrome.runtime.onMessage.addListener(handleMessageFromPopup);
});

async function handleMessageFromPopup(_message, sender) {
  const tabId = sender.tab.id;
  const tabHash = tabHashes[tabId];
  let windowId = tabHash?.windowId;

  if (!tabHash) return;

  try {
    windowId =
      tabHash?.windowId && (await chrome.windows.get(tabHash?.windowId)).id;
  } catch (_) {
    windowId = null;
  }

  if (windowId) {
    await chrome.tabs.move(tabId, { windowId, index: tabHash.index });
  } else {
    await chrome.windows.create({
      tabId,
      top: tabHash.top,
      left: tabHash.left,
      height: tabHash.height,
      width: tabHash.width,
      type: 'normal',
      focused: true,
    });
  }

  delete tabHashes[tabId];
  await chrome.tabs.update(tabId, { active: true });
}
async function getCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs[0];
}

async function scriptFn(tabId) {
  const button = document.createElement('button');
  button.classList.add('chrome-extension-close-btn');
  button.style = `
    position: fixed;
    cursor: pointer;
    top: 10px;
    left: 10px;
    border: 0;
    background: #9d0000;
    z-index: 99999999;
    opacity: 0;
    visibility: hidden;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    box-shadow: 0 0 3px 1px #fff !important;`;

  button.addEventListener('click', () => {
    button.remove();
    styleNode.remove();
    chrome.runtime.sendMessage({ tabId });
  });

  document.body.append(button);

  const styleNode = document.createElement('style');
  styleNode.innerHTML = `body:hover .chrome-extension-close-btn {
    opacity: 1 !important;
    visibility: visible !important;
  }`;
  document.getElementsByTagName('head')[0].appendChild(styleNode);
}

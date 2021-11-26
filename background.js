const tabHashes = {};
const CLOSE_BTN_ID = 'js-chrome-extension-close-btn';
const STYLE_EL_ID = 'js-chrome-extension-style-el';

chrome.action.onClicked.addListener(handleTogglePopup);

chrome.commands.onCommand.addListener(async function (command) {
  if (command === 'togglePopup') await handleTogglePopup();
});

async function handleTogglePopup() {
  const curTab = await getCurrentTab();
  const curTabId = curTab.id;
  const tabHash = tabHashes[curTabId];

  if (new RegExp('chrome://').test(curTab.url)) return;

  if (tabHash) return handleRestorePopup(curTabId);

  await handleOpenInPopup(curTabId, curTab.index, curTab.windowId);
}

async function handleRestorePopup(tabId) {
  const tabHash = tabHashes[tabId];
  let windowId = tabHash?.windowId;

  if (!tabHash) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      args: [CLOSE_BTN_ID, STYLE_EL_ID],
      func: (closeBtnId, styleElId) => {
        document.getElementById(closeBtnId)?.remove();
        document.getElementById(styleElId)?.remove();
      },
    });

    const window = await chrome.windows.get(tabHash?.windowId);
    windowId = window.id;
    await chrome.windows.update(windowId, { focused: true });
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

async function handleOpenInPopup(tabId, tabIdx, tabWindowId) {
  const curWin = await chrome.windows.get(tabWindowId);

  await chrome.windows.create({
    tabId,
    top: curWin.top,
    left: curWin.left,
    height: curWin.height,
    width: curWin.width,
    focused: true,
    type: 'popup',
  });

  tabHashes[tabId] = {
    windowId: tabWindowId,
    index: tabIdx,
    width: curWin.width,
    height: curWin.height,
    top: curWin.top,
    left: curWin.left,
  };

  await chrome.scripting.executeScript({
    target: { tabId },
    args: [CLOSE_BTN_ID, STYLE_EL_ID],
    func: scriptFn,
  });

  chrome.runtime.onMessage.removeListener(handleMessageFromPopup);
  chrome.runtime.onMessage.addListener(handleMessageFromPopup);
}

async function handleMessageFromPopup(_message, sender) {
  const tabId = sender.tab.id;
  await handleRestorePopup(tabId);
}

async function getCurrentTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs[0];
}

async function scriptFn(closeBtnId, styleElId) {
  const button = document.createElement('button');
  button.setAttribute('id', closeBtnId);
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
  document.body.append(button);

  const styleNode = document.createElement('style');
  styleNode.setAttribute('id', styleElId);
  styleNode.innerHTML = `body:hover #${closeBtnId} {
    opacity: 1 !important;
    visibility: visible !important;
  }`;
  document.getElementsByTagName('head')[0].appendChild(styleNode);

  button.addEventListener('click', () => chrome.runtime.sendMessage({}));
}

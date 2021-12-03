const checkboxes = Array.from(document.getElementsByTagName('input'));

const jumpWindowsCheckbox = checkboxes.find((el) => el.name === 'jumpWindows');

function updateDisableStatusForCheckboxes() {
  checkboxes.forEach((el) => {
    if (el.name !== 'focusFirstLastTabIfEdgeWindow') {
      el.disabled = false;
      return;
    }

    el.disabled = !jumpWindowsCheckbox.checked;
  });
}

// disable checkboxes at first render
checkboxes.forEach((el) => (el.disabled = true));

// obtain checkboxes values
checkboxes.forEach(async (el) => {
  const name = el.name;
  const res = await chrome.storage.sync.get(name);
  el.checked = res[name];
  updateDisableStatusForCheckboxes();
});

// event delegation for the checkboxes
document.body.addEventListener('change', async (evt) => {
  if (evt.target?.type !== 'checkbox') return;

  const checkbox = evt.target;
  const name = checkbox.name;

  checkbox.disabled = true;
  await chrome.storage.sync.set({ [name]: checkbox.checked });
  updateDisableStatusForCheckboxes();
});

// Contact list rendering, search filtering, and detail opening.

import {
  nameMatchesQuery,
  resolveContactClick,
} from "./logic.js";
import {
  STORAGE_FAIL,
  session,
  contactList,
  contactSearch,
  detailName,
  detailPhone,
  detailRegion,
  detailNote,
  statusNode,
} from "./contacts-state.js";
import { setStatus, showScreen } from "./contacts-screen.js";
import {
  canonicalText,
  currentPayload,
  saveRecord,
  storageFailureStatus,
} from "./contacts-storage.js";

let visibleNames = [];

function renderList() {
  const query = contactSearch.value;
  visibleNames = session.activeNames.filter((name) => nameMatchesQuery(name, query));
  const fragment = document.createDocumentFragment();
  if (visibleNames.length === 0) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = true;
    button.textContent = canonicalText(query) ? "해당하는 이름이 없습니다." : "표시할 이름이 없습니다.";
    item.append(button);
    fragment.append(item);
  } else {
    visibleNames.forEach((name, index) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.index = String(index);
      button.textContent = name;
      item.append(button);
      fragment.append(item);
    });
  }
  contactList.replaceChildren(fragment);
}

function openContact(name) {
  const result = resolveContactClick(session.clickState, {
    selectedName: name,
    settings: session.currentSettings,
    seed: Math.floor(Math.random() * 0xffffffff),
  });
  session.clickState = result.state;
  const opening = result.opening;
  detailName.textContent = opening.name;
  detailPhone.textContent = opening.phone;
  detailRegion.textContent = opening.region;
  detailNote.textContent = opening.note;
  showScreen("detail");
  if (!saveRecord(currentPayload())) {
    storageFailureStatus();
    return;
  }
  if (statusNode.textContent === STORAGE_FAIL) setStatus("");
}

function onListClick(event) {
  const button = event.target instanceof Element ? event.target.closest("button") : null;
  if (!button || !contactList.contains(button) || button.disabled) return;
  const index = Number(button.dataset.index);
  if (!Number.isInteger(index) || index < 0 || index >= visibleNames.length) return;
  openContact(visibleNames[index]);
}

export { renderList, onListClick };

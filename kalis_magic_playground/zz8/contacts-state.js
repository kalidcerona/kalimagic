// DOM references and the shared performance session for the contacts UI.

import {
  LIMITS,
  createClickState,
  normalizePerformanceSettings,
} from "./logic.js";

export const STORAGE_KEY = "asrai.prototype.v2";
export const GUIDE_KEY = "asrai.prototype.settings-guide.v1";
export const CLICK_SUPPRESS_MS = 500;
export const STORAGE_FAIL = "저장하지 못했습니다. 기존 저장 값은 바꾸지 않았고, 이번 변경은 이 화면에만 남습니다.";

export const settingsScreen = document.querySelector("#settings-screen");
export const listScreen = document.querySelector("#contact-list-screen");
export const detailScreen = document.querySelector("#contact-detail-screen");
export const targetInput = document.querySelector("#target-click");
export const phoneInput = document.querySelector("#fixed-phone");
export const regionInput = document.querySelector("#fixed-region");
export const noteInput = document.querySelector("#fixed-note");
export const namesInput = document.querySelector("#contact-names");
export const resetButton = document.querySelector("#reset-clicks");
export const startButton = document.querySelector("#start-performance");
export const statusNode = document.querySelector("#settings-status");
export const contactList = document.querySelector("#contact-list");
export const contactSearch = document.querySelector("#contact-search");
export const detailName = document.querySelector("#detail-name");
export const detailPhone = document.querySelector("#detail-phone");
export const detailRegion = document.querySelector("#detail-region");
export const detailNote = document.querySelector("#detail-note");
export const backButton = document.querySelector("#back-list");

// Assigned from storage, the list, settings, and startup. One object keeps those writes shared.
export const session = {
  clickState: createClickState(),
  activeNames: [],
  currentSettings: normalizePerformanceSettings({ targetClick: LIMITS.defaultTargetClick }),
  storageNote: "",
};

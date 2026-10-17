// js/uiHooks.js
// Import-free registry so gameplay modules can call UI code without importing UI modules
// (which would create dependency cycles). UI modules register their hooks when they load.
export const uiHooks = {};

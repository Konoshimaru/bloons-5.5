// js/engineRef.js
// The GameEngine singleton object lives HERE (empty, no imports); engine.js fills it in.
//
// Why: ~70 modules need `GameEngine`, and engine.js itself imports almost every module, so
// importing it from engine.js created 67 circular dependencies. Importing the (empty) object
// from this import-free file breaks all of them, and it is the SAME object identity, so there is
// no proxy/performance cost. Always import GameEngine from here, never from engine.js
// (only main.js imports engine.js, for its side effect of populating this object).
export const GameEngine = {};

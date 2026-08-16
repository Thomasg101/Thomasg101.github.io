(function () {
  "use strict";

  var storageKey = "tg-mode";
  var root = document.documentElement;
  var validModes = ["auto", "light", "dark"];
  var media = typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

  function readMode() {
    try {
      var saved = window.localStorage.getItem(storageKey);
      return validModes.indexOf(saved) !== -1 ? saved : "auto";
    } catch (error) {
      return "auto";
    }
  }

  function setThemeColor(mode) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) return;
    var dark = mode === "dark" || (mode === "auto" && media && media.matches);
    meta.setAttribute("content", dark ? "#0d0f12" : "#f4f2ed");
  }

  function applyMode(mode, persist) {
    if (validModes.indexOf(mode) === -1) mode = "auto";

    if (mode === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", mode);

    document.querySelectorAll("[data-theme-choice]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-theme-choice") === mode));
    });

    document.querySelectorAll("[data-theme-label]").forEach(function (label) {
      label.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    });

    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      button.setAttribute("title", "Theme: " + mode + ". Click to change.");
    });

    setThemeColor(mode);

    if (persist) {
      try {
        window.localStorage.setItem(storageKey, mode);
      } catch (error) {
        /* file:// previews may deny storage; system theme still works. */
      }
    }
  }

  function start() {
    var mode = readMode();
    applyMode(mode, false);

    document.querySelectorAll("[data-theme-choice]").forEach(function (button) {
      button.addEventListener("click", function () {
        mode = button.getAttribute("data-theme-choice") || "auto";
        applyMode(mode, true);
      });
    });

    document.querySelectorAll("[data-theme-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        var index = validModes.indexOf(mode);
        mode = validModes[(index + 1) % validModes.length];
        applyMode(mode, true);
      });
    });

    if (media) {
      var handleSystemTheme = function () {
        if (mode === "auto") setThemeColor(mode);
      };
      if (typeof media.addEventListener === "function") media.addEventListener("change", handleSystemTheme);
      else if (typeof media.addListener === "function") media.addListener(handleSystemTheme);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}());

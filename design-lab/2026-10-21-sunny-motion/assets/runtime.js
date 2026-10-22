// Generated from src/lib/motion.ts. Run node scripts/build-motion-demo.mjs to refresh.
"use strict";
var SunnyMotion = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var motion_exports = {};
  __export(motion_exports, {
    emphasizeReadingTarget: () => emphasizeReadingTarget,
    mountMotion: () => mountMotion
  });
  function mountMotion(root) {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const active = /* @__PURE__ */ new Map();
    let disposed = false;
    const reduced = () => media.matches || root.dataset.motionReduced === "true";
    const tokens = () => getComputedStyle(root);
    const duration = (name) => {
      const value = Number.parseFloat(tokens().getPropertyValue(`--motion-${name}`));
      return value;
    };
    function cancel(element) {
      active.get(element)?.cancel();
      active.delete(element);
    }
    function animate(element, frames, time, delay = 0) {
      cancel(element);
      if (disposed || reduced() || element.closest("[hidden]") || !element.animate) return;
      const animation = element.animate(frames, {
        duration: time,
        delay,
        easing: tokens().getPropertyValue("--motion-ease").trim(),
        fill: "both"
      });
      active.set(element, animation);
      animation.onfinish = () => {
        if (active.get(element) === animation) cancel(element);
      };
    }
    function replay(element) {
      const kind = element.dataset.motion;
      if (!kind) return;
      const direction = (element.dataset.motionDirection ?? root.dataset.motionDirection) === "back" ? -1 : 1;
      const delay = Math.min(120, Math.max(0, Number(element.dataset.motionDelay) || 0));
      if (kind === "highlight") {
        animate(
          element,
          [
            { opacity: 1, boxShadow: "inset 0 0 0 3px #b4c4a8" },
            { opacity: 1, boxShadow: "inset 0 0 0 0px transparent" }
          ],
          duration("page")
        );
      } else if (kind === "page" || kind === "month" || kind === "reveal") {
        const offset = kind === "reveal" ? "translateY(8px)" : `translateX(${direction * 8}px)`;
        animate(
          element,
          [
            { opacity: 0.4, transform: offset },
            { opacity: 1, transform: "none" }
          ],
          duration(kind === "month" ? "month" : "page"),
          delay
        );
      } else {
        animate(
          element,
          [{ opacity: 0.45 }, { opacity: 1 }],
          duration(kind === "state" ? "release" : "feedback"),
          delay
        );
      }
    }
    function scan(node, pending) {
      if (node instanceof HTMLElement && node.matches("[data-motion]")) pending.add(node);
      node.querySelectorAll("[data-motion]").forEach((element) => pending.add(element));
    }
    const nav = root.querySelector(".app-nav");
    const indicator = nav?.querySelector(".nav-indicator");
    let positioned = false;
    function refreshNavigation() {
      if (!nav || !indicator || disposed) return;
      const selected = nav.querySelector('.nav-item[aria-current="page"]');
      if (!selected) {
        cancel(indicator);
        indicator.style.opacity = "0";
        positioned = false;
        return;
      }
      const previous = indicator.getBoundingClientRect();
      cancel(indicator);
      indicator.style.left = `${selected.offsetLeft}px`;
      indicator.style.width = `${selected.offsetWidth}px`;
      indicator.style.opacity = "1";
      const next = indicator.getBoundingClientRect();
      if (positioned && next.width > 0) {
        animate(
          indicator,
          [
            {
              transform: `translateX(${previous.left - next.left}px) scaleX(${previous.width / next.width})`
            },
            { transform: "none" }
          ],
          duration("page")
        );
      }
      positioned = true;
    }
    const observer = new MutationObserver((records) => {
      const pending = /* @__PURE__ */ new Set();
      let navigationChanged = false;
      for (const record of records) {
        if (record.type === "childList") {
          record.addedNodes.forEach((node) => {
            if (node instanceof Element) scan(node, pending);
          });
        } else if (record.target instanceof HTMLElement) {
          const element = record.target;
          if (record.attributeName === "aria-current" && element.classList.contains("nav-item")) {
            navigationChanged = true;
          } else if (record.attributeName === "data-motion-reduced" || record.attributeName === "data-motion-slow") {
            active.forEach((_animation, target) => cancel(target));
          } else if (record.attributeName === "data-motion" || element.hasAttribute("data-motion")) {
            if (element.hidden || !element.dataset.motion) cancel(element);
            else pending.add(element);
          }
        }
      }
      active.forEach((_animation, element) => {
        if (!root.contains(element) || element.closest("[hidden]")) cancel(element);
      });
      pending.forEach((element) => {
        if (root.contains(element)) replay(element);
      });
      if (navigationChanged) refreshNavigation();
    });
    const initial = /* @__PURE__ */ new Set();
    scan(root, initial);
    initial.forEach(replay);
    refreshNavigation();
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "data-motion",
        "data-motion-key",
        "data-motion-reduced",
        "data-motion-slow",
        "hidden",
        "aria-current"
      ]
    });
    const resize = new ResizeObserver(refreshNavigation);
    if (nav) resize.observe(nav);
    const onPreference = () => {
      active.forEach((_animation, element) => cancel(element));
      refreshNavigation();
    };
    media.addEventListener("change", onPreference);
    return {
      replay,
      refreshNavigation,
      dispose() {
        disposed = true;
        observer.disconnect();
        resize.disconnect();
        media.removeEventListener("change", onPreference);
        active.forEach((_animation, element) => cancel(element));
      }
    };
  }
  function emphasizeReadingTarget(element) {
    if (!element) return;
    element.dataset.motion = "highlight";
    element.dataset.motionKey = String(Number(element.dataset.motionKey || 0) + 1);
  }
  return __toCommonJS(motion_exports);
})();

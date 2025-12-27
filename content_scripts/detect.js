(() => {
  "use strict";

  /* ================== HELPERS ================== */

  function getScriptSrcs() {
    try {
      return Array.from(document.scripts || [])
        .map(s => s.src || "")
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  function getMetaGenerators() {
    try {
      return Array.from(
        document.querySelectorAll('meta[name="generator"]')
      ).map(m => m.content || "");
    } catch {
      return [];
    }
  }

  function hasGlobalVar(name) {
    try {
      return typeof window[name] !== "undefined";
    } catch {
      return false;
    }
  }

  // IMPORTANT: only scan real DOM attributes (to avoid false angular chances)
  function hasDomAttrRegex(reStr) {
    try {
      const re = new RegExp(reStr, "i");
      const elements = document.querySelectorAll("*");

      for (const el of elements) {
        for (const attr of el.getAttributeNames()) {
          if (re.test(attr)) return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /* ================== CORE DETECTION ================== */

  function detectTech(sig, scriptSrcs, metas) {
    let score = 0;
    let matched = false;

    for (const check of sig.checks || []) {
      let hit = false;

      if (check.type === "script_src_regex") {
        const re = new RegExp(check.value, "i");
        hit = scriptSrcs.some(src => re.test(src));
      }

      else if (check.type === "meta_generator") {
        hit = metas.some(m =>
          m.toLowerCase().includes(check.value.toLowerCase())
        );
      }

      else if (check.type === "global_var") {
        hit = hasGlobalVar(check.value);
      }

      else if (check.type === "dom_attr_regex") {
        hit = hasDomAttrRegex(check.value);
      }

      if (hit) {
        matched = true;
        score += check.weight ?? 0.25;
      }
    }

    if (!matched) return null;

    if (score > 1) score = 1;

    return {
      name: sig.name,
      category: sig.category,
      confidence: Math.round(score * 100)
    };
  }

  /* ================== EVENT LISTENER ================== */

  window.addEventListener("SiteTechInspect", event => {
    const signatures = event.detail?.signatures || [];

    const scriptSrcs = getScriptSrcs();
    const metas = getMetaGenerators();

    let results = [];

    for (const sig of signatures) {
      const detected = detectTech(sig, scriptSrcs, metas);
      if (detected) results.push(detected);
    }

    /* ================== FRAMEWORK PRECEDENCE ================== */

    const FRAMEWORK_PRIORITY = ["React", "Angular", "Vue", "Svelte"];

    results.sort((a, b) => {
      const pa = FRAMEWORK_PRIORITY.indexOf(a.name);
      const pb = FRAMEWORK_PRIORITY.indexOf(b.name);
      if (pa === -1 || pb === -1) return 0;
      return pa - pb;
    });

    // Remove Angular if React confidence is higher
    const react = results.find(r => r.name === "React");
    const angular = results.find(r => r.name === "Angular");

    if (react && angular && react.confidence >= angular.confidence) {
      results = results.filter(r => r.name !== "Angular");
    }

    /* ================== DISPATCH RESULT ================== */

    window.dispatchEvent(
      new CustomEvent("SiteTechInspectResult", {
        detail: { results }
      })
    );
  });

})();

(() => {
  /* ------------------ Helpers ------------------ */

  function getScriptSrcs() {
    return Array.from(document.scripts || [])
      .map(s => s.src || "")
      .filter(Boolean);
  }

  function getMetaGenerators() {
    return Array.from(
      document.querySelectorAll('meta[name="generator"]')
    ).map(m => m.content || "");
  }

  function getHTML() {
    return document.documentElement
      ? document.documentElement.outerHTML
      : "";
  }

  function hasGlobalVar(name) {
    try {
      return typeof window[name] !== "undefined";
    } catch {
      return false;
    }
  }

  function hasDomAttrRegex(reStr) {
    try {
      const re = new RegExp(reStr, "i");
      return re.test(getHTML());
    } catch {
      return false;
    }
  }

  /* ------------------ Core Detection ------------------ */

  function detectTechnology(sig, scriptSrcs, metas) {
    let score = 0;
    let matchedChecks = 0;

    for (const check of sig.checks || []) {
      let matched = false;

      if (check.type === "script_src_regex") {
        const re = new RegExp(check.value, "i");
        matched = scriptSrcs.some(src => re.test(src));
      }

      else if (check.type === "meta_generator") {
        matched = metas.some(m =>
          m.toLowerCase().includes(check.value.toLowerCase())
        );
      }

      else if (check.type === "global_var") {
        matched = hasGlobalVar(check.value);
      }

      else if (check.type === "dom_attr_regex") {
        matched = hasDomAttrRegex(check.value);
      }

      if (matched) {
        matchedChecks++;
        score += check.weight || 0.25; // default weight
      }
    }

    if (matchedChecks === 0) return null;

    if (score > 1) score = 1;

    return {
      name: sig.name,
      category: sig.category,
      confidence: Math.round(score * 100)
    };
  }

  /* ------------------ Event Listener ------------------ */

  window.addEventListener("SiteTechInspect", event => {
    const signatures = event.detail?.signatures || [];

    const scriptSrcs = getScriptSrcs();
    const metas = getMetaGenerators();

    const results = [];

    for (const sig of signatures) {
      const detected = detectTechnology(sig, scriptSrcs, metas);
      if (detected) results.push(detected);
    }

    window.dispatchEvent(
      new CustomEvent("SiteTechInspectResult", {
        detail: { results }
      })
    );
  });

})();

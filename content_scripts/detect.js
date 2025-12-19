(function() {
function getScriptSrcs() {
return Array.from(document.scripts || []).map(s => s.src || '').filter(Boolean);
}
function getMetaGenerators() {
return Array.from(document.querySelectorAll('meta[name="generator"]')).map(m => m.content || '');
}
function getHTML() {
return document.documentElement ? document.documentElement.outerHTML : document.body.innerHTML;
}
function hasGlobalVar(name) {
try { return !!(window[name]); } catch(e) { return false; }
}
function hasDomAttrRegex(reStr) {
try {
const re = new RegExp(reStr, 'i');
const html = getHTML();
return re.test(html);
} catch(e) { return false; }
}


// Receive signatures via custom event
window.addEventListener('SiteTechInspect', async (ev) => {
const signatures = ev.detail && ev.detail.signatures ? ev.detail.signatures : [];
const results = [];


const scriptSrcs = getScriptSrcs();
const metas = getMetaGenerators();


for (const sig of signatures) {
let matched = false;
for (const c of sig.checks || []) {
if (c.type === 'script_src_regex') {
const re = new RegExp(c.value, 'i');
if (scriptSrcs.some(s => re.test(s))) matched = true;
} else if (c.type === 'meta_generator') {
if (metas.some(m => m && m.toLowerCase().includes(c.value.toLowerCase()))) matched = true;
} else if (c.type === 'global_var') {
if (hasGlobalVar(c.value)) matched = true;
} else if (c.type === 'dom_attr_regex') {
if (hasDomAttrRegex(c.value)) matched = true;
}
if (matched) break;
}
if (matched) results.push({name: sig.name, category: sig.category});
}


// Dispatch result event
window.dispatchEvent(new CustomEvent('SiteTechInspectResult', {detail: {results}}));
});
})();
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, "../src/pages");

const GRID_RULES = [
  { pattern: /repeat\(12,\s*minmax\(0,\s*1?fr\)\)/, cls: "rg-12" },
  { pattern: /repeat\(4,\s*1fr\)/, cls: "rg-4" },
  { pattern: /repeat\(3,\s*minmax\(0,\s*1?fr\)\)/, cls: "rg-3" },
  { pattern: /repeat\(3,minmax\(0,1fr\)\)/, cls: "rg-3" },
  { pattern: /"1fr 1fr"/, cls: "rg-2" },
  { pattern: /repeat\(2,\s*minmax\(0,\s*1fr\)\)/, cls: "rg-2" },
  { pattern: /"7fr 5fr"/, cls: "rg-split-asymmetric" },
  { pattern: /"350px 1fr"/, cls: "rg-sidebar-main" },
  { pattern: /"300px 1fr"/, cls: "rg-sidebar-main" },
  { pattern: /repeat\(7,\s*minmax\(0,\s*1fr\)\)/, cls: "rg-calendar" },
  { pattern: /repeat\(7,\s*1fr\)/, cls: "rg-calendar" },
  { pattern: /"1fr 220px 220px 1fr"/, cls: "rg-toolbar" },
  { pattern: /"1\.1fr 1\.5fr 1\.4fr"/, cls: "rg-exam-layout" },
  {
    pattern: /repeat\(auto-fit,\s*minmax\((?:280|300|320)px/,
    cls: "rg-autofit",
  },
  { pattern: /repeat\(auto-fill,\s*minmax\(320px/, cls: "rg-autofit" },
  {
    pattern: /repeat\(auto-fit,\s*minmax\(\d+px,\s*1fr\)\)/,
    cls: "rg-autofit-sm",
  },
  { pattern: /"1\.2fr 0\.8fr"/, cls: "rg-split-asymmetric" },
  { pattern: /"1fr 2fr"/, cls: "rg-split-asymmetric" },
  { pattern: /minmax\(0,\s*1\.2fr\)\s*minmax\(0,\s*1fr\)/, cls: "rg-split-asymmetric" },
  { pattern: /"1fr 200px"/, cls: "rg-toolbar" },
  { pattern: /"1fr 180px"/, cls: "rg-toolbar" },
  { pattern: /"1fr 1fr auto"/, cls: "rg-toolbar" },
];

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, files);
    else if (p.endsWith(".jsx")) files.push(p);
  }
  return files;
}

function findMatchingRule(text) {
  for (const rule of GRID_RULES) {
    if (rule.pattern.test(text)) return rule.cls;
  }
  return null;
}

function addClassToStyleBlock(content) {
  const styleRe = /style=\{\{([\s\S]*?)\}\}/g;
  return content.replace(styleRe, (full, inner) => {
    if (!inner.includes("gridTemplateColumns")) return full;
    const cls = findMatchingRule(inner);
    if (!cls) return full;
    if (full.includes(`"${cls}"`)) return full;
    return `className="${cls}" ${full}`;
  });
}

function wrapTables(content) {
  if (!content.includes("<table") || content.includes('className="table-scroll"'))
    return content;
  let c = content.replace(/<table/g, '<div className="table-scroll"><table');
  c = c.replace(/<\/table>/g, "</table></div>");
  return c;
}

function mergeDuplicateClassNames(content) {
  return content.replace(
    /className="([^"]+)"\s+className="([^"]+)"/g,
    (_, a, b) => `className="${a} ${b}"`,
  );
}

function addDashboardShell(content) {
  return content.replace(
    /style=\{\{([\s\S]*?padding:\s*(?:20|24)[\s\S]*?minHeight:[\s\S]*?)\}\}/g,
    (full, inner) => {
      if (!inner.includes("padding:") || full.includes("dashboard-shell"))
        return full;
      if (full.includes('className="dashboard-shell"')) return full;
      return `className="dashboard-shell" ${full}`;
    },
  );
}

const files = walk(srcDir);
let changed = 0;
for (const file of files) {
  const before = readFileSync(file, "utf8");
  let after = addClassToStyleBlock(before);
  after = addDashboardShell(after);
  after = wrapTables(after);
  after = mergeDuplicateClassNames(after);
  if (after !== before) {
    writeFileSync(file, after, "utf8");
    changed++;
    console.log("Updated:", file);
  }
}

console.log(`Done. ${changed} files updated.`);

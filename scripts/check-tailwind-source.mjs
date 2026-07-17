import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SOURCE_DIRS = ["app", "components", "pages", "src"];
const EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mdx", ".css"]);

let found = 0;

function walk(directory) {
  if (!fs.existsSync(directory)) return;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (!EXTENSIONS.has(path.extname(entry.name))) continue;

    const buffer = fs.readFileSync(fullPath);
    const text = buffer.toString("utf8");
    const lines = text.split(/\r?\n/);

    lines.forEach((line, index) => {
      const controls = [...line].filter((character) => {
        const code = character.charCodeAt(0);
        return code === 0x7f || (code < 0x20 && code !== 0x09);
      });

      if (controls.length > 0) {
        found += 1;
        console.error(`Hidden control character: ${path.relative(ROOT, fullPath)}:${index + 1}`);
        console.error(JSON.stringify(line));
      }

      if (
        line.includes("[-webkit-overflow-scrolling:touch]") ||
        line.includes("[-webkit-overflow-scrolling: touch]")
      ) {
        found += 1;
        console.error(`Replace arbitrary scrolling class: ${path.relative(ROOT, fullPath)}:${index + 1}`);
        console.error(line.trim());
      }
    });
  }
}

for (const sourceDir of SOURCE_DIRS) {
  walk(path.join(ROOT, sourceDir));
}

if (found === 0) {
  console.log("No hidden control characters or unsafe scrolling classes were found.");
  process.exit(0);
}

console.error(`\nFound ${found} problem(s). Remove the hidden character or replace the whole affected className line.`);
process.exit(1);

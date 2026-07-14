import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const SKIP_DIRECTORIES = new Set([
  "node_modules",
  ".next",
  ".git",
  ".turbo",
  "dist",
  "build",
  "coverage",
  ".vercel",
  ".tailwind-source-backup",
]);

const TEXT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".mdx",
  ".css",
  ".scss",
  ".sass",
  ".html",
  ".json",
  ".txt",
  ".md",
]);

const BACKUP_ROOT = path.join(ROOT, ".tailwind-source-backup");

let scanned = 0;
let changed = 0;

function makeBackup(filePath, content) {
  const relativePath = path.relative(ROOT, filePath);
  const backupPath = path.join(BACKUP_ROOT, relativePath);

  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, content, "utf8");
}

function cleanContent(content) {
  let updated = content;

  // Remove the DEL character Tailwind displays as \7f.
  updated = updated.replace(/\u007f/g, "");

  // Remove invalid control characters but preserve tabs and line endings.
  updated = updated.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,
    "",
  );

  // Replace arbitrary WebKit scrolling utilities with the safe CSS class.
  updated = updated.replace(
    /\[\s*-webkit-overflow-scrolling\s*:\s*touch\s*\]/g,
    "touch-scroll",
  );

  // Remove malformed arbitrary-property classes such as [-: ].
  updated = updated.replace(/\[\s*-\s*:\s*\]/g, "");
  updated = updated.replace(/\[\s*-\s*:\s+\]/g, "");

  return updated;
}

function scanFile(filePath) {
  scanned += 1;

  let original;

  try {
    original = fs.readFileSync(filePath, "utf8");
  } catch {
    return;
  }

  const updated = cleanContent(original);

  if (updated === original) {
    return;
  }

  makeBackup(filePath, original);
  fs.writeFileSync(filePath, updated, "utf8");
  changed += 1;

  console.log(`Fixed: ${path.relative(ROOT, filePath)}`);
}

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();

    if (TEXT_EXTENSIONS.has(extension)) {
      scanFile(fullPath);
    }
  }
}

walk(ROOT);

console.log("");
console.log(`Scanned files: ${scanned}`);
console.log(`Changed files: ${changed}`);

if (changed > 0) {
  console.log(`Backups: ${path.relative(ROOT, BACKUP_ROOT)}`);
  console.log("Now delete .next and restart the development server.");
} else {
  console.log("No hidden control characters or malformed classes were found.");
}

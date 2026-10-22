const fs = require('fs').promises;
const path = require('path');

function toKebab(name) {
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9\-_.]/g, '')
    .replace(/-+/g, '-')
    .toLowerCase();
}

async function listDirs(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const dirs = [];
  for (const e of entries) {
    if (e.isDirectory()) {
      dirs.push(path.join(dir, e.name));
      const sub = await listDirs(path.join(dir, e.name));
      dirs.push(...sub);
    }
  }
  return dirs;
}

async function readTextFile(file) {
  try { return await fs.readFile(file, 'utf8'); } catch { return null; }
}

async function writeTextFile(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
}

async function main() {
  const root = path.resolve(process.cwd(), 'src');
  const allDirs = await listDirs(root);
  const dirsWithSpaces = allDirs.filter(d => path.basename(d).includes(' '));
  if (dirsWithSpaces.length === 0) {
    console.log('No directories with spaces found under src/');
    return;
  }

  console.log('Found directories with spaces:');
  dirsWithSpaces.forEach(d => console.log(' -', path.relative(process.cwd(), d)));

  const renameMap = [];
  // Compute renames: from absolute oldPath -> absolute newPath
  for (const oldPath of dirsWithSpaces) {
    const dirname = path.basename(oldPath);
    const kebab = toKebab(dirname);
    const newPath = path.join(path.dirname(oldPath), kebab);
    renameMap.push({ oldPath, newPath, dirname, kebab });
  }

  // Sort by path length descending so nested directories are renamed first
  renameMap.sort((a,b) => b.oldPath.length - a.oldPath.length);

  for (const { oldPath, newPath } of renameMap) {
    // If newPath already exists, skip
    try {
      const stat = await fs.stat(newPath).catch(() => null);
      if (stat) {
        console.warn(`Skipping rename since target exists: ${newPath}`);
        continue;
      }
      await fs.rename(oldPath, newPath);
      console.log(`Renamed: ${path.relative(process.cwd(), oldPath)} -> ${path.relative(process.cwd(), newPath)}`);
    } catch (err) {
      console.error('Failed to rename', oldPath, err && err.message);
    }
  }

  // Update references across repo files
  const exts = ['.ts', '.js', '.json', '.md', '.yml', '.yaml', '.hbs'];
  async function walkFiles(dir) {
    const out = [];
    const es = await fs.readdir(dir, { withFileTypes: true });
    for (const e of es) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        out.push(...await walkFiles(full));
      } else if (exts.includes(path.extname(e.name))) {
        out.push(full);
      }
    }
    return out;
  }

  const files = await walkFiles(process.cwd());
  for (const file of files) {
    let text = await readTextFile(file);
    if (text === null) continue;
    let orig = text;
    for (const { oldPath, newPath, dirname, kebab } of renameMap) {
      const oldSegment = dirname;
      const newSegment = kebab;
      // Replace occurrences in paths with spaces inside quotes or raw paths
      // Replace both forward and back slashes
      const escOld = oldSegment.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
      const re = new RegExp(escOld, 'g');
      text = text.replace(re, newSegment);
    }
    if (text !== orig) {
      await writeTextFile(file, text);
      console.log('Updated references in', path.relative(process.cwd(), file));
    }
  }

  console.log('Done. Please run your tests/CI and verify imports.');
}

main().catch(err => { console.error(err); process.exitCode = 2; });

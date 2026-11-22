#!/usr/bin/env node
/**
 * CI gate (#1329): every route on a registered Nest controller must be
 * protected by a guard or explicitly marked public.
 *
 * A route counts as covered when its handler method, or its controller class,
 * carries `@UseGuards(...)` (or a composite decorator that applies UseGuards
 * via applyDecorators) or `@Public()`. Commented-out decorators do not count:
 * the files are parsed with the TypeScript compiler, not matched as text.
 *
 * A controller is "registered" when its class name appears in the
 * `controllers: [...]` array of some `@Module({...})` under src/.
 *
 * Unguarded routes that already existed when this gate was added are listed in
 * scripts/controller-guard-baseline.json. They are reported but do not fail
 * the build; any *new* unguarded route does. When you fix a baselined route,
 * delete its entry (the script prints which entries are stale).
 *
 * Usage:
 *   node scripts/check-controller-guards.js
 *   node scripts/check-controller-guards.js --update-baseline   # rewrite baseline
 *   node scripts/check-controller-guards.js --strict            # stale baseline entries fail too
 */

const fs = require('fs');
const path = require('path');

let ts;
try {
  ts = require('typescript');
} catch {
  console.error('check-controller-guards: the "typescript" package is required (pnpm install).');
  process.exit(2);
}

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const BASELINE_PATH = path.join(__dirname, 'controller-guard-baseline.json');
const HTTP_METHOD_DECORATORS = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete', 'All', 'Options', 'Head', 'Search']);
const ROUTE_GUARD_DECORATORS = new Set(['UseGuards']);
const PUBLIC_DECORATORS = new Set(['Public']);

const args = new Set(process.argv.slice(2));

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.d.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.e2e-spec.ts')
    ) {
      out.push(full);
    }
  }
  return out;
}

function parse(file) {
  return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
}

function decoratorsOf(node) {
  const list = ts.canHaveDecorators && ts.canHaveDecorators(node) ? ts.getDecorators(node) : node.decorators;
  return list ? [...list] : [];
}

function decoratorName(decorator) {
  let expr = decorator.expression;
  if (ts.isCallExpression(expr)) expr = expr.expression;
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  return null;
}

function forEachNode(node, cb) {
  cb(node);
  ts.forEachChild(node, (child) => forEachNode(child, cb));
}

/**
 * Exported helpers such as `export const Auth = () => applyDecorators(UseGuards(...))`
 * are treated as guard decorators too.
 */
function findCompositeGuardDecorators(sourceFiles) {
  const names = new Set();
  for (const sf of sourceFiles) {
    const text = sf.text;
    if (!text.includes('applyDecorators') || !text.includes('UseGuards')) continue;
    forEachNode(sf, (node) => {
      if (ts.isFunctionDeclaration(node) && node.name && node.body) {
        if (node.body.getText(sf).includes('UseGuards(')) names.add(node.name.text);
      }
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        if (node.initializer.getText(sf).includes('UseGuards(')) names.add(node.name.text);
      }
    });
  }
  return names;
}

/** Class names listed in any `@Module({ controllers: [...] })`. */
function findRegisteredControllers(sourceFiles) {
  const registered = new Set();
  for (const sf of sourceFiles) {
    if (!sf.text.includes('controllers')) continue;

    // Resolve `const X = [A, B]` arrays used via spread in the same file.
    const localArrays = new Map();
    forEachNode(sf, (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        ts.isArrayLiteralExpression(node.initializer)
      ) {
        localArrays.set(node.name.text, node.initializer);
      }
    });

    const collect = (arrayLiteral) => {
      for (const el of arrayLiteral.elements) {
        if (ts.isIdentifier(el)) registered.add(el.text);
        else if (ts.isSpreadElement(el) && ts.isIdentifier(el.expression)) {
          const local = localArrays.get(el.expression.text);
          if (local) collect(local);
        }
      }
    };

    forEachNode(sf, (node) => {
      if (
        ts.isPropertyAssignment(node) &&
        node.name &&
        node.name.getText(sf) === 'controllers' &&
        ts.isArrayLiteralExpression(node.initializer)
      ) {
        collect(node.initializer);
      }
    });
  }
  return registered;
}

function findUnguardedRoutes(sourceFiles, registered, guardDecorators) {
  const violations = [];
  for (const sf of sourceFiles) {
    if (!sf.text.includes('@Controller')) continue;
    const rel = path.relative(ROOT, sf.fileName).split(path.sep).join('/');

    forEachNode(sf, (node) => {
      if (!ts.isClassDeclaration(node) || !node.name) return;
      const classDecorators = decoratorsOf(node).map(decoratorName);
      if (!classDecorators.includes('Controller')) return;
      if (!registered.has(node.name.text)) return;

      const covers = (names) => names.some((n) => guardDecorators.has(n) || PUBLIC_DECORATORS.has(n));
      if (covers(classDecorators)) return;

      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member)) continue;
        const names = decoratorsOf(member).map(decoratorName);
        if (!names.some((n) => HTTP_METHOD_DECORATORS.has(n))) continue;
        if (covers(names)) continue;
        violations.push(`${rel}#${node.name.text}.${member.name.getText(sf)}`);
      }
    });
  }
  return violations.sort();
}

function main() {
  const sourceFiles = walk(SRC).map(parse);
  const guardDecorators = new Set([...ROUTE_GUARD_DECORATORS, ...findCompositeGuardDecorators(sourceFiles)]);
  const registered = findRegisteredControllers(sourceFiles);
  const violations = findUnguardedRoutes(sourceFiles, registered, guardDecorators);

  if (args.has('--update-baseline')) {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(violations, null, 2) + '\n');
    console.log(`Wrote ${violations.length} entries to ${path.relative(ROOT, BASELINE_PATH)}`);
    return;
  }

  const baseline = new Set(fs.existsSync(BASELINE_PATH) ? JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) : []);
  const current = new Set(violations);
  const fresh = violations.filter((v) => !baseline.has(v));
  const stale = [...baseline].filter((v) => !current.has(v)).sort();
  const known = violations.length - fresh.length;

  if (known > 0) {
    console.log(`ℹ ${known} pre-existing unguarded route(s) are tracked in ${path.relative(ROOT, BASELINE_PATH)}.`);
  }

  if (stale.length > 0) {
    console.log(`\n${args.has('--strict') ? '✖' : '⚠'} ${stale.length} baseline entr${stale.length === 1 ? 'y is' : 'ies are'} now guarded or gone — remove from the baseline:`);
    stale.forEach((v) => console.log(`    ${v}`));
  }

  if (fresh.length > 0) {
    console.error(`\n✖ ${fresh.length} registered route(s) have no guard and no @Public():`);
    fresh.forEach((v) => console.error(`    ${v}`));
    console.error('\nAdd @UseGuards(JwtAuthGuard, RolesGuard) with explicit @Roles(...) to the controller or');
    console.error('handler, or mark an intentionally public route with @Public().');
    process.exit(1);
  }

  if (args.has('--strict') && stale.length > 0) process.exit(1);

  console.log('\n✔ No new unguarded controller routes.');
}

main();

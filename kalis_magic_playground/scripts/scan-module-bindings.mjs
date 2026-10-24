// scripts/scan-module-bindings.mjs
//
// 목적:
// 앱 폴더의 ES module을 acorn으로 파싱해서 두 종류의 문제를 찾음.
// - undeclared: 선언/import/알려진 전역 어디에도 없는 식별자 사용
// - unresolved: import한 이름을 대상 모듈이 export하지 않음 (또는 파일 없음)
//
// 사용법:
// node scripts/scan-module-bindings.mjs <app-dir>

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';

const JS_GLOBALS = new Set(vm.runInNewContext('Object.getOwnPropertyNames(globalThis)'));

const BROWSER_GLOBALS = new Set(`window document navigator location localStorage sessionStorage indexedDB history screen self top parent frames globalThis console setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame requestIdleCallback cancelIdleCallback queueMicrotask fetch Request Response Headers URL URLSearchParams Blob File FileReader FormData AbortController AbortSignal Event CustomEvent EventTarget KeyboardEvent MouseEvent PointerEvent TouchEvent WheelEvent ErrorEvent PromiseRejectionEvent MessageEvent Node Element HTMLElement HTMLCanvasElement HTMLInputElement HTMLImageElement HTMLVideoElement HTMLAudioElement HTMLButtonElement HTMLSelectElement HTMLTextAreaElement HTMLDialogElement SVGElement DOMParser DOMException DOMRect DOMMatrix MutationObserver ResizeObserver IntersectionObserver Image Audio Option AudioContext webkitAudioContext OfflineAudioContext AudioBuffer AudioBufferSourceNode GainNode OscillatorNode MediaRecorder MediaStream MediaStreamTrack Notification Worker SharedWorker ServiceWorker BroadcastChannel MessageChannel Path2D ImageData ImageBitmap createImageBitmap OffscreenCanvas CanvasRenderingContext2D WebGLRenderingContext WebGL2RenderingContext TextEncoder TextDecoder crypto performance structuredClone atob btoa alert confirm prompt open close matchMedia getComputedStyle innerWidth innerHeight devicePixelRatio scrollTo scrollBy addEventListener removeEventListener dispatchEvent postMessage speechSynthesis SpeechSynthesisUtterance Intl caches CacheStorage Cache navigator screenX XMLHttpRequest WebSocket Gamepad DeviceOrientationEvent DeviceMotionEvent Touch vibrate customElements CSS CSSStyleSheet TouchList Selection Range getSelection screen requestFullscreen BarcodeDetector DecompressionStream CompressionStream ReadableStream WritableStream TransformStream Response isSecureContext origin name length orientation visualViewport trustedTypes Storage StorageEvent IDBKeyRange IDBDatabase WakeLock XMLSerializer DataTransfer ClipboardItem VideoFrame AudioData AudioWorkletNode AudioParam AnalyserNode BiquadFilterNode ConvertToBuffer PeriodicWave ScriptProcessorNode StereoPannerNode DynamicsCompressorNode ConstantSourceNode MediaElementAudioSourceNode MediaStreamAudioSourceNode MediaStreamAudioDestinationNode DOMTokenList NodeList HTMLCollection ShadowRoot DocumentFragment Text Comment HTMLMediaElement HTMLFormElement MediaMetadata MediaSession`.split(/\s+/));

// 브라우저 앱에는 없는 Node 전용 이름 (JS 전역에 섞여 보여도 undeclared로 취급)
const NODE_ONLY = new Set(['require', 'module', 'exports', 'process', 'Buffer', '__dirname', '__filename']);

const PARSE_OPTIONS = { ecmaVersion: 'latest', sourceType: 'module', locations: true };

// ---------- 파일 탐색 ----------

function walk(dir, predicate, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, predicate, out);
    else if (predicate(entry.name)) out.push(full);
  }
  return out;
}

function isSkippedFile(rel) {
  return /(^|\/)sw\.js$/.test(rel)
    || /\.test\.m?js$/.test(rel)
    || /(^|\/)tests?\//.test(rel)
    || /(^|\/)vendor\//.test(rel);
}

// html의 <script src>를 module/classic으로 나눠 절대경로로 모음
// 인라인 <script type="module"> 본문은 가상 경로 "<html>#inline-N"로 모음
// (path.dirname이 html 폴더가 되므로 상대 import가 html 기준으로 해석됨)
function collectHtmlScripts(dir) {
  const moduleScripts = new Set();
  const classicScripts = new Set();
  const inlineModules = new Map();
  for (const html of walk(dir, (name) => name.endsWith('.html'))) {
    const text = fs.readFileSync(html, 'utf8');
    let inlineCount = 0;
    for (const match of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      const attrs = match[1];
      const isModule = /type\s*=\s*["']module["']/.test(attrs);
      const src = (attrs.match(/src\s*=\s*["']([^"']+)["']/) || [])[1];
      if (!src) {
        if (isModule && match[2].trim()) inlineModules.set(`${html}#inline-${inlineCount++}`, match[2]);
        continue;
      }
      if (/^https?:/.test(src)) continue;
      const file = path.resolve(path.dirname(html), src.split('?')[0].split('#')[0]);
      if (isModule) moduleScripts.add(file);
      else classicScripts.add(file);
    }
  }
  return { moduleScripts, classicScripts, inlineModules };
}

function tryParse(file) {
  try {
    return acorn.parse(fs.readFileSync(file, 'utf8'), PARSE_OPTIONS);
  } catch {
    return null;
  }
}

function hasModuleSyntax(ast) {
  return ast.body.some((stmt) => /^(Import|Export)/.test(stmt.type));
}

// 상대 import 대상 경로 (동적 import의 문자열 리터럴 포함)
function relativeImportsOf(ast, file) {
  const out = [];
  (function visit(node) {
    if (!node || typeof node.type !== 'string') return;
    const isStatic = node.type === 'ImportDeclaration'
      || node.type === 'ExportNamedDeclaration'
      || node.type === 'ExportAllDeclaration';
    if (isStatic && node.source) out.push(node.source.value);
    if (node.type === 'ImportExpression' && node.source.type === 'Literal') out.push(node.source.value);
    for (const key in node) {
      if (key === 'loc') continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child.type === 'string') visit(child);
    }
  })(ast);
  return out
    .filter((source) => source.startsWith('.'))
    .map((source) => path.resolve(path.dirname(file), source));
}

// ---------- 선언 수집 ----------

function collectPatternNames(pattern, out) {
  if (!pattern) return;
  switch (pattern.type) {
    case 'Identifier':
      out.push(pattern.name);
      break;
    case 'ObjectPattern':
      pattern.properties.forEach((prop) => {
        collectPatternNames(prop.type === 'RestElement' ? prop.argument : prop.value, out);
      });
      break;
    case 'ArrayPattern':
      pattern.elements.forEach((element) => collectPatternNames(element, out));
      break;
    case 'RestElement':
      collectPatternNames(pattern.argument, out);
      break;
    case 'AssignmentPattern':
      collectPatternNames(pattern.left, out);
      break;
  }
}

const isFunctionNode = (node) => /^(Function|ArrowFunction)/.test(node.type);

// var 선언은 함수(또는 class static block) 경계까지 끌어올림
function collectHoistedVars(node, out, isRoot = true) {
  if (!node || typeof node.type !== 'string') return;
  if (!isRoot && (isFunctionNode(node) || node.type === 'StaticBlock')) return;
  if (node.type === 'VariableDeclaration' && node.kind === 'var') {
    node.declarations.forEach((decl) => collectPatternNames(decl.id, out));
  }
  for (const key in node) {
    if (key === 'loc') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      child.forEach((item) => item && typeof item.type === 'string' && collectHoistedVars(item, out, false));
    } else if (child && typeof child.type === 'string') {
      collectHoistedVars(child, out, false);
    }
  }
}

// 블록 단위로 보이는 선언 (let/const/function/class/import)
function collectStatementDecls(statements, out) {
  for (const stmt of statements) {
    if (stmt.type === 'VariableDeclaration' && stmt.kind !== 'var') {
      stmt.declarations.forEach((decl) => collectPatternNames(decl.id, out));
    } else if (stmt.type === 'FunctionDeclaration' || stmt.type === 'ClassDeclaration') {
      if (stmt.id) out.push(stmt.id.name); // export default function(){} 은 id가 없음
    } else if (stmt.type === 'ImportDeclaration') {
      stmt.specifiers.forEach((spec) => out.push(spec.local.name));
    } else if ((stmt.type === 'ExportNamedDeclaration' || stmt.type === 'ExportDefaultDeclaration') && stmt.declaration) {
      collectStatementDecls([stmt.declaration], out);
    }
  }
}

// ---------- export 해석 ----------

// 모듈이 export하는 이름 -> 바인딩 키(원본 위치) Map.
// `export *`로 서로 다른 바인딩이 같은 이름으로 들어오면 AMBIGUOUS
// (명시 export가 있으면 그쪽이 우선, 같은 원본을 두 경로로 받는 건 모호하지 않음)
const AMBIGUOUS = Symbol('ambiguous');

function createExportResolver(asts) {
  const cache = new Map();
  function exportsOf(file, seen = new Set()) {
    if (cache.has(file)) return cache.get(file);
    if (seen.has(file)) return new Map();
    seen.add(file);
    const ast = asts.get(file) || tryParse(file);
    const explicit = new Map();
    if (!ast) return explicit;
    const stars = new Map();
    const dir = path.dirname(file);
    for (const stmt of ast.body) {
      if (stmt.type === 'ExportNamedDeclaration') {
        if (stmt.declaration) {
          const declared = [];
          if (stmt.declaration.type === 'VariableDeclaration') {
            stmt.declaration.declarations.forEach((decl) => collectPatternNames(decl.id, declared));
          } else {
            declared.push(stmt.declaration.id.name);
          }
          declared.forEach((name) => explicit.set(name, `${file}#${name}`));
        }
        for (const spec of stmt.specifiers) {
          const exported = spec.exported.name ?? spec.exported.value;
          const local = spec.local.name ?? spec.local.value;
          const fromTarget = stmt.source && stmt.source.value.startsWith('.')
            ? exportsOf(path.resolve(dir, stmt.source.value), seen).get(local)
            : undefined;
          explicit.set(exported, fromTarget ?? `${file}#${local}`);
        }
      } else if (stmt.type === 'ExportDefaultDeclaration') {
        explicit.set('default', `${file}#default`);
      } else if (stmt.type === 'ExportAllDeclaration') {
        if (stmt.exported) {
          explicit.set(stmt.exported.name ?? stmt.exported.value, `${file}#ns:${stmt.source.value}`);
        } else {
          for (const [name, binding] of exportsOf(path.resolve(dir, stmt.source.value), seen)) {
            if (name === 'default') continue;
            const prev = stars.get(name);
            stars.set(name, prev === undefined || prev === binding ? binding : AMBIGUOUS);
          }
        }
      }
    }
    const names = new Map(explicit);
    for (const [name, binding] of stars) {
      if (!names.has(name)) names.set(name, binding);
    }
    cache.set(file, names);
    return names;
  }
  return exportsOf;
}

// ---------- 검사 ----------

function findUnresolvedImports(ast, file, rel, exportsOf) {
  const found = [];
  for (const stmt of ast.body) {
    let source = null;
    let names = [];
    if (stmt.type === 'ImportDeclaration') {
      source = stmt.source.value;
      names = stmt.specifiers
        .filter((spec) => spec.type === 'ImportSpecifier')
        .map((spec) => spec.imported.name || spec.imported.value);
      if (stmt.specifiers.some((spec) => spec.type === 'ImportDefaultSpecifier')) names.push('default');
    } else if (stmt.type === 'ExportNamedDeclaration' && stmt.source) {
      source = stmt.source.value;
      names = stmt.specifiers.map((spec) => spec.local.name);
    }
    if (stmt.type === 'ExportAllDeclaration') source = stmt.source.value;
    if (!source || !source.startsWith('.')) continue;

    const target = path.resolve(path.dirname(file), source);
    if (!fs.existsSync(target)) {
      found.push({ file: rel, line: stmt.loc.start.line, name: null, source, reason: 'file missing' });
      continue;
    }
    const exported = exportsOf(target);
    for (const name of names) {
      if (!exported.has(name)) {
        found.push({ file: rel, line: stmt.loc.start.line, name, source, reason: 'not exported' });
      } else if (exported.get(name) === AMBIGUOUS) {
        found.push({ file: rel, line: stmt.loc.start.line, name, source, reason: 'ambiguous star export' });
      }
    }
  }

  // 문자열 리터럴 동적 import는 대상 파일 존재만 확인
  (function visit(node) {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'ImportExpression' && node.source.type === 'Literal'
      && typeof node.source.value === 'string' && node.source.value.startsWith('.')
      && !fs.existsSync(path.resolve(path.dirname(file), node.source.value))) {
      found.push({ file: rel, line: node.loc.start.line, name: null, source: node.source.value, reason: 'file missing' });
    }
    for (const key in node) {
      if (key === 'loc') continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach(visit);
      else if (child && typeof child.type === 'string') visit(child);
    }
  })(ast);
  return found;
}

function findUndeclaredIdentifiers(ast, rel) {
  const found = [];

  function visit(node, scopes, parent, key) {
    if (!node || typeof node.type !== 'string') return;
    let scope = scopes;
    let bodyScope = null;
    const addScope = (names) => { scope = [...scope, new Set(names)]; };

    if (node.type === 'Program') {
      const names = [];
      collectHoistedVars(node, names);
      collectStatementDecls(node.body, names);
      addScope(names);
    } else if (isFunctionNode(node)) {
      // 파라미터 초기값은 본문 var를 볼 수 없으므로 scope를 둘로 나눔
      const names = [];
      node.params.forEach((param) => collectPatternNames(param, names));
      if (node.id && node.type === 'FunctionExpression') names.push(node.id.name);
      if (node.type !== 'ArrowFunctionExpression') names.push('arguments');
      addScope(names);
      const bodyNames = [];
      if (node.body.type === 'BlockStatement') collectHoistedVars(node.body, bodyNames);
      bodyScope = [...scope, new Set(bodyNames)];
    } else if (node.type === 'StaticBlock') {
      const names = [];
      collectHoistedVars(node, names);
      collectStatementDecls(node.body, names);
      addScope(names);
    } else if (node.type === 'BlockStatement') {
      const names = [];
      collectStatementDecls(node.body, names);
      addScope(names);
    } else if (/^For(In|Of)?Statement$/.test(node.type)) {
      const names = [];
      const head = node.init || node.left;
      if (head && head.type === 'VariableDeclaration' && head.kind !== 'var') {
        head.declarations.forEach((decl) => collectPatternNames(decl.id, names));
      }
      addScope(names);
    } else if (node.type === 'CatchClause') {
      const names = [];
      collectPatternNames(node.param, names);
      addScope(names);
    } else if (node.type === 'SwitchStatement') {
      const names = [];
      node.cases.forEach((c) => collectStatementDecls(c.consequent, names));
      addScope(names);
    } else if ((node.type === 'ClassExpression' || node.type === 'ClassDeclaration') && node.id) {
      addScope([node.id.name]);
    }

    if (node.type === 'Identifier') {
      if (isNonReference(node, parent, key)) return;
      if (node.name === 'undefined' || scope.some((s) => s.has(node.name))) return;
      if (JS_GLOBALS.has(node.name) && !NODE_ONLY.has(node.name)) return;
      if (BROWSER_GLOBALS.has(node.name)) return;
      const isWrite = parent && (
        (parent.type === 'AssignmentExpression' && key === 'left')
        || parent.type === 'UpdateExpression'
        || ((parent.type === 'ForInStatement' || parent.type === 'ForOfStatement') && key === 'left')
      );
      const isTypeof = parent && parent.type === 'UnaryExpression' && parent.operator === 'typeof';
      found.push({
        file: rel,
        line: node.loc.start.line,
        name: node.name,
        kind: isWrite ? 'write' : 'read' + (isTypeof ? '(typeof)' : '')
      });
      return;
    }

    for (const childKey in node) {
      if (childKey === 'loc') continue;
      const child = node[childKey];
      const childScope = bodyScope && childKey === 'body' ? bodyScope : scope;
      if (Array.isArray(child)) {
        child.forEach((item) => item && typeof item.type === 'string' && visit(item, childScope, node, childKey));
      } else if (child && typeof child.type === 'string') {
        visit(child, childScope, node, childKey);
      }
    }
  }

  visit(ast, [], null, null);
  return found;
}

// 변수 참조가 아닌 식별자 (프로퍼티 이름, 라벨, import/export specifier 등)
function isNonReference(node, parent, key) {
  if (!parent) return false;
  if (parent.type === 'MemberExpression' && key === 'property' && !parent.computed) return true;
  if ((parent.type === 'Property' || parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition')
    && key === 'key' && !parent.computed) return true;
  if (/^(Labeled|Break|Continue)Statement$/.test(parent.type) && key === 'label') return true;
  if (parent.type === 'ExportAllDeclaration' && key === 'exported') return true;
  if (/^(Import|Export)(Specifier|DefaultSpecifier|NamespaceSpecifier)$/.test(parent.type)) return true;
  return parent.type === 'MetaProperty';
}

// ---------- 진입점 ----------

export function scanAppDir(dir) {
  const root = path.resolve(dir);
  const { moduleScripts, classicScripts, inlineModules } = collectHtmlScripts(root);
  const candidates = walk(root, (name) => /\.m?js$/.test(name))
    .filter((file) => !isSkippedFile(path.relative(root, file)));

  // html의 module script에서 import를 따라 닿는 모듈들
  const modules = new Set();
  const asts = new Map();
  const parseErrors = [];
  const queue = [...moduleScripts, ...inlineModules.keys()].filter((file) => inlineModules.has(file) || fs.existsSync(file));
  while (queue.length) {
    const file = queue.pop();
    const isInline = inlineModules.has(file);
    if (modules.has(file) || (!isInline && !fs.existsSync(file))) continue;
    modules.add(file);
    let ast;
    try {
      ast = acorn.parse(isInline ? inlineModules.get(file) : fs.readFileSync(file, 'utf8'), PARSE_OPTIONS);
    } catch (err) {
      parseErrors.push({ file: path.relative(root, file), message: err.message });
      continue;
    }
    asts.set(file, ast);
    queue.push(...relativeImportsOf(ast, file));
  }

  // 닿지 않았어도 module 문법(import/export)이 있으면 module로 취급
  for (const file of candidates) {
    if (modules.has(file) || classicScripts.has(file)) continue;
    const ast = tryParse(file);
    if (ast && hasModuleSyntax(ast)) {
      modules.add(file);
      asts.set(file, ast);
    }
  }

  const exportsOf = createExportResolver(asts);
  const undeclared = [];
  const unresolved = [];
  for (const [file, ast] of [...asts].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const rel = path.relative(root, file);
    unresolved.push(...findUnresolvedImports(ast, file, rel, exportsOf));
    undeclared.push(...findUndeclaredIdentifiers(ast, rel));
  }
  return { undeclared, unresolved, parseErrors };
}

function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node scripts/scan-module-bindings.mjs <app-dir>');
    process.exit(2);
  }
  const { undeclared, unresolved, parseErrors } = scanAppDir(dir);
  console.log(`[${path.basename(path.resolve(dir))}] undeclared=${undeclared.length} unresolved=${unresolved.length} parseErrors=${parseErrors.length}`);
  for (const u of undeclared) console.log(`  UNDECL ${u.file}:${u.line} ${u.name} ${u.kind}`);
  for (const u of unresolved) console.log(`  UNRESOLVED ${u.file}:${u.line} ${u.name ?? '*'} from ${u.source} (${u.reason})`);
  for (const p of parseErrors) console.log(`  PARSEERR ${p.file}: ${p.message}`);
  if (undeclared.length || unresolved.length || parseErrors.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

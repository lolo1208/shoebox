/**
 * Text diff engine.
 *
 * Core algorithm: Myers O(ND) shortest edit script (with path backtracking).
 * A common prefix/suffix is trimmed first, and a linear-ish memory snapshot of
 * every D-step is kept so the path can be reconstructed.
 *
 * For pathological inputs (huge or completely different texts) we stop early and
 * fall back to a fast "resync" heuristic so the UI never freezes.
 */

export type DiffType = 'equal' | 'insert' | 'delete';

/** 索引型操作，区间均指向原始（未裁剪）数组 */
export interface DiffOp {
  type: DiffType;
  aStart: number;
  aLen: number;
  bStart: number;
  bLen: number;
}

/** 按展示顺序排列的行/词单元，-1 表示该侧不存在 */
export interface DiffEntry {
  type: DiffType;
  aIdx: number;
  bIdx: number;
}

export interface InlineSegment {
  type: DiffType;
  text: string;
}

interface Unit {
  type: DiffType;
}

const D_LIMIT = 2000;
const MAX_TOTAL_UNITS = 20000;
const RESYNC_WINDOW = 80;

/** Myers O(ND) 算法；编辑距离超过 maxD 时返回 null */
function myersUnits(a: string[], b: string[], maxD: number): Unit[] | null {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  if (max === 0) return [];

  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  const bases: number[] = [];
  const limit = Math.min(max, maxD);
  let found = -1;

  for (let d = 0; d <= limit; d++) {
    // 保存 k 在 [-d-1, d+1] 区间内的 V 快照，仅覆盖回溯可能用到的部分
    const base = -d - 1;
    const snap = new Int32Array(2 * d + 3);
    for (let k = base; k <= d + 1; k++) snap[k - base] = v[offset + k];
    trace.push(snap);
    bases.push(base);

    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
        x = v[offset + k + 1];
      } else {
        x = v[offset + k - 1] + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = d;
        break;
      }
    }
    if (found >= 0) break;
  }

  if (found < 0) return null;

  const units: Unit[] = [];
  let x = n;
  let y = m;

  for (let d = found; d >= 0; d--) {
    const snap = trace[d];
    const base = bases[d];
    const at = (k: number) => {
      const i = k - base;
      return i >= 0 && i < snap.length ? snap[i] : 0;
    };

    const k = x - y;
    const prevK = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1;
    const prevX = at(prevK);
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      units.push({ type: 'equal' });
      x--;
      y--;
    }

    if (d > 0) {
      if (x > prevX) units.push({ type: 'delete' });
      else if (y > prevY) units.push({ type: 'insert' });
      x = prevX;
      y = prevY;
    }
  }

  units.reverse();
  return units;
}

/** Myers 放弃时使用的快速保底差异算法 */
function resyncUnits(a: string[], b: string[]): Unit[] {
  const units: Unit[] = [];
  const n = a.length;
  const m = b.length;
  let i = 0;
  let j = 0;

  while (i < n && j < m) {
    if (a[i] === b[j]) {
      units.push({ type: 'equal' });
      i++;
      j++;
      continue;
    }

    let stepA = -1;
    let stepB = -1;
    for (let d = 1; d <= RESYNC_WINDOW; d++) {
      if (i + d < n && j + d < m && a[i + d] === b[j + d]) {
        stepA = d;
        stepB = d;
        break;
      }
      if (i + d < n && a[i + d] === b[j]) {
        stepA = d;
        stepB = 0;
        break;
      }
      if (j + d < m && a[i] === b[j + d]) {
        stepA = 0;
        stepB = d;
        break;
      }
    }

    if (stepA < 0) {
      for (; i < n; i++) units.push({ type: 'delete' });
      for (; j < m; j++) units.push({ type: 'insert' });
      return units;
    }

    for (let t = 0; t < stepA; t++) units.push({ type: 'delete' });
    for (let t = 0; t < stepB; t++) units.push({ type: 'insert' });
    i += stepA;
    j += stepB;
  }

  for (; i < n; i++) units.push({ type: 'delete' });
  for (; j < m; j++) units.push({ type: 'insert' });
  return units;
}

function unitsToOps(units: Unit[], aOff: number, bOff: number): DiffOp[] {
  const ops: DiffOp[] = [];
  let ai = aOff;
  let bi = bOff;
  let cur: DiffOp | null = null;

  for (const u of units) {
    if (!cur || cur.type !== u.type) {
      if (cur) ops.push(cur);
      cur = { type: u.type, aStart: ai, aLen: 0, bStart: bi, bLen: 0 };
    }
    if (u.type === 'equal') {
      cur.aLen++;
      cur.bLen++;
      ai++;
      bi++;
    } else if (u.type === 'delete') {
      cur.aLen++;
      ai++;
    } else {
      cur.bLen++;
      bi++;
    }
  }
  if (cur) ops.push(cur);
  return ops;
}

/** 比较两个已归一化的键序列，返回紧凑的索引型操作列表。 */
export function diffKeys(aKeys: string[], bKeys: string[], maxD: number = D_LIMIT): DiffOp[] {
  const n = aKeys.length;
  const m = bKeys.length;
  const ops: DiffOp[] = [];

  let pre = 0;
  while (pre < n && pre < m && aKeys[pre] === bKeys[pre]) pre++;

  let suf = 0;
  while (suf < n - pre && suf < m - pre && aKeys[n - 1 - suf] === bKeys[m - 1 - suf]) suf++;

  if (pre > 0) ops.push({ type: 'equal', aStart: 0, aLen: pre, bStart: 0, bLen: pre });

  const midA = aKeys.slice(pre, n - suf);
  const midB = bKeys.slice(pre, m - suf);

  if (midA.length === 0 && midB.length === 0) {
    // 公共前后缀之间没有内容
  } else if (midA.length === 0) {
    ops.push({ type: 'insert', aStart: pre, aLen: 0, bStart: pre, bLen: midB.length });
  } else if (midB.length === 0) {
    ops.push({ type: 'delete', aStart: pre, aLen: midA.length, bStart: pre, bLen: 0 });
  } else {
    const units =
      midA.length + midB.length > MAX_TOTAL_UNITS
        ? resyncUnits(midA, midB)
        : myersUnits(midA, midB, maxD) ?? resyncUnits(midA, midB);
    ops.push(...unitsToOps(units, pre, pre));
  }

  if (suf > 0) {
    ops.push({ type: 'equal', aStart: n - suf, aLen: suf, bStart: m - suf, bLen: suf });
  }

  return ops;
}

/** 将操作展开为按展示顺序排列的逐行/逐词条目 */
export function toEntries(ops: DiffOp[]): DiffEntry[] {
  const entries: DiffEntry[] = [];
  let ai = 0;
  let bi = 0;

  for (const op of ops) {
    if (op.type === 'equal') {
      for (let k = 0; k < op.aLen; k++) entries.push({ type: 'equal', aIdx: ai + k, bIdx: bi + k });
      ai += op.aLen;
      bi += op.bLen;
    } else if (op.type === 'delete') {
      for (let k = 0; k < op.aLen; k++) entries.push({ type: 'delete', aIdx: ai + k, bIdx: -1 });
      ai += op.aLen;
    } else {
      for (let k = 0; k < op.bLen; k++) entries.push({ type: 'insert', aIdx: -1, bIdx: bi + k });
      bi += op.bLen;
    }
  }

  return entries;
}

/* ------------------------------------------------------------------ */
/* 分词 */
/* ------------------------------------------------------------------ */

const TOKEN_RE = /(\s+|[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]|[A-Za-z0-9_]+|[^\s])/gu;

/** 按词切分，空白单独成词；CJK 字符逐字切分 */
export function tokenizeWords(text: string): string[] {
  return text.match(TOKEN_RE) ?? [];
}

/** 按 Unicode 码点切分 */
export function splitChars(text: string): string[] {
  return Array.from(text);
}

/* ------------------------------------------------------------------ */
/* 行内（词级）差异 */
/* ------------------------------------------------------------------ */

/** 两行文本的词级差异 */
export function diffLinesInline(
  aText: string,
  bText: string
): { left: InlineSegment[]; right: InlineSegment[]; ratio: number } {
  const aTok = tokenizeWords(aText);
  const bTok = tokenizeWords(bText);
  const ops = diffKeys(aTok, bTok, 1200);

  const left: InlineSegment[] = [];
  const right: InlineSegment[] = [];
  let equalLen = 0;
  let ai = 0;
  let bi = 0;

  const push = (target: InlineSegment[], type: DiffType, text: string) => {
    if (!text) return;
    const last = target[target.length - 1];
    if (last && last.type === type) last.text += text;
    else target.push({ type, text });
  };

  for (const op of ops) {
    if (op.type === 'equal') {
      for (let k = 0; k < op.aLen; k++) {
        const t = aTok[ai + k];
        equalLen += t.length;
        push(left, 'equal', t);
        push(right, 'equal', bTok[bi + k]);
      }
      ai += op.aLen;
      bi += op.bLen;
    } else if (op.type === 'delete') {
      for (let k = 0; k < op.aLen; k++) push(left, 'delete', aTok[ai + k]);
      ai += op.aLen;
    } else {
      for (let k = 0; k < op.bLen; k++) push(right, 'insert', bTok[bi + k]);
      bi += op.bLen;
    }
  }

  const total = aText.length + bText.length;
  return { left, right, ratio: total === 0 ? 1 : (equalLen * 2) / total };
}

/* ------------------------------------------------------------------ */
/* 全文词级 / 字符级差异 */
/* ------------------------------------------------------------------ */

/** 按词或字符比较两段文本，返回统一的片段流 */
export function diffTextSegments(aText: string, bText: string, mode: 'word' | 'char'): InlineSegment[] {
  const aTok = mode === 'word' ? tokenizeWords(aText) : splitChars(aText);
  const bTok = mode === 'word' ? tokenizeWords(bText) : splitChars(bText);
  const ops = diffKeys(aTok, bTok);

  const segments: InlineSegment[] = [];
  let ai = 0;
  let bi = 0;

  const push = (type: DiffType, text: string) => {
    if (!text) return;
    const last = segments[segments.length - 1];
    if (last && last.type === type) last.text += text;
    else segments.push({ type, text });
  };

  for (const op of ops) {
    if (op.type === 'equal') {
      for (let k = 0; k < op.aLen; k++) push('equal', aTok[ai + k]);
      ai += op.aLen;
      bi += op.bLen;
    } else if (op.type === 'delete') {
      for (let k = 0; k < op.aLen; k++) push('delete', aTok[ai + k]);
      ai += op.aLen;
    } else {
      for (let k = 0; k < op.bLen; k++) push('insert', bTok[bi + k]);
      bi += op.bLen;
    }
  }

  return segments;
}

/* ------------------------------------------------------------------ */
/* 统一差异（.diff）导出 */
/* ------------------------------------------------------------------ */

function formatRange(start: number, len: number): string {
  if (len === 0) return `${start},0`;
  if (len === 1) return `${start}`;
  return `${start},${len}`;
}

export function toUnifiedPatch(
  aLines: string[],
  bLines: string[],
  ops: DiffOp[],
  options: { aLabel?: string; bLabel?: string; context?: number } = {}
): string {
  const { aLabel = 'original', bLabel = 'modified', context = 3 } = options;
  const entries = toEntries(ops);
  const keep = new Array<boolean>(entries.length).fill(false);

  entries.forEach((e, i) => {
    if (e.type === 'equal') return;
    const from = Math.max(0, i - context);
    const to = Math.min(entries.length - 1, i + context);
    for (let k = from; k <= to; k++) keep[k] = true;
  });

  const out: string[] = [`--- ${aLabel}`, `+++ ${bLabel}`];

  // 每个条目之前已消费的 a/b 行数
  const consumedA: number[] = new Array(entries.length + 1).fill(0);
  const consumedB: number[] = new Array(entries.length + 1).fill(0);
  entries.forEach((e, i) => {
    consumedA[i + 1] = consumedA[i] + (e.aIdx >= 0 ? 1 : 0);
    consumedB[i + 1] = consumedB[i] + (e.bIdx >= 0 ? 1 : 0);
  });

  const hasChanges = keep.some(Boolean);
  if (!hasChanges) return `${out.join('\n')}\n# no differences`;

  let i = 0;
  while (i < entries.length) {
    if (!keep[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < entries.length && keep[j + 1]) j++;

    const aLen = consumedA[j + 1] - consumedA[i];
    const bLen = consumedB[j + 1] - consumedB[i];
    const aStart = consumedA[i] + 1;
    const bStart = consumedB[i] + 1;
    out.push(`@@ -${formatRange(aStart, aLen)} +${formatRange(bStart, bLen)} @@`);

    for (let k = i; k <= j; k++) {
      const e = entries[k];
      if (e.type === 'equal') out.push(` ${aLines[e.aIdx]}`);
      else if (e.type === 'delete') out.push(`-${aLines[e.aIdx]}`);
      else out.push(`+${bLines[e.bIdx]}`);
    }

    i = j + 1;
  }

  return out.join('\n');
}

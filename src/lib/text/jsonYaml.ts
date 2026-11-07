/**
 * JSON / YAML 工具的数据层。
 * 解析、校验、美化、排序与转换均在本地完成。
 */

import { dump, loadAll, YAMLException } from 'js-yaml';

export type DataFormat = 'json' | 'yaml';
export type FormatPreference = 'auto' | DataFormat;
export type SortOrder = 'none' | 'asc' | 'desc';

export interface ParseIssue {
  /** 去除位置噪声的错误信息 */
  message: string;
  /** 行号（从 1 开始，已知时） */
  line?: number;
  /** 列号（从 1 开始，已知时） */
  column?: number;
  /** 是否为内部哨兵值（空内容） */
  empty?: boolean;
}

export interface ParsedDocument {
  data: unknown;
  format: DataFormat;
  /** YAML 文档数量（JSON 恒为 1） */
  documents: number;
}

export type ParseOutcome =
  | { ok: true; document: ParsedDocument }
  | { ok: false; format: DataFormat; issue: ParseIssue };

/** 类型守卫，便于调用处收窄类型 */
export function isParseSuccess(outcome: ParseOutcome): outcome is Extract<ParseOutcome, { ok: true }> {
  return outcome.ok;
}

export function isParseFailure(outcome: ParseOutcome): outcome is Extract<ParseOutcome, { ok: false }> {
  return !outcome.ok;
}

/* ------------------------------------------------------------------ */
/* 解析 */
/* ------------------------------------------------------------------ */

/** 移除 // 与块注释，不影响字符串内容 */
export function stripJsonComments(text: string): string {
  let out = '';
  let inString = false;
  let inLine = false;
  let inBlock = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inLine) {
      if (char === '\n') {
        inLine = false;
        out += char;
      }
      continue;
    }
    if (inBlock) {
      if (char === '*' && next === '/') {
        inBlock = false;
        i++;
      }
      continue;
    }
    if (inString) {
      out += char;
      if (char === '\\') {
        out += next ?? '';
        i++;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      out += char;
    } else if (char === '/' && next === '/') {
      inLine = true;
      i++;
    } else if (char === '/' && next === '*') {
      inBlock = true;
      i++;
    } else {
      out += char;
    }
  }

  return out;
}

function issueFromJsonError(error: unknown, text: string): ParseIssue {
  const message = error instanceof Error ? error.message : String(error);

  const lineColumn = /line (\d+) column (\d+)/.exec(message);
  if (lineColumn) {
    return {
      message: message.replace(/\s*\(line \d+ column \d+\)\s*$/, ''),
      line: Number(lineColumn[1]),
      column: Number(lineColumn[2]),
    };
  }

  const position = /at position (\d+)/.exec(message);
  if (position) {
    const index = Math.min(Number(position[1]), text.length);
    const before = text.slice(0, index);
    const lastBreak = before.lastIndexOf('\n');
    return {
      message: message.replace(/\s*at position \d+.*$/, ''),
      line: before.split('\n').length,
      column: index - lastBreak,
    };
  }

  return { message };
}

function issueFromYamlError(error: unknown): ParseIssue {
  if (error instanceof YAMLException) {
    return {
      message: error.reason || error.message,
      line: error.mark ? error.mark.line + 1 : undefined,
      column: error.mark ? error.mark.column + 1 : undefined,
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { message };
}

function tryJson(text: string): ParseOutcome {
  const cleaned = stripJsonComments(text);
  try {
    return { ok: true, document: { data: JSON.parse(cleaned), format: 'json', documents: 1 } };
  } catch (error) {
    return { ok: false, format: 'json', issue: issueFromJsonError(error, cleaned) };
  }
}

function tryYaml(text: string): ParseOutcome {
  try {
    const docs = loadAll(text).filter((doc) => doc !== undefined);
    if (docs.length === 0) {
      return { ok: false, format: 'yaml', issue: { message: '', empty: true } };
    }
    return {
      ok: true,
      document: { data: docs.length === 1 ? docs[0] : docs, format: 'yaml', documents: docs.length },
    };
  } catch (error) {
    return { ok: false, format: 'yaml', issue: issueFromYamlError(error) };
  }
}

/**
 * 将文本解析为 JSON 或 YAML。
 *
 * auto 模式先尝试 JSON（JSON 是 YAML 的子集，也能兼容带 // 注释的 JSON），
 * 失败后再回退到 YAML，使流式 YAML 与轻微损坏的 JSON 仍可加载。
 */
export function parseInput(text: string, preference: FormatPreference): ParseOutcome {
  if (!text.trim()) return { ok: false, format: 'json', issue: { message: '', empty: true } };

  if (preference === 'json') return tryJson(text);
  if (preference === 'yaml') return tryYaml(text);

  const json = tryJson(text);
  if (json.ok) return json;

  const yaml = tryYaml(text);
  if (yaml.ok) return yaml;

  // 两种都失败：返回更可能是用户意图的那种错误
  return /^[[{"]/.test(text.trim()) ? json : yaml;
}

/* ------------------------------------------------------------------ */
/* 序列化 */
/* ------------------------------------------------------------------ */

/** 递归排序对象键（数组保持原顺序） */
export function sortObjectDeep(value: unknown, order: 'asc' | 'desc'): unknown {
  if (Array.isArray(value)) return value.map((item) => sortObjectDeep(item, order));
  if (value instanceof Date) return value;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    entries.sort(([a], [b]) => (order === 'asc' ? a.localeCompare(b) : b.localeCompare(a)));
    const sorted: Record<string, unknown> = {};
    for (const [key, item] of entries) sorted[key] = sortObjectDeep(item, order);
    return sorted;
  }
  return value;
}

const prepare = (data: unknown, order: SortOrder): unknown =>
  order === 'none' ? data : sortObjectDeep(data, order);

export function stringifyJson(data: unknown, indent: number, order: SortOrder = 'none'): string {
  return JSON.stringify(prepare(data, order), null, indent);
}

export function stringifyJsonCompact(data: unknown, order: SortOrder = 'none'): string {
  return JSON.stringify(prepare(data, order));
}

export function stringifyYaml(data: unknown, indent: number, order: SortOrder = 'none'): string {
  return dump(prepare(data, order), {
    indent,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  }).replace(/\n+$/, '');
}

/**
 * 仅在结构冒号后补空格，不修改字符串内容
 * （直接全局替换会破坏 URL 与时间字符串）。
 */
function spaceAfterColons(json: string): string {
  let out = '';
  let inString = false;

  for (let i = 0; i < json.length; i++) {
    const char = json[i];
    if (inString) {
      out += char;
      if (char === '\\') {
        out += json[i + 1] ?? '';
        i++;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
      out += char;
    } else if (char === ':') {
      out += ': ';
    } else {
      out += char;
    }
  }

  return out;
}

/**
 * 智能格式化：小对象/数组保持单行，其余展开，
 * 比直接 JSON.stringify(..., 2) 更易读。
 */
export function smartJsonStringify(data: unknown, indent: number, order: SortOrder = 'none'): string {
  const maxInline = 80;

  const walk = (node: unknown, level: number): string => {
    const indentStr = ' '.repeat(indent * level);
    const nextIndentStr = ' '.repeat(indent * (level + 1));
    const compact = JSON.stringify(node);

    if (compact === undefined) return 'null';
    if (compact.length <= maxInline) return spaceAfterColons(compact);

    if (Array.isArray(node)) {
      const items = node.map((item) => walk(item, level + 1));
      return `[\n${items.map((item) => nextIndentStr + item).join(',\n')}\n${indentStr}]`;
    }

    if (node && typeof node === 'object') {
      const entries = Object.entries(node as Record<string, unknown>);
      const items = entries.map(
        ([key, value]) => `${nextIndentStr}${JSON.stringify(key)}: ${walk(value, level + 1)}`
      );
      return `{\n${items.join(',\n')}\n${indentStr}}`;
    }

    return compact;
  };

  return walk(prepare(data, order), 0);
}

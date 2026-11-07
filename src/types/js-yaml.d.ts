/**
 * Minimal type declarations for js-yaml (the DefinitelyTyped package is not
 * installed). Only the surface we actually use is declared.
 */
declare module 'js-yaml' {
  export class YAMLException extends Error {
    reason: string;
    mark?: { line: number; column: number; position: number };
  }

  export interface DumpOptions {
    indent?: number;
    lineWidth?: number;
    noRefs?: boolean;
    noCompatMode?: boolean;
    sortKeys?: boolean | ((a: string, b: string) => number);
    quotingType?: '"' | "'";
    forceQuotes?: boolean;
    skipInvalid?: boolean;
    flowLevel?: number;
    condenseFlow?: boolean;
  }

  export interface LoadOptions {
    filename?: string;
    onWarning?: (error: YAMLException) => void;
    json?: boolean;
    allowDuplicateKeys?: boolean;
    noRefs?: boolean;
  }

  export function load(input: string, options?: LoadOptions): unknown;
  export function loadAll(input: string, options?: LoadOptions): unknown[];
  export function dump(input: unknown, options?: DumpOptions): string;
  export const DEFAULT_SCHEMA: unknown;
  export const CORE_SCHEMA: unknown;
  export const JSON_SCHEMA: unknown;
}

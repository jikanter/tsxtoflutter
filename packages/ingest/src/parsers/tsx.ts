import { parse, type ParseResult } from '@babel/parser';
import type { File } from '@babel/types';

export interface ParsedTsx {
  ast: ParseResult<File>;
  source: string;
  filename: string;
}

export function parseTsx(source: string, filename: string): ParsedTsx {
  const ast = parse(source, {
    sourceFilename: filename,
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
    errorRecovery: false,
  });
  return { ast, source, filename };
}

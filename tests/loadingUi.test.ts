import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : /\.(tsx|css)$/.test(file) ? [file] : [];
  });
}

test('the UI has no loading text, skeletons, spinners or entrance fades', () => {
  const violations: string[] = [];
  for (const file of sourceFiles('src')) {
    const source = fs.readFileSync(file, 'utf8');
    if (/\banimate-(?:spin|pulse|ping)\b|\bfade-in\b|<Loader\d?\b|\bwsFadeUp\b/.test(source)) violations.push(file + ': animated indicator');
    if (/(?:>|['"`])\s*(?:Loading|Fetching|Please wait)\b/.test(source)) violations.push(file + ': loading message');
    if (/initial=\{\{\s*opacity:\s*0\b/.test(source)) violations.push(file + ': entrance fade');
  }
  assert.deepEqual(violations, []);
});

test('removing indicators preserves cascade fields and protects public forms before data arrives', () => {
  const geo = fs.readFileSync('src/components/MemberProfileGeoFields.tsx', 'utf8');
  assert.match(geo, /name="stateCode"/);
  assert.match(geo, /name="cityName"/);
  assert.match(geo, /disabled=\{!value.countryCode \|\| loadingStates\}/);
  assert.match(fs.readFileSync('src/components/PublicFormView.tsx', 'utf8'), /loading \? null : error \|\| !formMeta/);
});

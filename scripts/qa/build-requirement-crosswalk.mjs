import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const auditDir = path.join(root, 'docs/audits/ticketlelo-requirements-audit');
const oldText = fs.readFileSync(path.join(auditDir, '02_REQUIREMENT_TRACEABILITY_MATRIX.md'), 'utf8');
const current = JSON.parse(fs.readFileSync(path.join(root, 'docs/qa/2026-10-25/requirements.json'), 'utf8'));
const old = [];
for (const line of oldText.split(/\r?\n/)) {
  const match = line.match(/^\|\s+\*\*([A-Z][A-Z0-9]+-\d+)\*\*\s*\|/);
  if (!match) continue;
  const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
  old.push({ id: match[1], description: cells[2] || '' });
}
const tokenize = (s) => new Set(String(s).toLowerCase().match(/[a-z0-9₹]+/g)?.filter((x) => x.length > 2) || []);
const scored = old.map((item) => {
  const left = tokenize(item.description);
  const candidates = current.map((row) => {
    const right = tokenize(`${row.id} ${row.feature} ${row.expected}`);
    const overlap = [...left].filter((word) => right.has(word)).length;
    const score = left.size && right.size ? overlap / Math.min(left.size, right.size) : 0;
    return { id: row.id, score };
  }).sort((a, b) => b.score - a.score).slice(0, 3);
  return { ...item, candidates };
});
const escape = (s) => `"${String(s ?? '').replaceAll('"', '""')}"`;
const lines = [
  ['Older matrix ID', 'Older matrix requirement', 'Current 255 inventory candidate IDs (similarity only)', 'Mapping status', 'Review note'].map(escape).join(','),
  ...scored.map((row) => [
    row.id,
    row.description,
    row.candidates.map((x) => `${x.id} (${x.score.toFixed(2)})`).join('; '),
    'UNMAPPED — human review required',
    'Candidate text similarity is not equivalence; neither requirement has been deleted or merged.',
  ].map(escape).join(',')),
];
fs.writeFileSync(path.join(auditDir, 'CODEX_INVENTORY_CROSSWALK.csv'), `${lines.join('\n')}\n`);
console.log(JSON.stringify({ olderMatrixRows: old.length, olderUniqueIds: new Set(old.map((x) => x.id)).size, currentRows: current.length, output: 'CODEX_INVENTORY_CROSSWALK.csv' }, null, 2));

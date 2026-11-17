// Writes prompts/*.md from prompts/prompts.json (the single source the wizard also reads).
// Usage: node scripts/gen_prompts.mjs   (--check exits 1 if any file is out of date)
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { prompts } = JSON.parse(readFileSync(join(root, 'prompts/prompts.json'), 'utf8'))
const check = process.argv.includes('--check')
let stale = 0

for (const p of prompts) {
  const body = p.text.replace(
    '{{ANSWERS}}',
    '```yaml\n# The setup wizard (setup.html) pastes your answers here.\n```',
  )
  const md = `# ${p.title}\n\n*When:* ${p.when}\n\nCopy everything in the box below into Claude.\n\n\`\`\`\`text\n${body}\n\`\`\`\`\n`
  const file = join(root, 'prompts', p.file)
  const current = existsSync(file) ? readFileSync(file, 'utf8') : ''
  if (current === md) continue
  stale++
  if (!check) writeFileSync(file, md)
}

if (check && stale) {
  console.error(`${stale} prompt file(s) out of date. Run: node scripts/gen_prompts.mjs`)
  process.exit(1)
}
console.log(check ? 'prompts up to date' : `wrote ${stale} prompt file(s)`)

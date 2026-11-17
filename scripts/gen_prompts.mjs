// Writes prompts/*.md and .claude/commands/*.md from prompts/prompts.json, the single
// source the setup page also reads. Usage: node scripts/gen_prompts.mjs  (--check: exit 1 if stale)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const { prompts } = JSON.parse(readFileSync(join(root, 'prompts/prompts.json'), 'utf8'))
const check = process.argv.includes('--check')
let stale = 0

function put(file, body) {
  const current = existsSync(file) ? readFileSync(file, 'utf8') : ''
  if (current === body) return
  stale++
  if (!check) {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, body)
  }
}

for (const p of prompts) {
  const forHuman = p.text.replace('{{ANSWERS}}', '```yaml\n# The setup page (setup.html) pastes your answers here.\n```')
  put(join(root, 'prompts', p.file), `# ${p.title}\n\n*When:* ${p.when}\n\nCopy everything in the box below into Claude.\n\n\`\`\`\`text\n${forHuman}\n\`\`\`\`\n`)

  // Claude Code slash command: /<id>. Placeholders like <my question> become $ARGUMENTS.
  const forCommand = p.text
    .replace('{{ANSWERS}}', 'My setup page answers (if any): $ARGUMENTS\nIf there are none, follow "Setup without the wizard" in CLAUDE.md.')
    .replace(/<(my question|what I see|the app I use)>/, '$ARGUMENTS')
  put(join(root, '.claude/commands', `${p.id}.md`), `---\ndescription: ${p.title}. ${p.when.replace(/\n/g, ' ')}\n---\n\n${forCommand}\n`)
}

if (check && stale) {
  console.error(`${stale} generated prompt file(s) out of date. Run: node scripts/gen_prompts.mjs`)
  process.exit(1)
}
console.log(check ? 'prompts up to date' : `wrote ${stale} file(s)`)

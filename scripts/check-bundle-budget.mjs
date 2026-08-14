import { gzipSync } from 'node:zlib'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const assetsDirectory = fileURLToPath(new URL('../dist/assets/', import.meta.url))
const files = await readdir(assetsDirectory)
const javascriptFiles = files.filter((file) => file.endsWith('.js') && !file.includes('.worker-'))

const budgets = [
  { label: 'application shell', pattern: /^index-.*\.js$/, gzipLimitKb: 65 },
  { label: 'vendor runtime', pattern: /^vendor-.*\.js$/, gzipLimitKb: 125 },
  { label: 'landing route', pattern: /^landing-page-.*\.js$/, gzipLimitKb: 20 },
  { label: 'planner route', pattern: /^planner-workspace-.*\.js$/, gzipLimitKb: 18 },
  { label: 'largest lazy dataset', pattern: /^pal-details-data-.*\.js$/, gzipLimitKb: 55 },
]

const failures = []

for (const budget of budgets) {
  const file = javascriptFiles.find((candidate) => budget.pattern.test(candidate))
  if (!file) {
    failures.push(`${budget.label}: expected chunk was not generated`)
    continue
  }

  const contents = await readFile(join(assetsDirectory, file))
  const gzipKb = gzipSync(contents).byteLength / 1024
  const status = gzipKb <= budget.gzipLimitKb ? 'PASS' : 'FAIL'
  console.log(`${status} ${budget.label}: ${gzipKb.toFixed(2)} kB gzip / ${budget.gzipLimitKb} kB budget`)

  if (status === 'FAIL') {
    failures.push(`${budget.label}: ${gzipKb.toFixed(2)} kB exceeds ${budget.gzipLimitKb} kB`)
  }
}

if (failures.length > 0) {
  console.error('\nBundle budget exceeded:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exitCode = 1
}

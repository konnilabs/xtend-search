import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {PINNED} from '../server/control/adapter.mjs';

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const canonicalName = name => name.toLowerCase().replace(/[-_.]+/g, '-');

function requirements(text, file, problems) {
  const pins = new Map();
  for (const line of text.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'))) {
    const match = /^([\w.-]+)(?:\[[\w,.-]+\])?==([^\s;]+)$/.exec(line);
    if (!match) { problems.push(`${file}: requirement is not an exact supported pin: ${line}`); continue; }
    const name = canonicalName(match[1]);
    if (pins.has(name) && pins.get(name) !== match[2]) problems.push(`${file}: conflicting pins for ${name}`);
    pins.set(name, match[2]);
  }
  return pins;
}

// This gate checks an explicitly reviewed source snapshot. A checksum proves
// drift, not compatibility; update the review and Docker gate before repinning.
export async function checkSearxng({root = repositoryRoot, read = file => fs.readFile(path.join(root, file))} = {}) {
  const problems = [];
  const pin = JSON.parse(await read('xtend/upstream-searxng.json'));
  if (pin.schema !== 'xtend.search.searxng-pin.v1' || !/^[a-f0-9]{40}$/.test(pin.commit)) problems.push('Invalid upstream pin');
  if (!pin.version.endsWith('+' + pin.commit.slice(0, 9)) || pin.version !== PINNED) problems.push('Adapter and upstream identity differ');
  if (pin.backendContract !== 'engine-json-v1') problems.push('Backend contract requires adapter review');
  for (const file of ['Dockerfile.searxng', 'Dockerfile.xtend']) {
    const source = String(await read(file));
    if (!source.includes(`VERSION_STRING = \\\"${pin.version}+`) || !source.includes(`VERSION_TAG = \\\"${pin.version}\\\"`)) problems.push(`${file}: frozen identity differs from reviewed pin`);
  }
  const locked = requirements(String(await read('xtend/requirements.lock.txt')), 'xtend/requirements.lock.txt', problems);
  for (const file of ['requirements.txt', 'requirements-server.txt']) {
    for (const [name, version] of requirements(String(await read(file)), file, problems)) {
      if (locked.get(name) !== version) problems.push(`${file}: ${name}==${version} differs from installed lock ${locked.get(name) ?? '(missing)'}`);
    }
  }
  const required = ['searx/webapp.py', 'searx/webadapter.py', 'searx/webutils.py', 'searx/results.py',
    'searx/search/__init__.py', 'searx/result_types/_base.py', 'searx/xtend_stream.py',
    'searx/xtend_integration.py', 'xtend/server/backend.py', 'xtend/server/favicon_backend.py'];
  if (required.some(file => !(file in pin.reviewedIntegratedFiles))) problems.push('Reviewed boundary file set is incomplete');
  for (const [file, expected] of Object.entries(pin.reviewedIntegratedFiles)) {
    const actual = createHash('sha256').update(await read(file)).digest('hex');
    if (actual !== expected) problems.push(`${file}: reviewed source drift; recheck parser, serializer, streaming and backend contracts`);
  }
  return {ok: problems.length === 0, pin: pin.commit, problems};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await checkSearxng();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

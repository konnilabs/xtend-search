import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {checkSearxng, repositoryRoot} from '../../scripts/check-searxng.mjs';

test('reviewed SearXNG core, both Docker identities and installed Python pins agree', async () => {
  assert.deepEqual((await checkSearxng()).problems, []);
});

test('unreviewed core, Python lock and Docker version changes fail the dependency gate', async () => {
  const pin = JSON.parse(await fs.readFile(path.join(repositoryRoot, 'xtend/upstream-searxng.json')));
  const read = async file => {
    const data = await fs.readFile(path.join(repositoryRoot, file));
    if (file === 'searx/results.py') return Buffer.concat([data, Buffer.from('\n# unreviewed change\n')]);
    if (file === 'xtend/requirements.lock.txt') return String(data).replace(/^msgspec==.+$/m, 'msgspec==9999.0');
    if (file === 'Dockerfile.searxng') return String(data).replaceAll(pin.version, '2099.1.1+unreviewed');
    return data;
  };
  const result = await checkSearxng({read});
  assert.equal(result.ok, false);
  assert.ok(result.problems.some(p => p.includes('searx/results.py')));
  assert.ok(result.problems.some(p => p.includes('msgspec')));
  assert.ok(result.problems.some(p => p.includes('Dockerfile.searxng')));
});

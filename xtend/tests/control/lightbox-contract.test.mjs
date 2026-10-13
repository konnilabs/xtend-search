import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
test('project lightbox requires review when its pinned framework base changes',async()=>{
 const fork=await fs.readFile(new URL('../../frontend/components/x-search-lightbox.mjs',import.meta.url),'utf8');
 const base=await fs.readFile(new URL('../../node_modules/@ccslabs/xtend/components/xlightbox.js',import.meta.url));
 const declared=/SDK source SHA-256: ([a-f0-9]{64})/.exec(fork)?.[1];
 assert.equal(declared,createHash('sha256').update(base).digest('hex'),'Rebase/review XSearchLightbox when upgrading this SDK component; do not rewrite the upstream module silently.');
});

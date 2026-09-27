import test from 'node:test';
import assert from 'node:assert/strict';
import {preferenceSearchUrl,readPreferences,validatePreferences,preferenceCookie,withPreferences} from '../../server/preferences.mjs';
import {parseSearch} from '../../server/search.mjs';
const values={language:'de',time_range:'week',safesearch:'2'};
test('SSR defaults store only validated filters in an expiring host-only cookie',()=>{
 const cookie=preferenceCookie({...values,q:'private query',engines:'unreviewed'},true);
 assert.deepEqual(readPreferences('session=unrelated; '+cookie),values);
 assert.match(cookie,/Max-Age=15552000; HttpOnly; SameSite=Lax; Secure/);
 assert.ok(!cookie.includes('private')&&!cookie.includes('Domain='));
 const state=parseSearch(withPreferences(new URL('https://search.example/?q=hello'),cookie));
 assert.equal(state.language,'de');assert.equal(state.timeRange,'week');assert.equal(state.safeSearch,'2');assert.equal(state.q,'hello');
});
test('explicit URL filters, including empty time range and SafeSearch off, override saved defaults',()=>{
 const cookie=preferenceCookie(values);
 const state=parseSearch(withPreferences(new URL('http://localhost/search?q=test&time_range=&safesearch=0'),cookie));
 assert.equal(state.language,'de');assert.equal(state.timeRange,'');assert.equal(state.safeSearch,'0');
 assert.throws(()=>parseSearch(withPreferences(new URL('http://localhost/?safesearch=invalid'),cookie)));
});
test('invalid, unknown-version, oversized and deleted cookies fall back without breaking search',()=>{
 for(const raw of ['%zz','{}','null',encodeURIComponent(JSON.stringify({v:2,...values})),encodeURIComponent(JSON.stringify({v:1,...values,language:'xx'})),'x'.repeat(513)])assert.equal(readPreferences('xtend_search_filters='+raw),null);
 assert.equal(readPreferences(preferenceCookie(null)),null);assert.match(preferenceCookie(null),/Max-Age=0/);
 assert.equal(parseSearch(withPreferences(new URL('http://localhost/'),'')).safeSearch,'1');
 for(const key of Object.keys(values))assert.throws(()=>validatePreferences({...values,[key]:'not-valid'}));
});

test('home category links preserve explicitly cleared filters against saved preferences',()=>{
 const cookie=preferenceCookie(values),state={q:'',category:'general',language:'all',timeRange:'',safeSearch:'1',page:1,continuation:''};
 const next=preferenceSearchUrl(state,{category:'images'});
 assert.deepEqual(parseSearch(withPreferences(new URL(next,'http://localhost'),cookie)),{...state,category:'images'});
});

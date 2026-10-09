import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryDraftUrl} from '../../frontend/filter-navigation.mjs';
test('mode navigation uses current filters and query, clears stale continuation and preserves explicit empty defaults',()=>{
 const values=new URLSearchParams({q:'GNU / Linux',language:'en',time_range:'',safesearch:'0'});
 const result=new URL(categoryDraftUrl('/search?q=old&categories=images&language=de&pageno=2&cursor=old',values,'https://search.example'),'https://search.example');
 assert.equal(result.pathname,'/search');assert.equal(result.searchParams.get('categories'),'images');
 for(const [key,value]of values)assert.equal(result.searchParams.get(key),value);
 assert.equal(result.searchParams.has('cursor'),false);assert.equal(result.searchParams.has('pageno'),false);
 values.set('q','');assert.equal(new URL(categoryDraftUrl(result.href,values,result.origin),result.origin).pathname,'/');
 assert.throws(()=>categoryDraftUrl('https://foreign.example/',values,result.origin));
});

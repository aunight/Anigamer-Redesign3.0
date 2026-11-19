import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';
test('extension enrichment deduplicates, serializes and stops queued requests after 429',async()=>{
 const dom=new JSDOM('',{url:'https://ani.gamer.com.tw/',runScripts:'outside-only'}),w=dom.window;
 let calls=0,active=0,max=0;
 w.fetch=async(input,init)=>{if(input==='/limited')assert.equal(init.signal.aborted,false);calls++;active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,5));active--;return {status:calls===2?429:200};};
 const source=fs.readFileSync('src/content.js','utf8');w.eval(source.slice(0,source.indexOf('  // ── 一、'))+'})();');
 const first=w.AniAmbientFetch('/a'),duplicate=w.AniAmbientFetch('/a');await Promise.all([first,duplicate]);assert.equal(calls,1);
 const results=await Promise.allSettled([w.AniAmbientFetch('/limited',{timeoutMs:100}),w.AniAmbientFetch('/queued')]);assert.equal(results[0].value.status,429);assert.equal(results[1].status,'rejected');assert.equal(calls,2);assert.equal(max,1);assert(Number(w.sessionStorage.getItem('aniRequestCooldown'))>Date.now());w.close();
});

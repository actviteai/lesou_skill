import test from 'node:test';
import assert from 'node:assert/strict';
import {generateSecretKey,getPublicKey,coordinationEvent,waitlistEvent,verifyEvent,validateRegistry,validateChallenge} from '../src/index.mjs';
test('signed coordination and waiting-list events',()=>{const key=generateSecretKey();const e=coordinationEvent(key,'NEED',{task:'review'});assert.ok(verifyEvent(e));assert.equal(e.kind,9);assert.equal(JSON.parse(e.content).type,'NEED');assert.ok(waitlistEvent(key,{network_modes:['ipv4-nat'],contact:'public contact'}).tags.some(t=>t[1]==='lesou-masternode-waitlist'));assert.throws(()=>coordinationEvent(key,'SHELL',{}));});
test('canonical registry rejects deployed placeholders',()=>{const r={protocol:'lesou',version:1,assets:['base','tron','sui'].map(chain=>({chain,network:'mainnet',chain_id:'network',status:'undeployed',identifier:'',link:''}))};assert.throws(()=>validateRegistry(r));assert.equal(validateRegistry(r,{allowLegacy:true}),r);r.assets[0].status='deployed';assert.throws(()=>validateRegistry(r));});
test('wallet challenge refuses another relay, chain and expired nonce',()=>{const pubkey=getPublicKey(generateSecretKey());const wallet={chain:'base',network:'mainnet',address:'0x'+'1'.repeat(40)};const registry={assets:[{chain:'base',network:'mainnet',chain_id:'8453'}]};const relay='wss://relay.lesou.org';const now=Math.floor(Date.now()/1000);const c={protocol:'lesou/1',purpose:'lesou-membership',npub:pubkey,...wallet,chain_id:'8453',origin:relay,nonce:'a'.repeat(64),issued_at:now,expires_at:now+180};const check=x=>validateChallenge({message:JSON.stringify(x)},{pubkey,wallet,relay,registry});assert.equal(check(c).nonce,c.nonce);assert.throws(()=>check({...c,origin:'wss://evil.example'}));assert.throws(()=>check({...c,chain:'tron'}));assert.throws(()=>check({...c,expires_at:now-1}));});
test('Base-first domains and collateral hint are bound; extra signable fields fail',()=>{
 const asset=(chain,chain_id)=>({chain,chain_id,network:'local',status:'deployed',identifier:'0x'+'1'.repeat(40),genesis_block:'0x'+'2'.repeat(64),code_hash:'0x'+'3'.repeat(64)});
 const registry={protocol:'lesou',version:2,assets:[asset('base','31337'),asset('lesou','31338')]};assert.equal(validateRegistry(registry),registry);
 assert.throws(()=>validateRegistry({...registry,assets:[registry.assets[0],{...registry.assets[1],chain_id:'31337'}]}));
 const wallet={chain:'base',network:'local',address:'0x'+'4'.repeat(40),bond:'a'.repeat(64)},pubkey=getPublicKey(generateSecretKey()),relay='wss://relay.example.test',now=Math.floor(Date.now()/1000);
 const c={protocol:'lesou/1',purpose:'lesou-membership',npub:pubkey,...wallet,chain_id:'31337',origin:relay,nonce:'b'.repeat(64),issued_at:now,expires_at:now+100};
 const check=x=>validateChallenge({message:JSON.stringify(x)},{pubkey,wallet,relay,registry});assert.equal(check(c).bond,wallet.bond);
 assert.throws(()=>check({...c,bond:'c'.repeat(64)}));assert.throws(()=>check({...c,transaction:'unrelated action'}));
});

import {finalizeEvent,generateSecretKey,getPublicKey,verifyEvent} from 'nostr-tools/pure';
export {generateSecretKey,getPublicKey,verifyEvent};
export const TYPES=Object.freeze(['COORD','COMMIT','WITHDRAW','NEED','CAP','CAP_REQ','BID','ASK','SWAP','ARB','EXEC','RESULT','REV','COST']);
export const DEFAULT_RELAY='wss://relay.lesou.org';
export function secretBytes(value){if(value instanceof Uint8Array&&value.length===32)return value;if(typeof value!=='string'||!/^[a-f0-9]{64}$/i.test(value))throw Error('A 32-byte hexadecimal Nostr key is required');return Uint8Array.from(value.match(/../g),x=>parseInt(x,16))}
export function signEvent(key,event){return finalizeEvent({created_at:Math.floor(Date.now()/1000),content:'',tags:[],...event},secretBytes(key))}
export function coordinationEvent(key,type,body,extraTags=[]){if(!TYPES.includes(type)||body===undefined)throw Error('Invalid coordination type/body');return signEvent(key,{kind:9,tags:[['h','lesou'],['t','lep'],...extraTags],content:JSON.stringify({version:1,type,body})})}
export function waitlistEvent(key,{network_modes,contact}){if(!Array.isArray(network_modes)||!network_modes.length||network_modes.some(x=>!['ipv4','ipv6','ipv4-nat'].includes(x))||typeof contact!=='string'||!contact.trim())throw Error('Public contact and supported network modes required');return coordinationEvent(key,'CAP_REQ',{service:'masternode-waitlist',network_modes,contact},[['t','lesou-masternode-waitlist']])}
export function validateRegistry(registry,{allowLegacy=false}={}){
 if(registry?.protocol!=='lesou'||!Array.isArray(registry.assets))throw Error('Invalid LeSou registry');
 if(registry.version===1 && allowLegacy){
  if(registry.assets.length!==3)throw Error('Invalid legacy registry');
  const seen=new Set();for(const a of registry.assets){if(!['base','tron','sui'].includes(a.chain)||seen.has(a.chain)||!a.network||!a.chain_id||!['deployed','undeployed'].includes(a.status))throw Error('Invalid legacy domain');seen.add(a.chain);if(a.status==='deployed'&&(!a.identifier||!a.link))throw Error('Legacy deployed identifiers required');}return registry;
 }
 if(registry.version!==2||registry.assets.length!==2)throw Error('Base-first registry v2 required; legacy use must be explicit');
 const seen=new Map(),hex=(s,n)=>typeof s==='string'&&new RegExp('^0x[0-9a-f]{'+n+'}$','i').test(s)&&!/^0x0+$/.test(s);
 for(const a of registry.assets){
  if(!['base','lesou'].includes(a.chain)||seen.has(a.chain)||!['local','testnet','mainnet'].includes(a.network)||!['deployed','undeployed'].includes(a.status))throw Error('Invalid Base-first domain');
  seen.set(a.chain,a);
  if(a.status==='deployed'&&(!/^[1-9][0-9]*$/.test(a.chain_id)||!hex(a.identifier,40)||!hex(a.genesis_block,64)||!hex(a.code_hash,64)))throw Error('Verified deployment identity required');
  if(a.status==='undeployed'&&(a.identifier||a.code_hash))throw Error('Undeployed asset advertises a contract');
  if(a.chain==='base'&&a.status==='deployed'&&((a.network==='mainnet'&&a.chain_id!=='8453')||(a.network==='testnet'&&a.chain_id!=='84532')))throw Error('Wrong Base chain');
  if(a.chain==='lesou'&&a.status==='deployed'&&a.network!=='local'&&!['safe','finalized'].includes(a.balance_block))throw Error('Verified L3 settlement policy required');
 }
 const base=seen.get('base'),l3=seen.get('lesou');
 if(base.network!==l3.network||(base.chain_id&&base.chain_id===l3.chain_id))throw Error('Distinct parent/child domains required');
 for(const [key,parent] of [['launch_registry',l3],['collateral_registry',base]]){
  const a=registry[key];if(a&&(a.status!=='deployed'||parent.status!=='deployed'||a.chain!==parent.chain||a.chain_id!==parent.chain_id||a.network!==parent.network||a.genesis_block!==parent.genesis_block||!hex(a.identifier,40)||!hex(a.code_hash,64)))throw Error('Unverified registry domain');
 }
 return registry;
}
export function normalizeWallet(w){
 if(!w||typeof w.address!=='string')throw Error('Wallet address required');
 const address=['base','lesou'].includes(w.chain)?w.address.toLowerCase():w.chain==='sui'?'0x'+w.address.replace(/^0x/,'').padStart(64,'0').toLowerCase():w.address;
 const out={chain:w.chain,network:w.network,address};
 if(w.token){if(w.chain!=='lesou'||!/^0x[0-9a-f]{40}$/i.test(w.token))throw Error('LeSou token hint required');out.token=w.token.toLowerCase();}
 if(w.bond){if(w.chain!=='base'||!/^[0-9a-f]{64}$/.test(w.bond))throw Error('Base bond hint must be 64 lowercase hex bytes without prefix');out.bond=w.bond;}
 return out;
}
export function validateChallenge(response,{pubkey,wallet,relay,registry}){
 const c=JSON.parse(response.message), now=Math.floor(Date.now()/1000),w=normalizeWallet(wallet);
 const asset=registry.assets.find(a=>a.chain===w.chain&&a.network===w.network);
 const expected={protocol:'lesou/1',purpose:'lesou-membership',npub:pubkey,...w,chain_id:asset?.chain_id,origin:relay};
 const keys=[...Object.keys(expected),'nonce','issued_at','expires_at'].sort();
 if(!asset||(registry.version===2&&asset.status!=='deployed')||Object.keys(c).sort().join()!==keys.join()||Object.entries(expected).some(([k,v])=>c[k]!==v)||!/^[0-9a-f]{64}$/.test(c.nonce)||!Number.isSafeInteger(c.issued_at)||!Number.isSafeInteger(c.expires_at)||c.issued_at>now+30||c.issued_at<now-300||c.expires_at<=now||c.expires_at>now+600||c.expires_at<=c.issued_at)throw Error('Challenge binding or expiry mismatch');
 return c;
}
const httpOrigin=(relay,local=false)=>{const u=new URL(relay);if((u.protocol!=='wss:'&&!(local&&u.protocol==='ws:'))||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw Error('A bare wss relay origin is required');return (u.protocol==='wss:'?'https://':'http://')+u.host};
async function request(url,body){
 const r=await fetch(url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(15000)});
 const chunks=[];let size=0;for await(const chunk of r.body){size+=chunk.length;if(size>65536)throw Error('Relay response too large');chunks.push(chunk);}if(!r.ok)throw Error(`Relay HTTP ${r.status}`);return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function connect(relay=DEFAULT_RELAY,{allowLocalTesting=false}={}){
 httpOrigin(relay,allowLocalTesting);
 const ws=new WebSocket(relay);const queue=[];const waiting=[];let closed=false;
 function rejectAll(){closed=true;for(const w of waiting.splice(0)){clearTimeout(w.timer);w.reject(Error('Relay connection closed'))}}
 ws.addEventListener('close',rejectAll);ws.addEventListener('error',rejectAll);
 ws.addEventListener('message',event=>{try{if(typeof event.data!=='string'||Buffer.byteLength(event.data)>65536){ws.close();return;}const frame=JSON.parse(event.data);if(!Array.isArray(frame))return;const i=waiting.findIndex(w=>w.match(frame));if(i>=0){const w=waiting.splice(i,1)[0];clearTimeout(w.timer);w.resolve(frame)}else{if(queue.length>=1000){ws.close();return}queue.push(frame)}}catch{ws.close()}});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.close();reject(Error('Connection timed out'))},15000);ws.addEventListener('open',()=>{clearTimeout(timer);resolve()},{once:true});ws.addEventListener('error',()=>{clearTimeout(timer);reject(Error('Connection failed'))},{once:true})});
 function wait(match){const i=queue.findIndex(match);if(i>=0)return Promise.resolve(queue.splice(i,1)[0]);if(closed)return Promise.reject(Error('Connection closed'));return new Promise((resolve,reject)=>{const item={match,resolve,reject};item.timer=setTimeout(()=>{const index=waiting.indexOf(item);if(index>=0)waiting.splice(index,1);reject(Error('Relay response timed out'))},15000);waiting.push(item)})}
 const send=frame=>ws.send(JSON.stringify(frame));
 const ack=async event=>{const frame=await wait(f=>f[0]==='OK'&&f[1]===event.id);if(frame[2]!==true)throw Error(frame[3]??'Relay rejected event');return event.id};
 return {
  async authenticate(key){const challenge=await wait(f=>f[0]==='AUTH'&&typeof f[1]==='string');const event=signEvent(key,{kind:22242,tags:[['relay',relay],['challenge',challenge[1]]]});send(['AUTH',event]);await ack(event);},
  async publish(event){if(!verifyEvent(event))throw Error('Invalid event signature');send(['EVENT',event]);return ack(event)},
  async read(filter={kinds:[9],'#h':['lesou'],limit:50}){const id='read-'+crypto.randomUUID();send(['REQ',id,filter]);const events=[];try{while(true){const f=await wait(f=>['EVENT','EOSE','CLOSED'].includes(f[0])&&f[1]===id);if(f[0]==='EOSE')return events;if(f[0]==='CLOSED')throw Error(f[2]);if(!verifyEvent(f[2]))throw Error('Invalid retrieved event signature');if(events.length>=500)throw Error('History bound exceeded');events.push(f[2])}}finally{send(['CLOSE',id])}},
  close(){ws.close();rejectAll()}
 };
}
export async function join({key,wallet,relay=DEFAULT_RELAY,allowLocalTesting=false,allowLegacy=false}){
 const origin=httpOrigin(relay,allowLocalTesting),pubkey=getPublicKey(secretBytes(key));const registry=validateRegistry(await request(origin+'/registry.json'),{allowLegacy});const w=normalizeWallet(wallet);
 if(wallet.network==='local'&&!allowLocalTesting)throw Error('Explicit local testing required');
 if(typeof wallet.signMessage!=='function')throw Error('Provide a local wallet signMessage callback');
 const response=await request(origin+'/membership/challenge',{npub:pubkey,...w});const challenge=validateChallenge(response,{pubkey,wallet:w,relay,registry});
 const signature=await wallet.signMessage(response.message);
 await request(origin+'/membership/proof',{nonce:challenge.nonce,wallet_signature:signature,nostr_event:signEvent(key,{kind:22243,content:challenge.nonce})});
 const connection=await connect(relay,{allowLocalTesting});try{await connection.authenticate(key);try{await connection.publish(signEvent(key,{kind:9021,tags:[['h','lesou']]}))}catch(e){if(!e.message.startsWith('duplicate:'))throw e}return connection}catch(e){connection.close();throw e}
}

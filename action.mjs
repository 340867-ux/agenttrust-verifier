import { appendFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const input=name=>process.env[`INPUT_${name.toUpperCase()}`]||"";
const DEFAULT_API="https://agenttrust-ledger.340867.workers.dev";
const RANK={info:0,low:1,medium:2,high:3,critical:4};
const HASH=/^[a-f0-9]{64}$/i;
const KINDS=new Set(["mcp","npm","pypi","github"]);
const clean=value=>String(value??"").trim().replace(/^['"]|['"]$/g,"");

async function output(name,value){
  if(process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT,`${name}=${value}\n`);
}

function parsePolicy(text){
  const policy={version:1,apiBase:"",failOn:"high",onMissingBaseline:"fail",components:[]};
  let current=null;
  for(const raw of text.split(/\r?\n/)){
    if(!raw.trim()||raw.trim().startsWith("#")||raw.trim()==="components:") continue;
    const item=raw.match(/^\s*-\s*kind:\s*(.+)$/);
    if(item){current={kind:clean(item[1]),id:"",trustedHash:""};policy.components.push(current);continue;}
    const field=raw.match(/^\s+(kind|id|trustedHash):\s*(.+)$/);
    if(current&&field){current[field[1]]=clean(field[2]);continue;}
    const top=raw.match(/^\s*(version|apiBase|failOn|onMissingBaseline):\s*(.+)$/);
    if(top) policy[top[1]]=clean(top[2]);
  }
  if(String(policy.version)!=="1") throw new Error("policy version must be 1");
  if(!(policy.failOn in RANK)) throw new Error("invalid failOn severity");
  if(!["fail","warn"].includes(policy.onMissingBaseline)) throw new Error("invalid onMissingBaseline");
  if(!policy.components.length) throw new Error("policy has no components");
  for(const c of policy.components) if(!KINDS.has(c.kind)||!c.id||!HASH.test(c.trustedHash)) throw new Error(`invalid policy component ${c.kind}:${c.id}`);
  return policy;
}
async function checkPolicyMode(policyFile){
  const path=resolve(process.env.GITHUB_WORKSPACE||process.cwd(),policyFile);
  const policy=parsePolicy(await readFile(path,"utf8"));
  const api=(input("api_url")||policy.apiBase||DEFAULT_API).replace(/\/$/,"");
  let failed=0;
  for(const component of policy.components){
    const url=new URL(`${api}/v1/compare`);
    url.searchParams.set("kind",component.kind); url.searchParams.set("id",component.id); url.searchParams.set("fromHash",component.trustedHash);
    const response=await fetch(url,{headers:{"user-agent":"agenttrust-github-action"}});
    let report={}; try{report=await response.json();}catch{}
    if(response.status===404){
      const isFail=policy.onMissingBaseline==="fail"; failed+=isFail?1:0;
      console[isFail?"error":"warn"](`${isFail?"FAIL":"WARN"} ${component.kind}:${component.id} trusted baseline unavailable`);
      continue;
    }
    if(!response.ok){failed++;console.error(`FAIL ${component.kind}:${component.id} HTTP ${response.status}: ${report?.error||"compare failed"}`);continue;}
    if(report.unchanged){console.log(`PASS ${component.kind}:${component.id} unchanged`);continue;}
    const max=report.maxSeverity||"info", isFail=RANK[max]>=RANK[policy.failOn];
    failed+=isFail?1:0;
    console[isFail?"error":"warn"](`${isFail?"FAIL":"WARN"} ${component.kind}:${component.id} drift severity=${max}`);
    for(const risk of report.risks||[]) console.log(`  ${String(risk.severity).toUpperCase()} ${risk.rule}: ${risk.message}`);
  }
  await output("policy_passed",failed?"false":"true");
  if(failed) process.exit(1);
  console.log(`AgentTrust policy passed: ${policy.components.length}/${policy.components.length}`);
}
async function checkLegacyMode(){
  const api=(input("api_url")||DEFAULT_API).replace(/\/$/,"");
  const kind=input("kind"),component=input("component"),expected=input("expected_hash").toLowerCase();
  if(!api||!KINDS.has(kind)||!component){console.error("policy_file or valid kind+component is required");process.exit(2);}
  const url=new URL(`${api}/v1/resolve`); url.searchParams.set("kind",kind); url.searchParams.set("id",component);
  const response=await fetch(url,{headers:{"user-agent":"agenttrust-github-action"}});
  if(!response.ok){console.error(`AgentTrust API returned ${response.status}: ${await response.text()}`);process.exit(1);}
  const report=await response.json(),current=String(report.hash||"").toLowerCase();
  if(!HASH.test(current)){console.error("AgentTrust API did not return a valid SHA-256 hash");process.exit(1);}
  await output("current_hash",current); console.log(`AgentTrust current hash: ${current}`);
  if(expected){
    if(!HASH.test(expected)){console.error("expected_hash must be SHA-256 hex");process.exit(2);}
    if(current!==expected){await output("policy_passed","false");console.error(`Material drift: trusted ${expected}, current ${current}`);process.exit(1);}
    console.log("No snapshot drift from the trusted hash.");
  }
  await output("policy_passed","true");
}

const policyFile=input("policy_file");
if(policyFile) await checkPolicyMode(policyFile); else await checkLegacyMode();

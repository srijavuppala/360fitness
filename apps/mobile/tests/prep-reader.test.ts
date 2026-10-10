import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createPrepReader } from "../src/services/prep-reader";
const connection={url:"https://example.test/analyse",headers:{Authorization:"test"}};
const input={description:"A bowl of oats",servings:4};
test("cancelled authentication never sends the recipe",async()=>{
  let sent=0;let release!:(value:typeof connection)=>void;
  const read=createPrepReader(()=>new Promise(resolve=>{release=resolve;}),(async()=>{sent++;return new Response();}) as typeof fetch);
  const controller=new AbortController();const request=read(input,controller.signal);controller.abort();
  await assert.rejects(request,/cancelled/);release(connection);await Promise.resolve();assert.equal(sent,0);
});
test("server errors are mapped without exposing arbitrary provider text",async()=>{
  const read=createPrepReader(async()=>connection,(async()=>new Response(JSON.stringify({error:{status:"RESOURCE_EXHAUSTED",message:"private"}}),{status:429})) as typeof fetch);
  await assert.rejects(read(input,new AbortController().signal),/AI usage limit/);
});

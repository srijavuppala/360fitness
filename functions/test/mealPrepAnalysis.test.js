import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMealPrep, buildPrepRequest, handlePrepRequest, validatePrepInput, validatePrepResult } from '../src/mealPrepAnalysis.js';
const input={description:'Oats and yogurt for four breakfasts',servings:4};
const result={name:'Oats and yogurt',note:'Estimated portions.',foods:[{name:'Rolled oats',quantity:40,unit:'g',nutrition:{kcal:150,protein:5,carbs:27,fat:3}}]};
test('recipe input bounds and shape enforced before provider requests',()=>{
  for(const raw of [null,{...input,description:'x'},{...input,servings:0},{...input,servings:21},{...input,servings:'4'},{...input,preferences:'x'.repeat(1201)}]) assert.throws(()=>validatePrepInput(raw));
  assert.equal(validatePrepInput({...input,description:'  oats with milk  '}).description,'oats with milk');
});
test('recipe schema and prompt keep quantities per serving and text as untrusted data',()=>{
  const request=buildPrepRequest({...input,preferences:'vegetarian'});
  assert.match(request.systemInstruction.parts[0].text,/ONE serving/);
  assert.match(request.systemInstruction.parts[0].text,/untrusted/);
  assert.equal(request.generationConfig.responseMimeType,'application/json');
  assert.equal(JSON.parse(request.contents[0].parts[0].text).servings,4);
});
test('malformed nutrition and empty recipes never reach review',()=>{
  assert.deepEqual(validatePrepResult(result),result);
  for(const raw of [{...result,foods:[]},{...result,foods:[{...result.foods[0],quantity:0}]},{...result,foods:[{...result.foods[0],nutrition:{kcal:-1}}]},{...result,note:'x'.repeat(1201)}]) assert.throws(()=>validatePrepResult(raw));
  assert.equal(validatePrepResult({...result,foods:[{...result.foods[0],nutrition:{kcal:null,protein:null,carbs:null,fat:null}}]}).foods[0].nutrition.kcal,null);
});
test('auth, app attestation and input validation happen before quota and analysis',async()=>{
  let charged=0;const deps={consumeQuota:async()=>{charged++;},analyze:async()=>result};
  await assert.rejects(handlePrepRequest({data:input},deps),{code:'unauthenticated'});
  await assert.rejects(handlePrepRequest({auth:{uid:'u'},data:input},deps),{code:'failed-precondition'});
  await assert.rejects(handlePrepRequest({auth:{uid:'u'},app:{},data:{}},deps),{code:'invalid-argument'});
  assert.equal(charged,0);assert.deepEqual(await handlePrepRequest({auth:{uid:'u'},app:{},data:input},deps),result);assert.equal(charged,1);
});
test('provider key stays in request headers and provider errors are sanitized',async()=>{
  const key='test-secret';let call;
  const output=await analyzeMealPrep(input,{apiKey:key,fetch:async(url,options)=>{call={url,options};return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(result)}]}}]})};}});
  assert.deepEqual(output,result);assert.ok(!call.url.includes(key));assert.ok(!call.options.body.includes(key));assert.equal(call.options.headers['x-goog-api-key'],key);
  await assert.rejects(analyzeMealPrep(input,{apiKey:key,fetch:async()=>({ok:false,status:403,json:async()=>({secret:key})})}),error=>!error.message.includes(key));
  await assert.rejects(analyzeMealPrep(input,{apiKey:key,fetch:async()=>({ok:true,json:async()=>({candidates:[{finishReason:'MAX_TOKENS'}]})})}),{code:'data-loss'});
});

test('local recipe bridge accepts the phone preview origin and rejects foreign origins',async t=>{
  const { createLabelDevServer }=await import('../src/labelDevServer.js');
  let calls=0;
  const server=createLabelDevServer({configured:()=>true,analyzePrep:async()=>{calls++;return result;}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url=`http://127.0.0.1:${server.address().port}/analyze-meal-prep`;
  const send=(origin,data=input)=>fetch(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Fitness-Label':'1'},body:JSON.stringify({data})});
  assert.equal((await send('https://foreign.example')).status,403);
  assert.equal((await send('http://127.0.0.1:8082',{})).status,400);
  const response=await send('http://127.0.0.1:8082');assert.equal(response.status,200);assert.deepEqual((await response.json()).result,result);assert.equal(calls,1);
});

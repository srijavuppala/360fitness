import { strict as assert } from "node:assert";
import { test } from "node:test";
import { initialState, sampleMeals } from "../src/domain/fixtures";
import { parseSavedState } from "../src/domain/meals";
import { emptyPrep, groceryList, logPrepPortion, makeBatch, moveWeek, parsePrepSuggestion, saveBatch, toggleGrocery, validatePrep, validPrepDate, weekDays } from "../src/domain/meal-prep";
import { parseCloudPrep } from "../src/services/cloud/prep-repository";

test("old local data loads without a meal prep plan",()=>{ const old=initialState();assert.deepEqual(parseSavedState(JSON.stringify(old)),old); });
test("weeks use local calendar dates across month, year and DST boundaries",()=>{
  assert.deepEqual(weekDays("2026-01-01"),["2025-12-29","2025-12-30","2025-12-31","2026-01-01","2026-01-02","2026-01-03","2026-01-04"]);
  assert.equal(moveWeek("2026-03-08",1),"2026-03-15");
  assert.equal(validPrepDate("2026-02-30"),false);assert.equal(validPrepDate("2028-02-29"),true);
});
test("saving and preparing batches never logs food; explicit portion logging is idempotent",()=>{
  const batch=makeBatch(sampleMeals[0],"2026-10-08",4);
  let state=saveBatch(initialState(),batch);state=saveBatch(state,{...batch,prepared:true});
  assert.equal(state.mealPrep!.batches.length,1);assert.equal(state.entries.length,0);
  assert.deepEqual(parseSavedState(JSON.stringify(state)),state);
  const logged=logPrepPortion(logPrepPortion(state,batch,"2026-10-08"),batch,"2026-10-08");
  assert.equal(logged.entries.length,1);assert.equal(logged.entries[0].foods[0].quantity,40);
  assert.equal(logged.entries[0].foods[0].nutrition.kcal,150);
  assert.equal(state.templates[0].foods[0].quantity,40);
});
test("groceries aggregate servings by exact ingredient and unit, without raw/cooked conversion",()=>{
  const first=makeBatch(sampleMeals[0],"2026-10-08",4);
  const second=makeBatch(sampleMeals[0],"2026-10-09",2);
  const outside=makeBatch(sampleMeals[0],"2026-10-20",10);
  const prep={...emptyPrep(),batches:[first,second,outside]};
  assert.equal(groceryList(prep,"2026-10-08").find(i=>i.name==="Rolled oats")!.quantity,240);
  second.meal.foods[0].unit="cup";
  assert.equal(groceryList(prep,"2026-10-08").filter(i=>i.name==="Rolled oats").length,2);
});
test("changing batch servings invalidates purchased checks",()=>{
  const batch=makeBatch(sampleMeals[0],"2026-10-08",2);let state=saveBatch(initialState(),batch);
  const key=groceryList(state.mealPrep!,batch.date)[0].key;
  state=toggleGrocery(state,key);assert.equal(state.mealPrep!.checked.length,1);
  state=saveBatch(state,{...batch,servings:4});assert.deepEqual(state.mealPrep!.checked,[]);
});
test("invalid or oversized persisted batches are rejected",()=>{
  const batch=makeBatch(sampleMeals[0],"2026-10-08",1);
  for(const servings of [0,-1,1.5,21,NaN]) assert.throws(()=>validatePrep({...emptyPrep(),batches:[{...batch,servings}]}));
  assert.throws(()=>validatePrep({...emptyPrep(),batches:[batch,batch]}));
  assert.throws(()=>validatePrep({...emptyPrep(),batches:[{...batch,date:"2026-02-31"}]}));
  assert.throws(()=>parseSavedState(JSON.stringify({...initialState(),mealPrep:{version:2,batches:[],checked:[]}})));
});
test("AI review rejects missing nutrition and preserves unknown values",()=>{
  const raw={name:"Example",note:"Estimate",foods:[{name:"Oats",quantity:40,unit:"g",nutrition:{kcal:null,protein:null,carbs:null,fat:null}}]};
  const suggestion=parsePrepSuggestion(raw);assert.equal(suggestion.meal.foods[0].nutrition.kcal,null);assert.equal(suggestion.meal.foods[0].source,"ai");
  assert.throws(()=>parsePrepSuggestion({...raw,foods:[{...raw.foods[0],quantity:0}]}));
  assert.throws(()=>parsePrepSuggestion({...raw,foods:[]}));
});
test("cloud backups validate their payload before local restore",()=>{
  const raw={schemaVersion:1,revision:1,generation:"a".repeat(20),payload:JSON.stringify(emptyPrep())};
  assert.deepEqual(parseCloudPrep(raw).plan,emptyPrep());
  for(const payload of ["not JSON","{}",JSON.stringify({version:1,batches:[{}],checked:[]})]) assert.throws(()=>parseCloudPrep({...raw,payload}));
});

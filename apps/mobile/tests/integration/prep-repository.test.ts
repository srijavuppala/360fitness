import { strict as assert } from "node:assert";
import { after, test } from "node:test";
import { initializeApp, deleteApp } from "firebase/app";
import { connectFirestoreEmulator, getDoc, doc, getFirestore, terminate } from "firebase/firestore";
import { prepRepository } from "../../src/services/cloud/prep-repository";
import { emptyPrep, makeBatch } from "../../src/domain/meal-prep";
import { sampleMeals } from "../../src/domain/fixtures";
const uid=`prep-repo-${Date.now()}`;
const apps=[1,2,3].map(n=>initializeApp({projectId:"demo-nourish"},`prep-device-${n}`));
const clients=apps.map((app,index)=>{const db=getFirestore(app);connectFirestoreEmulator(db,"127.0.0.1",8080,{mockUserToken:{sub:index===2?"outsider":uid,email_verified:true}});return db;});
after(async()=>{await Promise.all(clients.map(terminate));await Promise.all(apps.map(deleteApp));});
test("two devices see prep updates and reject stale or foreign writes",{timeout:20000},async()=>{
  const first=prepRepository(clients[0],uid),second=prepRepository(clients[1],uid);
  const plan={...emptyPrep(),batches:[makeBatch(sampleMeals[0],"2026-10-08",4)]};
  await first.save(plan,0,null);
  const generation=(await getDoc(doc(clients[0],"mobileMealPrep",uid))).data()!.generation;
  const received=new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>{stop();reject(new Error("No live prep update"));},8000);
    const stop=second.watch((value,cached)=>{if(!cached&&value?.revision===2){try{assert.equal(value.plan.batches[0].prepared,true);clearTimeout(timer);stop();resolve();}catch(error){reject(error);}}},reject);
  });
  await first.save({...plan,batches:[{...plan.batches[0],prepared:true}]},1,generation);await received;
  await assert.rejects(second.save(plan,1,generation),/changed on another device/);
  await assert.rejects(second.save(plan,2,'b'.repeat(20)),/changed on another device/);
  await assert.rejects(prepRepository(clients[2],uid).save(plan,2,generation));
});

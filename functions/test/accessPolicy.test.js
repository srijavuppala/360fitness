import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hasRecentAuthentication,nextAnalysisUsage} from '../src/accessPolicy.js';
test('account deletion needs authentication within five minutes',()=>{const now=Date.parse('2026-10-06T12:00:00Z');assert.equal(hasRecentAuthentication(now/1000-300,now),true);for(const time of [undefined,null,'1',now/1000-301,now/1000+1,NaN])assert.equal(hasRecentAuthentication(time,now),false);});
test('AI usage limits each minute and each day',()=>{const now=Date.parse('2026-10-06T12:00:00Z');let usage={};for(let i=0;i<5;i++)usage=nextAnalysisUsage(usage,now);assert.equal(nextAnalysisUsage(usage,now),null);assert.equal(nextAnalysisUsage(usage,now+60000).recent,1);assert.equal(nextAnalysisUsage({...usage,daily:50},now+60000),null);assert.equal(nextAnalysisUsage({...usage,daily:50},now+86400000).daily,1);});

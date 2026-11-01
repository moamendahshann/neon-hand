import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173');await page.waitForTimeout(2500);
await page.screenshot({path:'preview.png'});
await page.getByRole('button',{name:'تجربة بالماوس',exact:true}).click();await page.mouse.move(680,450);await page.mouse.down();await page.waitForTimeout(350);await page.mouse.up();await page.mouse.wheel(0,-150);assert.match(await page.locator('#status').innerText(),/وضع الماوس/);
await page.locator('summary').click();await page.locator('#color').fill('#42ffa5');await page.locator('#count').fill('10000');await page.locator('#glow').fill('2');assert.equal(await page.locator('#countLabel').textContent(),'10000');
await page.getByRole('button',{name:'إخفاء الواجهة H',exact:true}).click();assert.ok(await page.locator('#show').isVisible());await page.keyboard.press('h');assert.ok(await page.locator('main').isVisible());
await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('denied','NotAllowedError')}});await page.locator('#start').click();await page.waitForTimeout(200);assert.match(await page.locator('#status').innerText(),/رُفض/);
await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('missing','NotFoundError')}});await page.locator('#start').click();await page.waitForTimeout(200);assert.match(await page.locator('#status').innerText(),/لا توجد كاميرا/);
// Synthetic canvas stream exercises worker initialization, inference, stop and model errors without camera access.
await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=async()=>{const c=document.createElement('canvas');c.width=640;c.height=480;const ctx=c.getContext('2d');ctx.fillRect(0,0,640,480);window.testStream=c.captureStream(15);return window.testStream}});
await page.locator('#start').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('لا توجد يد واضحة'),{timeout:45000});
await page.locator('#stop').click();assert.ok(await page.evaluate(()=>window.testStream.getTracks().every(t=>t.readyState==='ended')));
await page.route('**/hand_landmarker.task',r=>r.abort());await page.locator('#start').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('فشل تحميل'),{timeout:45000});
assert.ok(await page.evaluate(()=>window.testStream.getTracks().every(t=>t.readyState==='ended')));
await page.setViewportSize({width:390,height:844});await page.locator('#mouse').click();await page.screenshot({path:'preview-mobile.png'});
assert.deepEqual(errors,[]);console.log('PASS: WebGL, mouse, settings, UI hide/show, denied/missing camera, local worker + blank-frame inference, track cleanup, model failure, mobile. No page errors.');await browser.close();

import {mkdir,cp,access,writeFile} from 'node:fs/promises';
await mkdir('public/assets/wasm',{recursive:true});
await cp('node_modules/@mediapipe/tasks-vision/vision_bundle.js','public/assets/vision_bundle.js');
await cp('node_modules/@mediapipe/tasks-vision/wasm','public/assets/wasm',{recursive:true});
try {await access('public/assets/hand_landmarker.task')} catch {
 const r=await fetch('https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task');
 if(!r.ok)throw Error(`Model download ${r.status}`);
 await writeFile('public/assets/hand_landmarker.task',Buffer.from(await r.arrayBuffer()));
}
console.log('Local model and WASM ready');

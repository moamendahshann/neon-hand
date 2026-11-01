// Classic worker keeps MediaPipe's local WASM loader outside Vite transforms.
importScripts('/assets/vision_bundle.js');
const {HandLandmarker,FilesetResolver}=Vision;
let hand,files,delegate='GPU';
async function createHand(next){
 hand?.close();hand=null;delegate=next;
 hand=await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'/assets/hand_landmarker.task',delegate},runningMode:'VIDEO',numHands:1,minHandDetectionConfidence:.6,minHandPresenceConfidence:.55,minTrackingConfidence:.5});
}
self.onmessage=async({data})=>{try{
 if(data.type==='init'){
  files=await FilesetResolver.forVisionTasks('/assets/wasm');
  try{await createHand('GPU')}catch{await createHand('CPU')}
  // Compile inference shaders before announcing readiness; keep startup cost out of live frames.
  const warm=new OffscreenCanvas(320,240);warm.getContext('2d').fillRect(0,0,320,240);
  try{hand.detectForVideo(warm,0)}catch(e){if(delegate!=='GPU')throw e;await createHand('CPU');hand.detectForVideo(warm,0)}
  postMessage({type:'ready',delegate});
 }
 if(data.type==='frame'){
  try{
   const began=performance.now();let r;
   try{r=hand.detectForVideo(data.bitmap,data.time)}catch(e){
    if(delegate!=='GPU')throw e;
    await createHand('CPU');r=hand.detectForVideo(data.bitmap,data.time);
   }
   postMessage({type:'result',duration:performance.now()-began,delegate,landmarks:r.landmarks[0],world:r.worldLandmarks[0],time:data.time});
  }finally{data.bitmap.close()}
 }
}catch(e){postMessage({type:'error',message:e.message})}};

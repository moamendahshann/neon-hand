import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {clamp,measureHand,GestureGate,cameraError} from './gestures.js';
import './style.css';
const $=s=>document.querySelector(s),status=s=>{if($('#status').textContent!==s)$('#status').textContent=s};
const canvas=$('#stage'),video=$('#video');
let renderer;
try{renderer=new T.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});}catch(e){status('تعذر تشغيل WebGL2. فعّل تسريع الرسوم في المتصفح ثم أعد تحميل الصفحة.');throw e}
renderer.setClearColor(0);renderer.toneMapping=T.ACESFilmicToneMapping;
const scene=new T.Scene(),camera=new T.PerspectiveCamera(48,1,.1,100);camera.position.z=9;
let composer=null,bloom=null,renderMode='fast',glowStrength=1.5;
function enableBloom(){if(composer)return;composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));bloom=new UnrealBloomPass(new T.Vector2(1,1),glowStrength,.7,.12);composer.addPass(bloom);composer.addPass(new OutputPass())}
let dpr=1,quality=1,count=3000;
function resize(){dpr=Math.min(renderMode==='fast'?.6:1,Math.sqrt((renderMode==='fast'?200000:650000)/(innerWidth*innerHeight)))*quality;renderer.setPixelRatio(dpr);renderer.setSize(innerWidth,innerHeight);if(composer){composer.setPixelRatio(dpr);composer.setSize(innerWidth,innerHeight)}camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}
addEventListener('resize',resize);resize();
const max=30000,seeds=new Float32Array(max*4),zeros=new Float32Array(max*3);
for(let i=0;i<max;i++){seeds[i*4]=Math.random();seeds[i*4+1]=Math.random();seeds[i*4+2]=Math.random();seeds[i*4+3]=Math.random()}
const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(zeros,3));geo.setAttribute('seed',new T.BufferAttribute(seeds,4));geo.setDrawRange(0,count);
const uniforms={time:{value:0},spread:{value:.5},radius:{value:1},center:{value:new T.Vector3()},tint:{value:new T.Color('#75ff24')},pixel:{value:dpr},fast:{value:1},glowStrength:{value:1.5}};
const mat=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,blending:T.AdditiveBlending,vertexShader:`
attribute vec4 seed;uniform float time,spread,radius,pixel,fast;uniform vec3 center;varying float heat;
void main(){float a=seed.x*6.2831853;float z=seed.y*2.-1.;float r=pow(seed.z,.48);float q=sqrt(1.-z*z);vec3 p=vec3(cos(a)*q,sin(a)*q,z)*r;
float t=time*.32;vec3 curl=vec3(sin(p.y*5.+t+seed.w*4.),cos(p.z*5.-t*1.4),sin(p.x*5.+t*.8));
p+=curl*(.10+spread*.3);float arm=sin(a*3.+t+p.z*3.);p.x*=1.+spread*1.8;p.y+=spread*.55*arm;p.z+=spread*.4*cos(a*4.+t);
p*=radius*(.78+spread*.6);float rot=t*.3; p.xz=mat2(cos(rot),-sin(rot),sin(rot),cos(rot))*p.xz;
vec4 mv=modelViewMatrix*vec4(p+center,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((2.+seed.w*3.)*(1.+fast*1.6)*pixel*6./-mv.z,1.,15.);heat=pow(1.-r,2.);}
`,fragmentShader:`uniform vec3 tint;uniform float fast,glowStrength;varying float heat;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;float glow=pow(1.-d,2.5);vec3 col=mix(tint,vec3(1.,1.,.75),heat*.95);float halo=exp(-d*d*7.)*.12;gl_FragColor=vec4(col*(1.+heat*1.8),mix(glow*.20,(glow*.42+halo)*glowStrength,fast));}`});
const points=new T.Points(geo,mat);points.frustumCulled=false;scene.add(points);
const group=new T.Group();scene.add(group);
const lineMaterial=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,blending:T.AdditiveBlending,vertexShader:`
attribute float phase;uniform float time,spread;void main(){float u=position.x;float t=time;float r=.65+.24*sin(u*3.+phase+t*.6)+.12*sin(u*7.-t);vec3 p=vec3(cos(u+phase)*(r+spread*.4)*(1.+spread*1.7),sin(u)*r*.8+spread*.28*sin(u*3.+t+phase),sin(u*2.+phase)*.6+.15*sin(u*5.+t+phase));gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}
`,fragmentShader:`uniform vec3 tint;void main(){gl_FragColor=vec4(tint,.24);}`});
// One static geometry and one draw call; all filament animation runs on the GPU.
const segments=48,strands=6,linePositions=new Float32Array(strands*segments*6),phases=new Float32Array(strands*segments*2);
for(let j=0;j<strands;j++)for(let i=0;i<segments;i++)for(let k=0;k<2;k++){const n=(j*segments+i)*2+k;linePositions[n*3]=(i+k)/segments*Math.PI*2;phases[n]=j*2.39996}
const lineGeo=new T.BufferGeometry();lineGeo.setAttribute('position',new T.BufferAttribute(linePositions,3));lineGeo.setAttribute('phase',new T.BufferAttribute(phases,1));const lines=new T.LineSegments(lineGeo,lineMaterial);lines.frustumCulled=false;group.add(lines);
let mode='auto',target=new T.Vector3(),position=new T.Vector3(),spread=.5,targetSpread=.5,size=1,targetSize=1,lastHand=0,lastMouse=0,down=false,sensitivity=1;
const gate=new GestureGate();let worker=null,stream=null,generation=0,busy=false,ready=false,lastVideo=-1,lastInfer=0,startTimer,inferInterval=33,inferenceMs=0,trackingDelegate='';
function release(){generation++;clearTimeout(startTimer);worker?.terminate();worker=null;stream?.getTracks().forEach(t=>t.stop());stream=null;video.pause();video.srcObject=null;video.hidden=true;$('#preview').checked=false;ready=false;busy=false;lastHand=0;lastVideo=-1;lastInfer=0;inferInterval=33;trackingDelegate='';gate.reset();$('#start').disabled=false;$('#stop').disabled=true}
function stop(){release();mode='auto';status('الكاميرا مغلقة • حركة تلقائية')}
$('#stop').onclick=stop;
$('#start').onclick=async()=>{release();mode='camera';const token=generation;$('#start').disabled=true;$('#stop').disabled=false;status('جارٍ تجهيز نموذج اليد والكاميرا محليًا…');
try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('unsupported');const next=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:320,max:640},height:{ideal:240,max:480},frameRate:{ideal:30,max:30},facingMode:'user'},audio:false});if(token!==generation){next.getTracks().forEach(t=>t.stop());return}stream=next;video.srcObject=stream;await video.play();if(token!==generation)return;
worker=new Worker('/tracker.js');startTimer=setTimeout(()=>{if(token===generation){release();mode='auto';status('استغرق تحميل النموذج وقتًا طويلًا. حاول مجددًا أو استخدم الماوس.')}},45000);
worker.onmessage=({data})=>{if(token!==generation)return;if(data.type==='ready'){clearTimeout(startTimer);ready=true;trackingDelegate=data.delegate||'';status('الكاميرا تعمل • ضع يدك أمامها')}if(data.type==='error'){release();mode='auto';status('فشل تحميل نموذج اليد أو تشغيله. تأكد من ملفات assets واستخدم تجربة الماوس.')}if(data.type==='result'){busy=false;inferenceMs=data.duration||0;trackingDelegate=data.delegate||trackingDelegate;inferInterval=33;if(data.landmarks){lastHand=performance.now();const h=measureHand(data.landmarks,data.world,video.videoWidth/video.videoHeight);target.set((h.x-.5)*7*camera.aspect,(.5-h.y)*5,0);targetSpread=gate.update(h.open,lastHand);targetSize=.65+h.size*.7;status(targetSpread>.7?'كف مفتوح • انتشار الطاقة':targetSpread<.3?'قبضة مغلقة • كرة مكثفة':'تتبّع اليد يعمل')}else if(performance.now()-lastHand>800)status('لا توجد يد واضحة • حركة تلقائية هادئة')}};
worker.onerror=()=>{if(token===generation){release();mode='auto';status('تعذر تشغيل عامل التتبّع. استخدم الماوس أو أعد تشغيل الصفحة.')}};worker.postMessage({type:'init'});
}catch(e){if(token===generation){release();mode='auto';status(cameraError(e))}}};
$('#mouse').onclick=()=>{release();mode='mouse';lastMouse=performance.now();status('وضع الماوس • حرّك المؤشر، اضغط للتجميع، وعجلة الماوس للتحجيم')};
canvas.addEventListener('pointermove',e=>{if(mode!=='mouse')return;lastMouse=performance.now();target.set((e.clientX/innerWidth-.5)*7*camera.aspect,(.5-e.clientY/innerHeight)*5,0);targetSpread=down?0:1});
canvas.addEventListener('pointerdown',e=>{if(mode==='mouse'){down=true;targetSpread=0;canvas.setPointerCapture(e.pointerId)}});canvas.addEventListener('pointerup',()=>{down=false;if(mode==='mouse')targetSpread=1});canvas.addEventListener('pointercancel',()=>{down=false});
canvas.addEventListener('wheel',e=>{if(mode==='mouse'){e.preventDefault();targetSize=clamp(targetSize-e.deltaY*.001,.4,2.4)}},{passive:false});
$('#preview').onchange=()=>{video.hidden=!($('#preview').checked&&stream);if(!stream)$('#preview').checked=false};
$('#color').oninput=e=>{uniforms.tint.value.set(e.target.value);};
$('#glow').oninput=e=>{glowStrength=+e.target.value;uniforms.glowStrength.value=glowStrength;if(bloom)bloom.strength=glowStrength};
$('#renderMode').onchange=e=>{renderMode=e.target.value;if(renderMode==='cinematic')enableBloom();uniforms.fast.value=renderMode==='fast'?1:0;quality=1;resize();geo.setDrawRange(0,count)};
$('#count').oninput=e=>{count=+e.target.value;$('#countLabel').value=count;geo.setDrawRange(0,Math.floor(count*quality))};
$('#sensitivity').oninput=e=>sensitivity=+e.target.value;
function toggleUI(){document.body.classList.toggle('clean');$('#show').hidden=!document.body.classList.contains('clean')}
$('#hide').onclick=toggleUI;$('#show').onclick=toggleUI;
async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{status('تعذر فتح ملء الشاشة. جرّب F11 في المتصفح.')}}$('#full').onclick=fullscreen;
addEventListener('keydown',e=>{if(/INPUT/.test(e.target.tagName))return;if(e.key.toLowerCase()==='h')toggleUI();if(e.key.toLowerCase()==='f')fullscreen()});
let last=performance.now(),lastRendered=0,frame=0,frameSum=0,animation;
async function infer(now){if(!ready||busy||!worker||video.readyState<2||video.currentTime===lastVideo||now-lastInfer<inferInterval)return;busy=true;lastInfer=now;lastVideo=video.currentTime;const token=generation;try{const bitmap=await createImageBitmap(video);if(token!==generation){bitmap.close();return}worker.postMessage({type:'frame',bitmap,time:now},[bitmap])}catch{if(token===generation){busy=false;release();mode='auto';status('تعذر قراءة إطارات الكاميرا. استخدم الماوس أو حاول مجددًا.')}}}
function animate(now){animation=requestAnimationFrame(animate);if(document.hidden){last=now;return}if(now-lastRendered<16)return;lastRendered=now;const elapsed=(now-last)/1000;const dt=Math.min(elapsed,.05);last=now;if(document.hidden)return;const t=now/1000;
if(mode==='camera')void infer(now);
if(mode==='auto'||(mode==='camera'&&now-lastHand>700)){target.set(Math.sin(t*.23)*.6-(innerWidth>800?1.35:.55),Math.cos(t*.31)*.35,0);targetSpread=.35+.35*Math.sin(t*.27);targetSize=1.1}
const alpha=1-Math.exp(-dt*60*sensitivity);position.lerp(target,alpha);spread+=(targetSpread-spread)*(1-Math.exp(-dt*7));size+=(targetSize-size)*(1-Math.exp(-dt*10));
uniforms.time.value=t;uniforms.spread.value=spread;uniforms.radius.value=size;uniforms.center.value.copy(position);uniforms.pixel.value=dpr;
group.position.copy(position);group.scale.setScalar(size);
if(renderMode==='fast')renderer.render(scene,camera);else composer.render();frameSum+=elapsed;frame++;if(frameSum>=.65){const fps=Math.round(frame/frameSum);$('#performance').textContent=`${fps} FPS · ${Math.floor(count*quality).toLocaleString()} جزيء${mode==='camera'&&ready?' · تتبّع '+Math.round(inferenceMs)+' ms '+trackingDelegate:''}`;if(fps<48&&quality>.3){quality=Math.max(.3,quality*.75);resize();geo.setDrawRange(0,Math.floor(count*quality))}frame=0;frameSum=0}}

animation=requestAnimationFrame(animate);
addEventListener('visibilitychange',()=>{last=performance.now();lastRendered=0;frame=0;frameSum=0});
addEventListener('pagehide',()=>{release();cancelAnimationFrame(animation);geo.dispose();mat.dispose();lineMaterial.dispose();group.children.forEach(l=>l.geometry.dispose());bloom?.dispose();composer?.dispose();renderer.dispose()});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();stop();cancelAnimationFrame(animation);status('فُقد اتصال معالج الرسوم. أعد تحميل الصفحة لاستعادة التأثير.');});

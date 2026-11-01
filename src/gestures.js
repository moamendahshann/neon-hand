export const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export function measureHand(lm,world,aspect=1){
 const p=world?.length===21?world:lm.map(p=>({x:p.x*aspect,y:p.y,z:p.z*aspect}));
 const d=(a,b)=>Math.hypot(p[a].x-p[b].x,p[a].y-p[b].y,p[a].z-p[b].z);
 const palm=Math.max(d(0,9),d(5,17),0.0001);
 const extension=[8,12,16,20].reduce((s,t)=>s+d(t,0)/Math.max(d(t-3,0),palm*.35),0)/4;
 return {open:clamp((extension-1.05)/.9,0,1),size:clamp(d(4,8)/palm,.25,2.2),x:1-(lm[0].x+lm[5].x+lm[17].x)/3,y:(lm[0].y+lm[5].y+lm[17].y)/3};
}
export class GestureGate{
 value=.5;candidate=null;since=0;
 update(open,now){const next=open>.65?1:open<.3?0:this.value;if(next!==this.candidate){this.candidate=next;this.since=now}if(now-this.since>140)this.value=next;return this.value}
 reset(){this.value=.5;this.candidate=null;this.since=0}
}
export function cameraError(e){return ({NotAllowedError:'رُفض إذن الكاميرا. اسمح بالكاميرا من رمز الإذن بجانب العنوان ثم حاول مجددًا.',NotFoundError:'لا توجد كاميرا متاحة. وصّل كاميرا أو استخدم تجربة الماوس.',NotReadableError:'تعذر فتح الكاميرا. أغلق التطبيقات الأخرى التي تستخدمها ثم حاول مجددًا.',OverconstrainedError:'إعدادات الكاميرا غير مدعومة. جرّب كاميرا أخرى.'})[e.name]||'تعذر تشغيل الكاميرا. جرّب متصفح Chrome أو Edge ووضع الماوس.'}

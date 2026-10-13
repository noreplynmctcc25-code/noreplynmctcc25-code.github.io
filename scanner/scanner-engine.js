/* ClearScan: browser camera, local image processing, multi-page editing, and image-based PDF export. */
(()=>{
'use strict';
const D=document,$=(s,r)=>(r||D).querySelector(s),clamp=(v,a,b)=>v<a?a:v>b?b:v;
const QL={s:{q:.62,m:1600,n:'Small'},b:{q:.82,m:2400,n:'Balanced'},h:{q:.92,m:3200,n:'High'}};
const testFrame=new URLSearchParams(location.search).get('mode')=='test'&&parent!==window;
const testFileName=testFrame?new URLSearchParams(location.search).get('filename')||'Scan':'';
const pdfWorkerSrc=()=>new URL(location.pathname.includes('/scanner/')?'../pdf.worker.min.js':'pdf.worker.min.js',D.baseURI).href;
const PS={orig:null,a4:[595.28,841.89],letter:[612,792],legal:[612,936],id2:[595.28,841.89],id4:[595.28,841.89]};
const MODES=[['magic','Magic color'],['bw','B&W 1'],['bw2','B&W 2'],['gray','Grayscale'],['light','Lighten'],['board','Whiteboard'],['super','Super filter'],['orig','Original']];
let S=null,pgid=0;
const tb=(c,t,q)=>new Promise(r=>c.toBlob(r,t,q)),cvs=(w,h)=>{const c=D.createElement('canvas');c.width=Math.max(1,w);c.height=Math.max(1,h);return c};
const polyArea=P=>{let a=0;for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length];a+=p.x*q.y-q.x*p.y}return Math.abs(a)/2};
const inset=(w,h)=>{const m=.04;return[{x:w*m,y:h*m},{x:w*(1-m),y:h*m},{x:w*(1-m),y:h*(1-m)},{x:w*m,y:h*(1-m)}]};
const toast_=m=>{try{toast(m)}catch(_){}};

/* ---------- image maths ---------- */
function otsu(h,n){let sum=0;for(let i=0;i<256;i++)sum+=i*h[i];let sB=0,wB=0,mx=-1,t=128;for(let i=0;i<256;i++){wB+=h[i];if(!wB)continue;const wF=n-wB;if(!wF)break;sB+=i*h[i];const mB=sB/wB,mF=(sum-sB)/wF,v=wB*wF*(mB-mF)*(mB-mF);if(v>mx){mx=v;t=i}}return t}
function boxBlur(a,w,h,r){const t=new Float32Array(a.length),n=2*r+1;
 for(let y=0;y<h;y++){const o=y*w;let s=0;for(let x=-r;x<=r;x++)s+=a[o+clamp(x,0,w-1)];for(let x=0;x<w;x++){t[o+x]=s/n;s+=a[o+clamp(x+r+1,0,w-1)]-a[o+clamp(x-r,0,w-1)]}}
 for(let x=0;x<w;x++){let s=0;for(let y=-r;y<=r;y++)s+=t[clamp(y,0,h-1)*w+x];for(let y=0;y<h;y++){a[y*w+x]=s/n;s+=t[clamp(y+r+1,0,h-1)*w+x]-t[clamp(y-r,0,h-1)*w+x]}}
 return a}
/* find the page: the largest bright (or dark) blob that is not the whole frame; corners = extreme points of the blob */
/* sharpen the corners: fit a straight line to each side of the blob outline (ignoring outliers) and intersect the four lines */
function fitLine(pts){let idx=[];for(let i=0;i<pts.length/2;i++)idx.push(i);if(idx.length<12)return null;let ln=null;
 for(let it=0;it<4;it++){let sx=0,sy=0;for(const i of idx){sx+=pts[2*i];sy+=pts[2*i+1]}const cx=sx/idx.length,cy=sy/idx.length;let sxx=0,sxy=0,syy=0;for(const i of idx){const dx=pts[2*i]-cx,dy=pts[2*i+1]-cy;sxx+=dx*dx;sxy+=dx*dy;syy+=dy*dy}
  const th=.5*Math.atan2(2*sxy,sxx-syy),dx=Math.cos(th),dy=Math.sin(th),nx=-dy,ny=dx;ln={cx,cy,dx,dy,nx,ny};
  const r=idx.map(i=>[i,Math.abs((pts[2*i]-cx)*nx+(pts[2*i+1]-cy)*ny)]);r.sort((a,b)=>a[1]-b[1]);idx=r.slice(0,Math.max(12,Math.floor(r.length*.8))).map(z=>z[0])}
 let mn=1e9,mx=-1e9;for(const i of idx){const t=(pts[2*i]-ln.cx)*ln.dx+(pts[2*i+1]-ln.cy)*ln.dy;if(t<mn)mn=t;if(t>mx)mx=t}ln.span=mx-mn;return ln}
function refineQ(b,w,h,sw,sh){const{lab,n,Q}=b,tol=Math.max(3,.035*Math.max(w,h)),P=[[],[],[],[]];
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const p=y*w+x;if(lab[p]!==n)continue;if(lab[p-1]===n&&lab[p+1]===n&&lab[p-w]===n&&lab[p+w]===n)continue;
  let bi=-1,bd=1e9;for(let i=0;i<4;i++){const a=Q[i],c=Q[(i+1)&3],dx=c.x-a.x,dy=c.y-a.y,L=Math.hypot(dx,dy)||1,t=((x+.5-a.x)*dx+(y+.5-a.y)*dy)/(L*L);if(t<-.05||t>1.05)continue;const d=Math.abs((x+.5-a.x)*dy-(y+.5-a.y)*dx)/L;if(d<bd){bd=d;bi=i}}
  if(bi>=0&&bd<tol)P[bi].push(x+.5,y+.5)}
 const Ls=[];for(let i=0;i<4;i++){const a=Q[i],c=Q[(i+1)&3],len=Math.hypot(c.x-a.x,c.y-a.y),f=fitLine(P[i]);
  if(f&&f.span>len*.45)Ls.push(f);else{const dx=(c.x-a.x)/(len||1),dy=(c.y-a.y)/(len||1);Ls.push({cx:a.x,cy:a.y,dx,dy})}}
 const diag=Math.hypot(w,h),out=[];
 for(let i=0;i<4;i++){const A=Ls[(i+3)&3],B=Ls[i],den=A.dx*B.dy-A.dy*B.dx;let x=Q[i].x,y=Q[i].y;
  if(Math.abs(den)>1e-3){const t=((B.cx-A.cx)*B.dy-(B.cy-A.cy)*B.dx)/den,nx=A.cx+t*A.dx,ny=A.cy+t*A.dy;if(Math.hypot(nx-x,ny-y)<.08*diag){x=nx;y=ny}}
  out.push({x:clamp(x,0,w)/w*sw,y:clamp(y,0,h)/h*sh})}
 return out}
function detect(src,fast){const sw=src.videoWidth||src.width,sh=src.videoHeight||src.height;if(!sw||!sh)return null;
 const k=Math.min(1,(fast?340:400)/Math.max(sw,sh)),w=Math.max(16,Math.round(sw*k)),h=Math.max(16,Math.round(sh*k)),c=cvs(w,h),g=c.getContext('2d',{willReadFrequently:true});g.drawImage(src,0,0,w,h);
 const px=g.getImageData(0,0,w,h).data,L=new Float32Array(w*h);for(let i=0,j=0;i<L.length;i++,j+=4)L[i]=.299*px[j]+.587*px[j+1]+.114*px[j+2];
 boxBlur(boxBlur(L,w,h,2),w,h,2);
 /* take out a straight-line lighting gradient (shadow / window light): fit a plane to log-brightness and divide it away */
 {let sx=0,sy=0,sxx=0,syy=0,sxy=0,sz=0,sxz=0,syz=0;const n=w*h,cx0=w/2,cy0=h/2;for(let y=0;y<h;y+=2)for(let x=0;x<w;x+=2){const X=(x-cx0)/w,Y=(y-cy0)/h,Z=Math.log(L[y*w+x]+8);sx+=X;sy+=Y;sxx+=X*X;syy+=Y*Y;sxy+=X*Y;sz+=Z;sxz+=X*Z;syz+=Y*Z}
  const M=[[sxx,sxy,sx,sxz],[sxy,syy,sy,syz],[sx,sy,n/4,sz]];for(let c2=0;c2<3;c2++){let p=c2;for(let r=c2+1;r<3;r++)if(Math.abs(M[r][c2])>Math.abs(M[p][c2]))p=r;[M[c2],M[p]]=[M[p],M[c2]];const d=M[c2][c2];if(Math.abs(d)<1e-9)break;for(let k2=c2;k2<4;k2++)M[c2][k2]/=d;for(let r=0;r<3;r++)if(r!=c2){const f=M[r][c2];for(let k2=c2;k2<4;k2++)M[r][k2]-=f*M[c2][k2]}}
  const A=M[0][3]||0,B=M[1][3]||0;if(isFinite(A)&&isFinite(B))for(let y=0;y<h;y++)for(let x=0;x<w;x++)L[y*w+x]*=Math.exp(-(A*(x-cx0)/w+B*(y-cy0)/h))}
 let mn=1e9,mx=-1e9;for(let i=0;i<L.length;i++){if(L[i]<mn)mn=L[i];if(L[i]>mx)mx=L[i]}const sc0=255/Math.max(1,mx-mn);
 const hist=new Uint32Array(256);for(let i=0;i<L.length;i++)hist[clamp(((L[i]-mn)*sc0)|0,0,255)]++;const T0=otsu(hist,L.length);
 const cx=(w/2)|0,cy=(h/2)|0;
 const m=new Uint8Array(w*h),st=new Int32Array(w*h);let labBuf=null;
 const scan=(T,pol)=>{let best=null;for(let i=0;i<m.length;i++){const v=(L[i]-mn)*sc0;m[i]=(pol>0?v>T:v<=T)?1:0}
  const lab=new Int32Array(w*h);let n=0;
  for(let s0=0;s0<m.length;s0++){if(!m[s0]||lab[s0])continue;n++;let sp=0,area=0,mnS=1e9,mxS=-1e9,mnD=1e9,mxD=-1e9,tl=s0,br=s0,tr=s0,bl=s0,touch=0;st[sp++]=s0;lab[s0]=n;
   while(sp){const p=st[--sp],x=p%w,y=(p/w)|0;area++;const s=x+y,d=x-y;if(s<mnS){mnS=s;tl=p}if(s>mxS){mxS=s;br=p}if(d>mxD){mxD=d;tr=p}if(d<mnD){mnD=d;bl=p}
    if(x==0||y==0||x==w-1||y==h-1)touch++;
    if(x>0&&m[p-1]&&!lab[p-1]){lab[p-1]=n;st[sp++]=p-1}if(x<w-1&&m[p+1]&&!lab[p+1]){lab[p+1]=n;st[sp++]=p+1}
    if(y>0&&m[p-w]&&!lab[p-w]){lab[p-w]=n;st[sp++]=p-w}if(y<h-1&&m[p+w]&&!lab[p+w]){lab[p+w]=n;st[sp++]=p+w}}
   const fr=area/(w*h);if(fr<.12||fr>.97)continue;
   const Q=[tl,tr,br,bl].map(p=>({x:(p%w)+.5,y:((p/w)|0)+.5})),qa=polyArea(Q);if(qa<=0)continue;
   const rect=Math.min(1,area/qa),ctr=lab[cy*w+cx]==n?1.3:1,sc=Math.pow(rect,5)*Math.min(fr,.8)*ctr*(touch>w*.4?.7:1);
   if(rect<.6)continue;if(!best||sc>best.sc)best={sc,rect,fr,Q,lab,n,P:Q.map(p=>({x:p.x/w*sw,y:p.y/h*sh}))}}
  return best};
 /* the usual case (bright page on a darker surface) is tried first and accepted when it looks like a clean rectangle; otherwise other thresholds and polarities are searched */
 const fin=b=>b?(refineQ(b,w,h,sw,sh)||b.P):null;
 let best=scan(T0,1);if(best&&best.rect>.8&&best.fr>.2)return fin(best);if(fast)return fin(best);
 for(const[T,pol]of[[T0,-1],[T0*.88,1],[T0*1.12,1],[T0*.78,1],[T0*1.22,1],[T0*.88,-1],[T0*1.12,-1]]){const r=scan(T,pol);if(r&&(!best||r.sc>best.sc))best=r}
 return fin(best)}
function solveH(dst,src){const A=[];for(let i=0;i<4;i++){const[x,y]=dst[i],[u,v]=src[i];A.push([x,y,1,0,0,0,-x*u,-y*u,u]);A.push([0,0,0,x,y,1,-x*v,-y*v,v])}
 for(let c=0;c<8;c++){let p=c;for(let r=c+1;r<8;r++)if(Math.abs(A[r][c])>Math.abs(A[p][c]))p=r;[A[c],A[p]]=[A[p],A[c]];const d=A[c][c];if(Math.abs(d)<1e-12)return null;for(let k=c;k<9;k++)A[c][k]/=d;for(let r=0;r<8;r++)if(r!=c){const f=A[r][c];if(f)for(let k=c;k<9;k++)A[r][k]-=f*A[c][k]}}
 return A.map(r=>r[8])}
/* flatten the page to a rectangle (perspective correction) */
function warp(bm,quad,maxLong){const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);let ow=Math.max(dist(quad[0],quad[1]),dist(quad[3],quad[2])),oh=Math.max(dist(quad[0],quad[3]),dist(quad[1],quad[2]));
 const s=Math.min(1,maxLong/Math.max(ow,oh,1));ow=Math.max(8,Math.round(ow*s));oh=Math.max(8,Math.round(oh*s));
 let sw=bm.width,sh=bm.height,q=quad,src=bm;
 if(s<.7){const k=Math.min(1,s*1.5);sw=Math.max(8,Math.round(bm.width*k));sh=Math.max(8,Math.round(bm.height*k));const t=cvs(sw,sh);t.getContext('2d').drawImage(bm,0,0,sw,sh);src=t;q=quad.map(p=>({x:p.x*sw/bm.width,y:p.y*sh/bm.height}))}
 const sc=cvs(sw,sh),sg=sc.getContext('2d',{willReadFrequently:true});sg.drawImage(src,0,0);const sd=sg.getImageData(0,0,sw,sh).data;
 const oc=cvs(ow,oh),og=oc.getContext('2d'),H=solveH([[0,0],[ow,0],[ow,oh],[0,oh]],q.map(p=>[p.x,p.y]));
 if(!H){og.drawImage(bm,0,0,ow,oh);return oc}
 const od=og.createImageData(ow,oh),o=od.data,[a,b,c,d,e,f,g,h]=H,mx=sw-1,my=sh-1;
 for(let y=0;y<oh;y++){const Y=y+.5;for(let x=0;x<ow;x++){const X=x+.5,den=g*X+h*Y+1;let u=(a*X+b*Y+c)/den-.5,v=(d*X+e*Y+f)/den-.5;u=u<0?0:u>mx?mx:u;v=v<0?0:v>my?my:v;
  const x0=u|0,y0=v|0,x1=x0<mx?x0+1:x0,y1=y0<my?y0+1:y0,fx=u-x0,fy=v-y0,i00=(y0*sw+x0)*4,i10=(y0*sw+x1)*4,i01=(y1*sw+x0)*4,i11=(y1*sw+x1)*4,w00=(1-fx)*(1-fy),w10=fx*(1-fy),w01=(1-fx)*fy,w11=fx*fy,oi=(y*ow+x)*4;
  o[oi]=sd[i00]*w00+sd[i10]*w10+sd[i01]*w01+sd[i11]*w11;o[oi+1]=sd[i00+1]*w00+sd[i10+1]*w10+sd[i01+1]*w01+sd[i11+1]*w11;o[oi+2]=sd[i00+2]*w00+sd[i10+2]*w10+sd[i01+2]*w01+sd[i11+2]*w11;o[oi+3]=255}}
 og.putImageData(od,0,0);return oc}
/* remove shadows / uneven light, then lift the contrast so text reads clearly */
function enhance(cv,mode,boost,dn){if(mode=='orig')return cv;const w=cv.width,h=cv.height,g=cv.getContext('2d',{willReadFrequently:true}),id=g.getImageData(0,0,w,h),d=id.data,n=w*h,s=boost/100;
 if(dn!==false)denoise(d,w,h);
 const L=new Float32Array(n);for(let i=0,j=0;i<n;i++,j+=4)L[i]=.299*d[j]+.587*d[j+1]+.114*d[j+2];
 const b=Math.max(6,Math.round(Math.max(w,h)/48)),gw=Math.ceil(w/b),gh=Math.ceil(h/b),G=new Float32Array(gw*gh);
 for(let y=0;y<h;y++){const r=((y/b)|0)*gw,o=y*w;for(let x=0;x<w;x++){const gi=r+((x/b)|0);if(L[o+x]>G[gi])G[gi]=L[o+x]}}
 boxBlur(G,gw,gh,1);
 const lo=10+60*s,hi=255-40*s,sp=255/Math.max(1,hi-lo),F=new Float32Array(n);
 for(let y=0;y<h;y++){const gy=clamp(y/b-.5,0,gh-1),y0=gy|0,y1=Math.min(gh-1,y0+1),fy=gy-y0;for(let x=0;x<w;x++){const gx=clamp(x/b-.5,0,gw-1),x0=gx|0,x1=Math.min(gw-1,x0+1),fx=gx-x0,
   B=(G[y0*gw+x0]*(1-fx)+G[y0*gw+x1]*fx)*(1-fy)+(G[y1*gw+x0]*(1-fx)+G[y1*gw+x1]*fx)*fy;F[y*w+x]=255/Math.max(B,60)}}
 if(mode=='light'){for(let i=0,j=0;i<n;i++,j+=4){for(let c=0;c<3;c++){const v=d[j+c]*(1+.24*s)+12*s;d[j+c]=v>255?255:v}}}
 else if(mode=='magic'||mode=='super'||mode=='board'){for(let i=0,j=0;i<n;i++,j+=4){const f=F[i];for(let c=0;c<3;c++){const v=(d[j+c]*f-lo)*sp;d[j+c]=v<0?0:v>255?255:v}if(mode=='board'){const hi=Math.max(d[j],d[j+1],d[j+2]),lo2=Math.min(d[j],d[j+1],d[j+2]);if(hi-lo2<28){const v=Math.min(255,Math.max(d[j],d[j+1],d[j+2])+24);d[j]=d[j+1]=d[j+2]=v}}}}
 else{const V=new Uint8Array(n),hist=new Uint32Array(256);for(let i=0;i<n;i++){const v=(L[i]*F[i]-lo)*sp;V[i]=v<0?0:v>255?255:v;hist[V[i]]++}
  if(mode=='gray'){for(let i=0,j=0;i<n;i++,j+=4){d[j]=d[j+1]=d[j+2]=V[i]}}
  else{const T=clamp(otsu(hist,n)+(s-.5)*70+(mode=='bw2'?12:0),40,235);for(let i=0,j=0;i<n;i++,j+=4){d[j]=d[j+1]=d[j+2]=V[i]>T?255:0}}}
 if(mode!='bw'&&mode!='bw2'&&dn!==false)sharpen(d,w,h,mode=='super'?.9:.5);
 g.putImageData(id,0,0);return cv}

/* ---------- PDF writer (JPEG pages, no library) ---------- */
function buildPdf(P,size,title){const te=new TextEncoder(),parts=[],off=[];let len=0;const add=x=>{const u=typeof x=='string'?te.encode(x):x;parts.push(u);len+=u.length};
 const obj=(n,body)=>{off[n]=len;add(n+' 0 obj\n');add(body);add('\nendobj\n')};
 add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');const N=P.length,kids=[];
 for(let i=0;i<N;i++)kids.push((3+i*3)+' 0 R');
 obj(1,'<</Type/Catalog/Pages 2 0 R>>');obj(2,'<</Type/Pages/Kids['+kids.join(' ')+']/Count '+N+'>>');
 P.forEach((p,i)=>{const pn=3+i*3,cn=pn+1,im=pn+2;let pw,ph,iw,ih,x,y;const fs=PS[size];
  if(!fs){const land=p.w>p.h,k=land?Math.min(842/p.w,595/p.h):Math.min(595/p.w,842/p.h);pw=iw=p.w*k;ph=ih=p.h*k;x=y=0}
  else{const land=p.w>p.h,W=land?fs[1]:fs[0],H=land?fs[0]:fs[1],k=Math.min(W/p.w,H/p.h);pw=W;ph=H;iw=p.w*k;ih=p.h*k;x=(W-iw)/2;y=(H-ih)/2}
  const f=v=>(+v).toFixed(2),cs='q '+f(iw)+' 0 0 '+f(ih)+' '+f(x)+' '+f(y)+' cm /Im0 Do Q';
  obj(pn,'<</Type/Page/Parent 2 0 R/MediaBox[0 0 '+f(pw)+' '+f(ph)+']/Resources<</XObject<</Im0 '+im+' 0 R>>>>/Contents '+cn+' 0 R>>');
  obj(cn,'<</Length '+cs.length+'>>\nstream\n'+cs+'\nendstream');
  off[im]=len;add(im+' 0 obj\n<</Type/XObject/Subtype/Image/Width '+p.w+'/Height '+p.h+'/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length '+p.j.length+'>>\nstream\n');add(p.j);add('\nendstream\nendobj\n')});
 const info=3+N*3,ts=String(title||'Scan').replace(/[()\\]/g,'');
 const dt=new Date(),z=n=>String(n).padStart(2,'0'),cd='D:'+dt.getFullYear()+z(dt.getMonth()+1)+z(dt.getDate())+z(dt.getHours())+z(dt.getMinutes())+z(dt.getSeconds());
 obj(info,'<</Title('+ts+')/Producer(Gradu Scanner)/CreationDate('+cd+')>>');
 const xo=len,total=info+1;let x='xref\n0 '+total+'\n0000000000 65535 f \n';for(let i=1;i<total;i++)x+=String(off[i]).padStart(10,'0')+' 00000 n \n';
 add(x+'trailer\n<</Size '+total+'/Root 1 0 R/Info '+info+' 0 R>>\nstartxref\n'+xo+'\n%%EOF\n');
 return new Blob(parts,{type:'application/pdf'})}


function blur3(a,w,h,t){for(let y=0;y<h;y++){const o=y*w;t[o]=(2*a[o]+a[o+1])/3;for(let x=1;x<w-1;x++)t[o+x]=(a[o+x-1]+a[o+x]+a[o+x+1])/3;t[o+w-1]=(a[o+w-2]+2*a[o+w-1])/3}
 for(let x=0;x<w;x++)a[x]=(2*t[x]+t[w+x])/3;for(let y=1;y<h-1;y++){const o=y*w;for(let x=0;x<w;x++)a[o+x]=(t[o-w+x]+t[o+x]+t[o+w+x])/3}const o=(h-1)*w;for(let x=0;x<w;x++)a[o+x]=(t[o-w+x]+2*t[o+x])/3;return a}
/* grain: smooth only where the picture is noisy and flat, so text edges stay sharp (skipped for clean photos) */
function denoise(d,w,h,deep){const n=w*h,L=new Float32Array(n);for(let i=0,j=0;i<n;i++,j+=4)L[i]=.299*d[j]+.587*d[j+1]+.114*d[j+2];
 const tmp=new Float32Array(n),B=blur3(Float32Array.from(L),w,h,tmp),sm=[],stp=Math.max(1,(n/4000)|0);for(let i=0;i<n;i+=stp)sm.push(Math.abs(L[i]-B[i]));sm.sort((a,b)=>a-b);
 const sig=sm[(sm.length/2)|0]*1.5;if(sig<1.2)return 0;
 const st=Math.max(sig*2.4,3.5),s4=1/(st*st*st*st),W=new Float32Array(n),T=new Float32Array(n);for(let i=0;i<n;i++){const e=L[i]-B[i],e2=e*e;W[i]=1/(1+e2*e2*s4)}
 for(let c=0;c<3;c++){for(let i=0,j=c;i<n;i++,j+=4)T[i]=d[j];blur3(T,w,h,tmp);for(let i=0,j=c;i<n;i++,j+=4){const v=d[j];d[j]=v+(T[i]-v)*W[i]}}
 if(sig>6&&!deep)denoise(d,w,h,1);return sig}
function sharpen(d,w,h,k){const n=w*h,T=new Float32Array(n),O=new Float32Array(n),tmp=new Float32Array(n);for(let c=0;c<3;c++){for(let i=0,j=c;i<n;i++,j+=4)T[i]=d[j];O.set(T);blur3(T,w,h,tmp);for(let i=0,j=c;i<n;i++,j+=4){const v=O[i]+k*(O[i]-T[i]);d[j]=v<0?0:v>255?255:v}}}
function rotQ(cv,k){k=((k%4)+4)%4;if(!k)return cv;const w=cv.width,h=cv.height,c=k==2?cvs(w,h):cvs(h,w),g=c.getContext('2d');g.translate(c.width/2,c.height/2);g.rotate(k*Math.PI/2);g.drawImage(cv,-w/2,-h/2);return c}
/* which way is up? Text lines show it: regular rows of ink mean upright or upside down; regular columns mean the page is on its side. Upright text has more ascenders (b, d, h, l, t...) than descenders (g, p, q, y), so there is more ink above the dense middle of each line than below it. Returns quarter turns clockwise (0-3); 0 when unsure. */
function runsOf(a,lo){const n=a.length,s=boxBlur(Float32Array.from(a),n,1,Math.max(1,Math.round(n/400)));let mx=0;for(const v of s)if(v>mx)mx=v;const R=[];if(mx<=0)return R;const t=lo*mx;let i=0;
 while(i<n){if(s[i]<=t){i++;continue}let j=i;while(j<n&&s[j]>t)j++;R.push({i,j});i=j}return R}
function lineness(a){const n=a.length,R=runsOf(a,.12).filter(r=>r.j-r.i>=3&&r.j-r.i<=n*.07);if(R.length<6)return 0;const c=R.map(r=>(r.i+r.j)/2),d=[];for(let k=1;k<c.length;k++)d.push(c[k]-c[k-1]);
 let m=0;for(const v of d)m+=v;m/=d.length;let q=0;for(const v of d)q+=(v-m)*(v-m);const cv=Math.sqrt(q/d.length)/(m||1);return Math.min(1,R.length/14)/(1+2.5*cv)}
function upScore(a,skip){skip=skip||0;let A=0,B=0,T=0;for(const r of runsOf(a,.07)){const len=r.j-r.i;if(len<5||len>a.length*.07)continue;let pk=0;for(let k=r.i;k<r.j;k++)if(a[k]>pk)pk=a[k];if(pk<=0)continue;let c0=-1,c1=-1;for(let k=r.i;k<r.j;k++){T+=a[k];if(a[k]>=.5*pk){if(c0<0)c0=k;c1=k}}
  for(let k=r.i;k<c0-skip;k++)A+=a[k];for(let k=c1+1+skip;k<r.j;k++)B+=a[k]}return{u:A+B>0?(A-B)/(A+B):0,q:T>0?(A+B)/T:0}}
const UP_TH=.03,UP_Q=.025;
function orientOf(cv){const k=Math.min(1,1600/Math.max(cv.width,cv.height)),w=Math.max(40,Math.round(cv.width*k)),h=Math.max(40,Math.round(cv.height*k)),c=cvs(w,h),g=c.getContext('2d',{willReadFrequently:true});g.drawImage(cv,0,0,w,h);
 const px=g.getImageData(0,0,w,h).data,L=new Float32Array(w*h);for(let i=0,j=0;i<L.length;i++,j+=4)L[i]=.299*px[j]+.587*px[j+1]+.114*px[j+2];
 const B=boxBlur(Float32Array.from(L),w,h,Math.max(5,Math.round(Math.min(w,h)/20))),R=new Float32Array(h),C=new Float32Array(w);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(L[i]<B[i]*.8){R[y]++;C[x]++}}
 const lr=lineness(R),lc=lineness(C);
 if(lc>lr+.25){const a=upScore(C),b=upScore(Float32Array.from(C).reverse());return (a.q>UP_Q||b.q>UP_Q)&&b.u>a.u?3:1}
 if(lr<.25)return 0;
 const u=upScore(R);return u.u<-UP_TH&&u.q>UP_Q?2:0}

/* ---------- page store ---------- */
const bmOf=async b=>{try{return await createImageBitmap(b,{imageOrientation:'from-image'})}catch(_){try{return await createImageBitmap(b)}catch(__){const im=new Image(),u=URL.createObjectURL(b);im.src=u;await im.decode();return im}}};
/* Keep crop points in the rotated image's coordinates, with the photo underneath them. */
function turnPage(pg,turns){turns=((turns%4)+4)%4;for(let i=0;i<turns;i++){const w=pg.w,h=pg.h,q=pg.quad.map(p=>({x:h-p.y,y:p.x}));pg.quad=[q[3],q[0],q[1],q[2]];pg.w=h;pg.h=w}pg.rot=((pg.rot||0)+turns)%4}
async function pageBitmap(pg){const raw=await bmOf(pg.blob);if(!(pg.rot||0))return raw;const turned=rotQ(raw,pg.rot);if(raw.close)raw.close();return turned}
/* one page -> flat, upright, cleaned picture */
function renderPg(bm,pg,maxLong){return enhance(warp(bm,pg.quad,maxLong),S.mode,S.boost,S.dn)}
async function addSource(src,sw,sh,state=S){const k=Math.min(1,3200/Math.max(sw,sh)),w=Math.round(sw*k),h=Math.round(sh*k),c=cvs(w,h);c.getContext('2d').drawImage(src,0,0,w,h);
 const q=detect(c),quad=q||inset(w,h);let rotation=0;if(state.autoRot){try{rotation=orientOf(warp(c,quad,1600))}catch(_){}}
 const blob=await tb(c,'image/jpeg',.95);if(S!==state)return null;const pg={id:++pgid,blob,w,h,quad,auto:!!q,rot:0};turnPage(pg,rotation);state.pages.push(pg);thumb(pg);return pg}
async function addFiles(fs){for(const f of fs){try{if(f.type=='application/pdf'||/\.pdf$/i.test(f.name)){await loadJs('pdf.min.js');pdfjsLib.GlobalWorkerOptions.workerSrc=pdfWorkerSrc();const doc=await pdfjsLib.getDocument({data:new Uint8Array(await f.arrayBuffer()),isEvalSupported:false}).promise;for(let p=1;p<=doc.numPages;p++){status('Importing '+f.name+' · page '+p+' of '+doc.numPages);const page=await doc.getPage(p),base=page.getViewport({scale:1}),scale=Math.min(5.2,3200/Math.max(base.width,base.height)),vp=page.getViewport({scale}),c=cvs(Math.round(vp.width),Math.round(vp.height));await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;await addSource(c,c.width,c.height)}continue}if(!/^image\//.test(f.type)&&!/\.(jpe?g|png|webp|heic)$/i.test(f.name))continue;const bm=await bmOf(f);await addSource(bm,bm.width,bm.height);bm.close&&bm.close()}catch(e){console.error(e);toast_('Could not open '+f.name)}}}
async function thumb(pg){try{const bm=await pageBitmap(pg),k=Math.min(1,520/Math.max(pg.w,pg.h)),sm=cvs(Math.round(pg.w*k),Math.round(pg.h*k));sm.getContext('2d').drawImage(bm,0,0,sm.width,sm.height);bm.close&&bm.close();
 const o=renderPg(sm,{quad:pg.quad.map(p=>({x:p.x*k,y:p.y*k}))},170);pg.th=o.toDataURL('image/jpeg',.6);strip()}catch(_){}}

/* ---------- saved scans live in the class data + the app file store, so they sync like other attachments ---------- */
const cls=()=>{try{return S&&S.opt.classData||C()}catch(_){return null}};
const libItems=()=>{const c=cls();return c?(c.scans||[]).filter(x=>!x.del).sort((a,b)=>b.t-a.t):[]};
const fmtSz=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(0)+' KB':(n/1048576).toFixed(1)+' MB';
const fmtDt=t=>new Date(t).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
async function libSave(file,pages,th,name,tag){const c=S.opt.classData||cls();if(!c)throw new Error('noclass');const id=uid();await fput(id,file);(c.scans??=[]).push({id,name,size:file.size,type:'application/pdf',pages,t:Date.now(),u:Date.now(),tag:tag||'',th:th||''});mark(c);return id}
async function libBlob(x){return await fget(x.id,x.r,x.type)}

/* ---------- UI ---------- */
function build(){const r=D.createElement('div');r.id='scn';r.setAttribute('role','dialog');r.setAttribute('aria-modal','true');r.setAttribute('aria-label','Scan documents');
 r.innerHTML=`<div class=sc-top><button class=sc-b data-scn=close aria-label=Close>&#x2715;</button><b class=sc-t>Scan documents</b><span class=sc-sp></span><span class=sc-st role=status></span><button class="sc-b sc-sv" data-scn=lib>Saved</button></div>
<div class=sc-cam hidden><video playsinline muted autoplay></video><canvas class=sc-ov></canvas><div class=sc-hint>Lay the page flat. A green outline means the page edges were found.</div>
 <button class="sc-b sc-torch" data-scn=torch hidden>Light</button>
 <div class=sc-modes aria-label="Capture mode"><button class=on data-scn=cam-mode data-v=doc>Document</button><button data-scn=cam-mode data-v=id>ID card</button><button data-scn=cam-mode data-v=book>Book</button><button data-scn=cam-mode data-v=board>Board</button></div>
 <div class=sc-cb><label class="sc-b sc-gal" title="Choose photos or PDF">Photos / PDF<input type=file accept="image/*,application/pdf,.pdf" multiple hidden data-scn=gal></label><button class=sc-shut data-scn=shut aria-label="Take photo"></button><button class="sc-b sc-done" data-scn=done>Done</button></div>
 <div class=sc-fb hidden><p>The camera is not available here. You can still take a photo with your phone's camera app or choose photos you already have.</p>
  <button class="sc-b" type=button data-scn=retry>Try camera again</button>
  <label class="sc-b sc-pri">Take a photo<input type=file accept="image/*" capture=environment hidden data-scn=gal></label><label class=sc-b>Choose photos<input type=file accept="image/*" multiple hidden data-scn=gal></label></div></div>
<div class=sc-ed hidden>
 <div class=sc-stage><canvas class=sc-e></canvas><canvas class=sc-r hidden></canvas><canvas class=sc-lp width=220 height=220 hidden></canvas>
  <button class="sc-nv sc-nl" data-scn=prev aria-label="Previous page">&#x2039;</button><button class="sc-nv sc-nr" data-scn=next aria-label="Next page">&#x203A;</button><span class=sc-cnt></span></div>
 <div class=sc-panel>
  <div class=sc-tools><div class=sc-seg data-seg=view><button data-scn=vcrop class=on>Crop</button><button data-scn=vres>Result</button></div>
   <button class=sc-b data-scn=auto title="Find the page edges and the top again">Auto crop</button><button class=sc-b data-scn=book title="Split an open-book photo into two pages">Split book</button><button class=sc-b data-scn=rl aria-label="Turn left">&#x21BA;</button><button class=sc-b data-scn=rr aria-label="Turn right">&#x21BB;</button><button class=sc-b data-scn=flip aria-label="Upside down" title="Turn upside down">&#x21C5;</button><button class=sc-b data-scn=ml aria-label="Move earlier">&#x25C0;</button><button class=sc-b data-scn=mr aria-label="Move later">&#x25B6;</button><button class="sc-b sc-del" data-scn=del aria-label="Delete page">Delete</button></div>
  <div class=sc-strip></div>
  <div class=sc-opt><div class=sc-row><span>Look</span><div class=sc-seg data-seg=mode></div></div>
   <details class=sc-more><summary>Contrast and PDF options</summary>
   <div class=sc-row><span>Contrast</span><input type=range min=0 max=100 value=50 data-scn=boost aria-label=Contrast></div>
   <label class=sc-chk><input type=checkbox data-scn=dn checked> Reduce grain and fine screen patterns</label>
   <label class=sc-chk><input type=checkbox data-scn=arot checked> Find the top of each page automatically</label>
   <div class=sc-row><span>PDF size</span><div class=sc-seg data-seg=q></div></div>
   <div class=sc-row><span>Page</span><select data-scn=size aria-label="PDF page size"><option value=orig>Same as photo</option><option value=a4>A4</option><option value=letter>Letter</option><option value=legal>Long bond (8.5 x 13 in)</option><option value=id2>ID card · 2 copies, actual card size</option><option value=id4>Passport photos · 4-up A4</option></select></div></details></div>
  <div class=sc-act><button class=sc-b data-scn=add>+ Add page</button><button class=sc-b data-scn=share hidden>Share</button><button class=sc-b data-scn=use hidden>Use for reading</button><button class=sc-b data-scn=save>Download</button><button class="sc-b sc-pri" data-scn=app>Save to app</button></div>
 </div></div>
<div class=sc-lib hidden><div class=sc-libh><b>Saved scans</b><span class=sc-libs></span><button class="sc-b sc-pri" data-scn=newscan>+ New scan</button></div><div class=sc-libl></div></div>
<div class=sc-vw hidden><div class=sc-vwt><button class=sc-b data-scn=vwback>&#x2039; Back</button><b class=sc-vwn></b><button class=sc-b data-scn=vwdl>Download</button></div><div class=sc-vwb></div></div>`;
 const mode=$('[data-seg=mode]',r),q=$('[data-seg=q]',r);MODES.forEach(([k,l])=>{const b=D.createElement('button');b.dataset.scn='mode';b.dataset.v=k;b.textContent=l;mode.appendChild(b)});
 Object.entries(QL).forEach(([k,o])=>{const b=D.createElement('button');b.dataset.scn='q';b.dataset.v=k;b.textContent=o.n;q.appendChild(b)});
 if(!(S.opt&&S.opt.onUse))$('[data-scn=use]',r).remove();
 if(S.opt&&S.opt.onUse){$('[data-scn=app]',r).remove();$('[data-scn=lib]',r).remove();const use=$('[data-scn=use]',r);if(use)use.textContent=S.opt.useLabel||'Use for reading'}
 if(testFrame){$('[data-scn=app]',r).remove();$('[data-scn=lib]',r).remove();const use=$('[data-scn=use]',r);if(use)use.textContent='Save to Scan tab'}
 return r}
const R=s=>$(s,S.root),status=t=>{const e=R('.sc-st');if(e)e.textContent=t||''};
function setTitle(){const n=S.pages.length;R('.sc-t').textContent=S.mode_=='lib'?'Saved scans':'Scan documents'+(n?' \u00B7 '+n+' page'+(n>1?'s':''):'');R('.sc-sv').textContent='Saved ('+libItems().length+')'}
function sync(){R('.sc-seg[data-seg=mode]').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v==S.mode));R('.sc-seg[data-seg=q]').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v==S.q));R('[data-scn=boost]').value=S.boost;R('[data-scn=size]').value=S.size;R('[data-scn=dn]').checked=S.dn;R('[data-scn=arot]').checked=S.autoRot;
 R('[data-scn=boost]').disabled=S.mode=='orig';R('[data-scn=vcrop]').classList.toggle('on',S.view=='crop');R('[data-scn=vres]').classList.toggle('on',S.view=='res');setTitle();cnt()}
function cnt(){if(!S||!S.root)return;const n=S.pages.length,c=R('.sc-cnt');if(c)c.textContent=n?(S.cur+1)+' / '+n:'';const l=R('.sc-nl'),r=R('.sc-nr');if(l){l.hidden=n<2||S.cur<=0;r.hidden=n<2||S.cur>=n-1}}
function strip(){if(!S||!S.root)return;const st=R('.sc-strip');if(!st)return;st.innerHTML=S.pages.map((p,i)=>`<button class="sc-th${i==S.cur?' on':''}" data-i=${i} aria-label="Page ${i+1}">${p.th?`<img src="${p.th}" alt="">`:'<i></i>'}<span>${i+1}</span></button>`).join('')+'<button class="sc-th sc-plus" data-scn=add aria-label="Add page">+</button>';const on=st.querySelector('.on');if(on&&on.scrollIntoView)on.scrollIntoView({block:'nearest',inline:'nearest'});cnt()}
function show(w){S.mode_=w;R('.sc-cam').hidden=w!='cam';R('.sc-ed').hidden=w!='ed';R('.sc-lib').hidden=w!='lib';R('.sc-vw').hidden=true;setTitle()}

/* camera */
function cameraErrorText(e){if(e&&['NotAllowedError','SecurityError'].includes(e.name))return'Camera permission is blocked. Allow camera access for this page in your browser settings, then try again. You can also take or choose a photo below.';
 if(e&&e.name=='NotFoundError')return'No camera was found. Connect or enable a camera, or take or choose a photo below.';
 if(e&&e.name=='NotReadableError')return'The camera could not start. It may be in use by another app; close that app and try again, or take or choose a photo below.';
 if(e&&e.name=='CameraPreviewTimeout')return'The camera connected but did not provide a live preview. Check browser camera permission, then retry or take or choose a photo below.';
 return'The camera could not start. Check browser camera permission and try again, or take or choose a photo below.'}
function waitForVideo(v,ms=10000){return new Promise((resolve,reject)=>{let timer;const clean=()=>{clearTimeout(timer);v.removeEventListener('loadedmetadata',ready);v.removeEventListener('loadeddata',ready);v.removeEventListener('playing',ready);v.removeEventListener('error',failed)};const finish=(fn,value)=>{clean();fn(value)};const ready=()=>{if(v.videoWidth&&v.videoHeight)finish(resolve)};const failed=()=>finish(reject,new Error('Camera preview failed'));v.addEventListener('loadedmetadata',ready);v.addEventListener('loadeddata',ready);v.addEventListener('playing',ready);v.addEventListener('error',failed);timer=setTimeout(()=>{const e=new Error('Camera preview timed out');e.name='CameraPreviewTimeout';finish(reject,e)},ms);ready()})}
async function camStart(){camStop();show('cam');camLabels();const state=S,fb=R('.sc-fb'),message=fb.querySelector('p');message.textContent='Starting camera… Allow camera access if your browser asks. If the preview stays black, take a photo or choose photos below.';fb.hidden=false;
 if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){message.textContent='Camera access is unavailable in this browser or page. You can still take or choose a photo below.';fb.hidden=false;return}
 let stream;
 try{try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:3840},height:{ideal:2160}},audio:false})}
  catch(e){if(!e||!['OverconstrainedError','ConstraintNotSatisfiedError','TypeError'].includes(e.name))throw e;console.info('Camera constraints unavailable; retrying with default video settings',e);stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false})}
  if(S!==state||state.mode_!='cam'){stream.getTracks().forEach(t=>t.stop());return}
  state.stream=stream;const v=R('video');v.srcObject=stream;const preview=waitForVideo(v);await Promise.race([v.play(),preview]);await preview;if(S!==state||state.mode_!='cam'){stream.getTracks().forEach(t=>t.stop());return}fb.hidden=true;
  const tr=stream.getVideoTracks()[0],cap=tr&&tr.getCapabilities?tr.getCapabilities():{};try{state.imageCapture=tr&&typeof ImageCapture=='function'?new ImageCapture(tr):null}catch(_){state.imageCapture=null}R('[data-scn=torch]').hidden=!cap.torch;
  state.tick=setInterval(live,320)}catch(e){console.warn(e);if(S===state){message.textContent=cameraErrorText(e);fb.hidden=false}}}
function camStop(){if(!S)return;clearInterval(S.tick);S.tick=0;S.imageCapture=null;if(S.stream){S.stream.getTracks().forEach(t=>t.stop());S.stream=null}const v=S.root&&R('video');if(v)v.srcObject=null}
function camLabels(){const d=R('[data-scn=done]');d.textContent=S.pages.length?'Done ('+S.pages.length+')':'Cancel'}
function live(){if(!S||S.mode_!='cam')return;const v=R('video'),ov=R('.sc-ov');if(!v||v.readyState<2||!v.videoWidth)return;const cw=ov.clientWidth,ch=ov.clientHeight,dpr=Math.min(2,devicePixelRatio||1);if(ov.width!=cw*dpr||ov.height!=ch*dpr){ov.width=cw*dpr;ov.height=ch*dpr}
 const g=ov.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,cw,ch);const q=detect(v,1);S.liveQ=q;if(!q)return;
 const k=Math.min(cw/v.videoWidth,ch/v.videoHeight),ox=(cw-v.videoWidth*k)/2,oy=(ch-v.videoHeight*k)/2;g.beginPath();q.forEach((p,i)=>{const x=ox+p.x*k,y=oy+p.y*k;i?g.lineTo(x,y):g.moveTo(x,y)});g.closePath();g.fillStyle='rgba(52,211,153,.18)';g.fill();g.lineWidth=3;g.strokeStyle='#34d399';g.stroke()}
async function shoot(){const state=S,v=R('video');if(!v||!v.videoWidth||state.busy)return;state.busy=1;let src=null;try{let sw=0,sh=0;if(state.imageCapture){try{const blob=await state.imageCapture.takePhoto();src=await bmOf(blob);sw=src.width;sh=src.height}catch(e){console.debug('Native still capture unavailable; using camera frame',e)}}if(S!==state||state.mode_!='cam')return;if(!src){const c=cvs(v.videoWidth,v.videoHeight);c.getContext('2d').drawImage(v,0,0);src=c;sw=c.width;sh=c.height}const cam=R('.sc-cam');cam.classList.add('flash');setTimeout(()=>cam.classList.remove('flash'),120);if(navigator.vibrate)navigator.vibrate(20);
  await addSource(src,sw,sh,state);if(S!==state)return;state.cur=state.pages.length-1;camLabels();setTitle()}finally{if(src&&src.close)src.close();if(S===state)state.busy=0}}

/* editor */
async function openEditor(i){camStop();S.cur=clamp(i==null?S.cur:i,0,S.pages.length-1);show('ed');sync();strip();await loadCur()}
async function loadCur(){const pg=S.pages[S.cur];if(!pg)return;if(S.bm&&S.bm.close)S.bm.close();S.bm=await pageBitmap(pg);S.handle=-1;layout();if(S.view=='res')await showRes();else draw();cnt()}
const vis=()=>S.view=='res'?R('.sc-r'):R('.sc-e');
async function go(i,dir,swipeEntry){if(!S||i<0||i>=S.pages.length||i==S.cur||S.navBusy)return;S.navBusy=1;try{S.cur=i;strip();await loadCur();const el=vis();if(el.animate&&dir){const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,start=swipeEntry?dir*R('.sc-stage').clientWidth:dir*58,animation=el.animate([{transform:'translate3d('+start+'px,0,0)',opacity:.2},{transform:'translate3d(0,0,0)',opacity:1}],{duration:reduced?1:230,easing:'cubic-bezier(.22,.8,.2,1)',fill:'forwards'});try{await animation.finished}catch(_){}el.style.transform='';el.style.opacity='';animation.cancel()}}finally{S.navBusy=0}}
function geom(){const c=R('.sc-e'),st=R('.sc-stage'),w=st.clientWidth,h=st.clientHeight,pg=S.pages[S.cur],dpr=Math.min(2,devicePixelRatio||1);if(!pg)return null;
 const pad=22,k=Math.min((w-pad*2)/pg.w,(h-pad*2)/pg.h),ox=(w-pg.w*k)/2,oy=(h-pg.h*k)/2;return{c,w,h,k,ox,oy,dpr,pg}}
function layout(){const G=geom();if(!G)return;const{c,w,h,dpr}=G;c.style.width=w+'px';c.style.height=h+'px';c.width=Math.round(w*dpr);c.height=Math.round(h*dpr)}
function draw(){const G=geom();if(!G||!S.bm)return;const{c,w,h,k,ox,oy,dpr,pg}=G,g=c.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,w,h);
 g.drawImage(S.bm,ox,oy,pg.w*k,pg.h*k);g.fillStyle='rgba(8,12,22,.55)';g.fillRect(ox,oy,pg.w*k,pg.h*k);
 const Q=pg.quad.map(p=>({x:ox+p.x*k,y:oy+p.y*k}));g.save();g.beginPath();Q.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.clip();g.drawImage(S.bm,ox,oy,pg.w*k,pg.h*k);g.restore();
 g.beginPath();Q.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.lineWidth=2.5;g.strokeStyle='#34d399';g.stroke();
 /* the page's top edge is drawn in amber with a TOP tag, so the person can see which way is up */
 {const a=Q[0],b=Q[1],mx=(a.x+b.x)/2,my=(a.y+b.y)/2,cx=(Q[0].x+Q[1].x+Q[2].x+Q[3].x)/4,cy=(Q[0].y+Q[1].y+Q[2].y+Q[3].y)/4;
  g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.lineWidth=5;g.strokeStyle='#fbbf24';g.stroke();
  const dx=cx-mx,dy=cy-my,L=Math.hypot(dx,dy)||1,tx=mx+dx/L*18,ty=my+dy/L*18;g.font='700 11px system-ui,sans-serif';const tw=g.measureText('TOP').width+12;g.fillStyle='#fbbf24';g.beginPath();g.roundRect?g.roundRect(tx-tw/2,ty-9,tw,18,9):g.rect(tx-tw/2,ty-9,tw,18);g.fill();g.fillStyle='#3a2a00';g.textAlign='center';g.textBaseline='middle';g.fillText('TOP',tx,ty+.5)}
 Q.forEach((p,i)=>{g.beginPath();g.arc(p.x,p.y,i==S.handle?15:11,0,7);g.fillStyle='rgba(255,255,255,.95)';g.fill();g.lineWidth=3;g.strokeStyle='#10b981';g.stroke()})}
function lens(i){const G=geom(),lp=R('.sc-lp');if(!G||!S.bm||i<0){lp.hidden=true;return}const pg=G.pg,p=pg.quad[i],g=lp.getContext('2d'),R_=lp.width,z=3,sr=R_/z/2;lp.hidden=false;
 const left=(G.ox+p.x*G.k)<G.w/2;lp.style.left=left?'auto':'8px';lp.style.right=left?'8px':'auto';
 g.clearRect(0,0,R_,R_);g.save();g.beginPath();g.arc(R_/2,R_/2,R_/2-2,0,7);g.clip();g.fillStyle='#000';g.fillRect(0,0,R_,R_);g.drawImage(S.bm,p.x-sr,p.y-sr,sr*2,sr*2,0,0,R_,R_);g.restore();
 g.strokeStyle='#34d399';g.lineWidth=2;g.beginPath();g.moveTo(R_/2-14,R_/2);g.lineTo(R_/2+14,R_/2);g.moveTo(R_/2,R_/2-14);g.lineTo(R_/2,R_/2+14);g.stroke();g.beginPath();g.arc(R_/2,R_/2,R_/2-2,0,7);g.lineWidth=3;g.strokeStyle='#fff';g.stroke()}
let rt=0;async function showRes(){const pg=S.pages[S.cur];if(!pg)return;const tk=++rt;status('Preparing…');await new Promise(r=>setTimeout(r,0));const bm=S.bm||await pageBitmap(pg);if(tk!=rt)return;
 const o=renderPg(bm,pg,2200),rc=R('.sc-r');rc.width=o.width;rc.height=o.height;rc.getContext('2d').drawImage(o,0,0);if(tk==rt)status('')}
function setView(v){S.view=v;R('.sc-e').hidden=v=='res';R('.sc-r').hidden=v!='res';sync();if(v=='res')showRes();else{layout();draw()}}
async function refreshLook(){thumbAll();if(S.view=='res')showRes()}
let tt=0;function thumbAll(){clearTimeout(tt);tt=setTimeout(async()=>{for(const p of S.pages)await thumb(p)},250)}
function pointer(e){const G=geom();if(!G)return null;const r=G.c.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top,G}}
async function autoDetect(pg){const bm=await pageBitmap(pg),q=detect(bm);pg.quad=q||inset(pg.w,pg.h);pg.auto=!!q;if(S.autoRot){try{turnPage(pg,orientOf(warp(bm,pg.quad,1600)))}catch(_){}}bm.close&&bm.close();return !!q}
async function splitBook(){const pg=S.pages[S.cur];if(!pg)return;status('Splitting the spread…');await new Promise(r=>setTimeout(r,0));const bm=await pageBitmap(pg),flat=warp(bm,pg.quad,3200);bm.close&&bm.close();const mid=Math.round(flat.width/2),parts=[];
 for(const [x,w] of [[0,mid],[mid,flat.width-mid]]){const c=cvs(w,flat.height);c.getContext('2d').drawImage(flat,x,0,w,flat.height,0,0,w,flat.height);parts.push({id:++pgid,blob:await tb(c,'image/jpeg',.95),w,h:flat.height,quad:inset(w,flat.height),auto:false,rot:0})}
 S.pages.splice(S.cur,1,...parts);S.cur=Math.min(S.cur,S.pages.length-2);for(const p of parts)thumb(p);strip();await loadCur();status('Spread split into two pages')}

/* saved scans screen */
function libHtml(){const L=libItems();R('.sc-libs').textContent=L.length?L.length+' file'+(L.length>1?'s':''):'';
 R('.sc-libl').innerHTML=L.length?L.map(x=>`<div class=sc-li><button class=sc-lt data-scn=la data-la=view data-lid=${x.id} aria-label="Open ${esc(x.name)}">${x.th?`<img src="${x.th}" alt="">`:'<i></i>'}</button><div class=sc-lm><b>${esc(x.name)}</b><small>${x.pages} page${x.pages>1?'s':''} · ${fmtSz(x.size)} · ${fmtDt(x.t)}${x.tag?' · '+esc(x.tag):''}</small><small class=sc-ok>Saved locally in this browser profile</small>
  <div class=sc-lb><button class=sc-b data-scn=la data-la=view data-lid=${x.id}>Open</button>${S.opt.onUse?`<button class=sc-b data-scn=la data-la=use data-lid=${x.id}>Use for reading</button>`:''}<button class=sc-b data-scn=la data-la=split data-lid=${x.id}>Split PDF</button><button class=sc-b data-scn=la data-la=dl data-lid=${x.id}>Download</button><button class=sc-b data-scn=la data-la=ren data-lid=${x.id}>Rename</button><button class="sc-b sc-del" data-scn=la data-la=del data-lid=${x.id}>Delete</button></div></div></div>`).join(''):`<div class=sc-empty><p>No saved scans yet.</p><p class=sc-mut>Scan or import pages, then choose <b>Save to app</b>. Saved PDFs stay in this browser profile.</p></div>`}
function showLib(){camStop();show('lib');libHtml()}
async function splitSavedPdf(x,blob){await loadJs('pdf.min.js');pdfjsLib.GlobalWorkerOptions.workerSrc=pdfWorkerSrc();const doc=await pdfjsLib.getDocument({data:new Uint8Array(await blob.arrayBuffer()),isEvalSupported:false}).promise,base=x.name.replace(/\.pdf$/i,'');for(let p=1;p<=doc.numPages;p++){status('Splitting page '+p+' of '+doc.numPages+'…');const page=await doc.getPage(p),vp=page.getViewport({scale:Math.min(5.2,3000/Math.max(page.getViewport({scale:1}).width,page.getViewport({scale:1}).height))}),c=cvs(Math.round(vp.width),Math.round(vp.height));await page.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;const jpg=await tb(c,'image/jpeg',.9),entry={w:c.width,h:c.height,j:new Uint8Array(await jpg.arrayBuffer())},name=base+'-page-'+String(p).padStart(2,'0')+'.pdf',pdf=buildPdf([entry],'orig',name);await libSave(new File([pdf],name,{type:'application/pdf'}),1,c.toDataURL('image/jpeg',.5),name,'Split page')}showLib();toast_('Created '+doc.numPages+' single-page PDFs in Saved scans.')}
async function libAct(a,id){const c=cls(),x=c&&(c.scans||[]).find(y=>y.id==id&&!y.del);if(!x)return;
 if(a=='ren'){const n=prompt('Rename this scan',x.name);if(n==null||!n.trim())return;x.name=n.trim().slice(0,120);x.u=Date.now();mark(c);libHtml();return}
 if(a=='del'){if(!confirm('Delete "'+x.name+'" from this browser?'))return;fdel(x.id);Object.keys(x).forEach(k=>{if(k!='id')delete x[k]});x.del=1;x.u=Date.now();mark(c);libHtml();setTitle();return}
 status('Opening…');let bl=null;try{bl=await libBlob(x)}catch(e){console.error(e)}status('');
 if(!bl){toast_(typeof fwhy=='function'?fwhy():'This file could not be opened yet. Connect to the internet and try again.');return}
 if(a=='dl'){dl(bl,x.name);return}
 if(a=='split'){try{await splitSavedPdf(x,bl)}catch(e){console.error(e);toast_('Could not split this PDF.')}return}
 if(a=='use'){const fn=S.opt.onUse;if(!fn)return;const f=new File([bl],x.name.replace(/\.pdf$/i,'')+'.pdf',{type:'application/pdf'});close(true);fn(f);return}
 if(a=='view'){S.vwItem=x;S.vwBlob=bl;const vw=R('.sc-vw');R('.sc-vwn').textContent=x.name;const b=R('.sc-vwb');b.innerHTML='<p class=sc-mut style="padding:1rem">Loading…</p>';vw.hidden=false;try{await viewInto(b,bl,x.name+'.pdf',x.id)}catch(e){console.error(e);b.innerHTML='<p class=sc-mut style="padding:1rem">The preview could not be shown here. Use Download.</p>'}}}
function dl(blob,name){const u=URL.createObjectURL(blob),l=D.createElement('a');l.href=u;l.download=/\.pdf$/i.test(name)?name:name+'.pdf';D.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(u),30000)}

function wire(){const r=S.root,e=R('.sc-e'),st=R('.sc-stage');
 e.addEventListener('pointerdown',ev=>{if(S.view!='crop')return;const P=pointer(ev);if(!P)return;const{G}=P;let bi=-1,bd=44*44;G.pg.quad.forEach((q,i)=>{const dx=G.ox+q.x*G.k-P.x,dy=G.oy+q.y*G.k-P.y,d=dx*dx+dy*dy;if(d<bd){bd=d;bi=i}});if(bi<0)return;S.handle=bi;S.dragOff={x:G.ox+G.pg.quad[bi].x*G.k-P.x,y:G.oy+G.pg.quad[bi].y*G.k-P.y};e.setPointerCapture(ev.pointerId);ev.preventDefault();draw();lens(bi)});
 e.addEventListener('pointermove',ev=>{if(S.handle<0)return;const P=pointer(ev);if(!P)return;const{G}=P,x=(P.x+S.dragOff.x-G.ox)/G.k,y=(P.y+S.dragOff.y-G.oy)/G.k;G.pg.quad[S.handle]={x:clamp(x,0,G.pg.w),y:clamp(y,0,G.pg.h)};G.pg.auto=false;draw();lens(S.handle)});
 const up=()=>{if(S.handle<0)return;S.handle=-1;lens(-1);draw();thumb(S.pages[S.cur])};e.addEventListener('pointerup',up);e.addEventListener('pointercancel',up);
 /* swipe left / right anywhere on the page area to go to the next / previous page */
 st.addEventListener('pointerdown',ev=>{if(ev.target.closest('.sc-nv')||S.handle>=0||S.navBusy)return;S.sw={x:ev.clientX,y:ev.clientY,t:performance.now(),act:0,id:ev.pointerId}});
 st.addEventListener('pointermove',ev=>{const w=S.sw;if(!w||ev.pointerId!=w.id)return;const dx=ev.clientX-w.x,dy=ev.clientY-w.y;if(!w.act){if(S.handle<0&&Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.35){w.act=1;try{st.setPointerCapture(ev.pointerId)}catch(_){}}else return}ev.preventDefault();
  const dir=dx<0?1:-1,canMove=dir>0?S.cur<S.pages.length-1:S.cur>0,visualDx=(canMove?dx:dx*.22)*.92,el=vis();el.style.transform='translate3d('+visualDx+'px,0,0)';el.style.opacity=String(1-Math.min(.45,Math.abs(visualDx)/700))});
 const swEnd=async ev=>{const w=S.sw;if(!w||ev.pointerId!=w.id)return;S.sw=null;if(!w.act)return;const dx=ev.clientX-w.x,v=Math.abs(dx)/Math.max(1,performance.now()-w.t),el=vis(),dir=dx<0?1:-1,ni=S.cur+dir,canMove=ni>=0&&ni<S.pages.length,fire=canMove&&(Math.abs(dx)>Math.min(105,st.clientWidth*.2)||v>.5),fromX=(canMove?dx:dx*.22)*.92,reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;if(fire)S.navBusy=true;
  if(el.animate){const endX=fire?(dir<0?st.clientWidth:-st.clientWidth):0,frames=[{transform:'translate3d('+fromX+'px,0,0)',opacity:.8},{transform:'translate3d('+endX+'px,0,0)',opacity:fire?0:1}],animation=el.animate(frames,{duration:reduced?1:(fire?145:190),easing:'cubic-bezier(.22,.8,.2,1)',fill:'forwards'});try{await animation.finished}catch(_){}el.style.transform='translate3d('+endX+'px,0,0)';el.style.opacity=fire?'0':'1';animation.cancel()}
  if(fire&&S){S.navBusy=false;await go(ni,dir,true)}else{el.style.transform='';el.style.opacity=''}};
 st.addEventListener('pointerup',swEnd);st.addEventListener('pointercancel',swEnd);
 r.addEventListener('change',async ev=>{const t=ev.target,a=t.dataset.scn;if(a=='gal'){const fs=[...t.files];t.value='';if(!fs.length)return;status('Reading photos…');await addFiles(fs);status('');S.cur=S.pages.length-1;if(S.pages.length)await openEditor(S.cur);return}
  if(a=='boost'){S.boost=+t.value;refreshLook()}if(a=='size')S.size=t.value;if(a=='dn'){S.dn=t.checked;refreshLook()}if(a=='arot')S.autoRot=t.checked});
 r.addEventListener('input',ev=>{if(ev.target.dataset.scn=='boost'){S.boost=+ev.target.value;refreshLook()}});
 r.addEventListener('click',async ev=>{const b=ev.target.closest('button');if(!b||b.disabled)return;const a=b.dataset.scn;
  if(b.classList.contains('sc-th')&&b.dataset.i!=null){const i=+b.dataset.i;return go(i,i>S.cur?1:-1)}
  if(a=='close')return close();
  if(a=='cam-mode'){
   S.camMode=b.dataset.v;
   S.size=S.camMode=='id'?'id2':'orig';
   S.mode=S.camMode=='board'?'board':'magic';
   R('.sc-modes').querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));
   R('.sc-hint').textContent=S.camMode=='book'?'Capture a spread, then choose Split book in the editor.':S.camMode=='id'?'Capture the card, then finish an A4 ID print sheet.':S.camMode=='board'?'Point at the board. Board contrast will be selected in the editor.':'Lay the page flat. A green outline means the page edges were found.';
   return
  }
  if(a=='shut')return shoot();
  if(a=='retry')return camStart();
  if(a=='done'){if(!S.pages.length)return close(true);return openEditor(S.cur)}
  if(a=='torch'){S.torch=!S.torch;try{await S.stream.getVideoTracks()[0].applyConstraints({advanced:[{torch:S.torch}]})}catch(_){}return}
  if(a=='add')return camStart();
  if(a=='prev')return go(S.cur-1,-1);if(a=='next')return go(S.cur+1,1);
  if(a=='vcrop')return setView('crop');if(a=='vres')return setView('res');
  if(a=='auto'){const pg=S.pages[S.cur];status('Looking for the page…');const ok=await autoDetect(pg);status('');if(!ok)toast_('Could not find the page edges. Drag the corners instead.');await loadCur();thumb(pg);return}
  if(a=='book')return splitBook();
  if(a=='rl'||a=='rr'||a=='flip'){const pg=S.pages[S.cur];turnPage(pg,a=='rr'?1:a=='rl'?3:2);await loadCur();thumb(pg);return}
  if(a=='ml'||a=='mr'){const i=S.cur,j=i+(a=='mr'?1:-1);if(j<0||j>=S.pages.length)return;[S.pages[i],S.pages[j]]=[S.pages[j],S.pages[i]];S.cur=j;strip();return}
  if(a=='del'){if(!confirm('Delete page '+(S.cur+1)+'?'))return;S.pages.splice(S.cur,1);if(!S.pages.length)return camStart();S.cur=Math.min(S.cur,S.pages.length-1);sync();strip();return loadCur()}
  if(a=='mode'){S.mode=b.dataset.v;sync();return refreshLook()}
  if(a=='q'){S.q=b.dataset.v;sync();return}
  if(a=='lib')return showLib();
  if(a=='newscan'){S.pages=[];S.cur=0;return camStart()}
  if(a=='la')return libAct(b.dataset.la,b.dataset.lid);
  if(a=='vwback'){const box=R('.sc-vwb');if(box.dataset.objectUrl)URL.revokeObjectURL(box.dataset.objectUrl);box.dataset.objectUrl='';R('.sc-vw').hidden=true;return}
  if(a=='vwdl'){if(S.vwBlob)dl(S.vwBlob,S.vwItem.name);return}
  if(a=='save'||a=='share'||a=='use'||a=='app')return output(a)});
 addEventListener('resize',onResize);D.addEventListener('keydown',onKey,true)}
function onResize(){if(!S||S.mode_!='ed')return;layout();S.view=='crop'?draw():0}
function onKey(e){if(!S)return;if(e.key=='Escape'){e.stopPropagation();if(!R('.sc-vw').hidden){const box=R('.sc-vwb');if(box.dataset.objectUrl)URL.revokeObjectURL(box.dataset.objectUrl);box.dataset.objectUrl='';R('.sc-vw').hidden=true;return}close();return}
 if(S.mode_=='ed'&&!/INPUT|SELECT|TEXTAREA/.test((D.activeElement||{}).tagName||'')){if(e.key=='ArrowRight'){e.preventDefault();go(S.cur+1,1)}else if(e.key=='ArrowLeft'){e.preventDefault();go(S.cur-1,-1)}}}
function printLayout(src,mode){const copies=mode=='id4'?4:2,W=1240,H=1754,dpi=150,card=mode=='id2',slotW=(card?85.6:35)*dpi/25.4,slotH=(card?54:45)*dpi/25.4,cols=card?1:2,rows=2,c=cvs(W,H),g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,W,H);g.setLineDash([9,8]);g.strokeStyle='#aab2bc';g.lineWidth=2;
 for(let i=0;i<copies;i++){const col=i%cols,row=Math.floor(i/cols),cx=W/2+(col-(cols-1)/2)*(slotW+90),cy=H/2+(row-(rows-1)/2)*(slotH+120),scale=Math.min(slotW/src.width,slotH/src.height),w=src.width*scale,h=src.height*scale,x=cx-w/2,y=cy-h/2;g.drawImage(src,x,y,w,h);g.strokeRect(x,y,w,h)}return c}
async function output(a){if(!S.pages.length||S.busy)return;
 let name0=null;const stamp=(()=>{const d=new Date(),z=n=>String(n).padStart(2,'0');return d.getFullYear()+z(d.getMonth()+1)+z(d.getDate())+'-'+z(d.getHours())+z(d.getMinutes())})();
 if(a=='app'){if(!cls()){toast_('Open a class first, then scan, so the scan can be saved with it.');return}const def=(S.opt.tag?S.opt.tag+' scan ':'Scan ')+fmtDt(Date.now());name0=prompt('Name this scan',def);if(name0==null)return;name0=name0.trim()||def}
 S.busy=1;const bs=S.root.querySelectorAll('.sc-act button');bs.forEach(x=>x.disabled=true);
 try{const O=QL[S.q],P=[];let thumbUrl='';for(let i=0;i<S.pages.length;i++){status('Page '+(i+1)+' of '+S.pages.length+'…');await new Promise(r=>setTimeout(r,0));const pg=S.pages[i],bm=await pageBitmap(pg);let o=renderPg(bm,pg,O.m);bm.close&&bm.close();if(S.size=='id2'||S.size=='id4')o=printLayout(o,S.size);
   if(i==0){const k=150/Math.max(o.width,o.height),t=cvs(Math.round(o.width*k),Math.round(o.height*k));t.getContext('2d').drawImage(o,0,0,t.width,t.height);thumbUrl=t.toDataURL('image/jpeg',.6)}
   const bl=await tb(o,'image/jpeg',O.q);P.push({w:o.width,h:o.height,j:new Uint8Array(await bl.arrayBuffer())})}
  const name=(testFileName||'Scan-'+stamp)+'.pdf',pdf=buildPdf(P,S.size,(name0||name).replace(/\.pdf$/i,'')),mb=fmtSz(pdf.size),file=new File([pdf],name,{type:'application/pdf'});
  if(a=='app'){await libSave(file,P.length,thumbUrl,name0,S.opt.tag);toast_('Saved to the app: '+name0+' ('+P.length+' page'+(P.length>1?'s':'')+', '+mb+')');S.pages=[];S.cur=0;status('');showLib();return}
  if(a=='use'&&S.opt.onUse){const fn=S.opt.onUse,details={pages:P.length,thumbnail:thumbUrl};close(true);fn(file,details);toast_('Scan added: '+P.length+' page'+(P.length>1?'s':'')+', '+mb);return}
  if(a=='share'){try{await navigator.share({files:[file],title:name});status('')}catch(e){if(e&&e.name!='AbortError')toast_('Sharing is not available. Use Download.')}}
  else{dl(pdf,name);toast_('Downloaded '+name+' ('+P.length+' page'+(P.length>1?'s':'')+', '+mb+')')}
  status(P.length+' page'+(P.length>1?'s':'')+' \u00B7 '+mb)}
 catch(e){console.error(e);toast_('Could not make the PDF.');status('')}
 finally{if(S){S.busy=0;bs.forEach(x=>x.disabled=false)}}}
function close(force){if(!S)return;if(!force&&S.pages.length&&!confirm('Discard '+S.pages.length+' scanned page'+(S.pages.length>1?'s':'')+' that are not saved?'))return;camStop();const box=R('.sc-vwb');if(box&&box.dataset.objectUrl)URL.revokeObjectURL(box.dataset.objectUrl);removeEventListener('resize',onResize);D.removeEventListener('keydown',onKey,true);if(S.bm&&S.bm.close)S.bm.close();S.root.remove();D.documentElement.classList.remove('sc-lock');S=null;if(testFrame&&!force)parent.postMessage({type:'gradu-test-scan-close'},location.origin)}

window.scnOpen=async function(opt){if(D.getElementById('scn'))return;S={pages:[],cur:0,q:'b',size:'orig',mode:'magic',boost:50,view:'crop',dn:true,autoRot:true,opt:opt||{},handle:-1};
 S.root=build();D.body.appendChild(S.root);if(innerWidth>=900&&innerHeight>=700)R('.sc-more').open=true;D.documentElement.classList.add('sc-lock');wire();sync();strip();if(S.opt.lib)showLib();else if(S.opt.initialFiles){show('ed');status('Importing files…');await addFiles(S.opt.initialFiles);if(S.pages.length)await openEditor(0);else camStart()}else camStart()};
window.scnCount=classData=>libItems(classData).length;
window.scnApi={detect,warp,enhance,buildPdf,solveH,orientOf,rotQ,denoise,get state(){return S}};
if(testFrame)window.scnOpen({onUse:(file,details)=>{file.arrayBuffer().then(buffer=>parent.postMessage({type:'gradu-test-scan-result',name:file.name,pages:details.pages,thumbnail:details.thumbnail,buffer},location.origin,[buffer])).catch(error=>{console.error(error);parent.postMessage({type:'gradu-test-scan-error'},location.origin)})}});
})();

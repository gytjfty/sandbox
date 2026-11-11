#version 300 es
precision highp float;
precision highp int;
in vec2 screen;
out vec4 color;
uniform sampler2D tree,objects;
uniform int treeWidth,nodeCount,editCount,objectCount;
uniform vec3 cam,up,forward,right,viewUp;
uniform float altitude,aspect,tanHalf;
const float R=6371000.0;
vec4 dataAt(int i){return texelFetch(tree,ivec2(i%treeWidth,i/treeWidth),0);}
float eps(float t){return max(.002,abs(t)*.0000002);}
bool solidAt(vec3 p,bool base){int node=0,latest=0;bool solid=base;while(node<nodeCount){vec4 lo=dataAt(node*3),hi=dataAt(node*3+1);if(any(lessThan(p,lo.xyz))||any(greaterThan(p,hi.xyz))){node=int(lo.w+.5);continue;}if(hi.w<.5){node++;continue;}vec4 s=dataAt(node*3+2);vec3 d=p-s.xyz;int order=int(hi.w+.5);if(order>latest&&(!(fract(hi.w)>.125)||base)&&dot(d,d)<=s.w*s.w){latest=order;solid=s.w<0.0;}node++;}return solid;}
bool nextBoundary(vec3 ray,float after,inout float best,inout vec3 normal){bool found=false;int node=0;vec3 inv=mix(vec3(-1),vec3(1),greaterThanEqual(ray,vec3(0)))/max(abs(ray),vec3(1e-20));while(node<nodeCount){vec4 lo=dataAt(node*3),hi=dataAt(node*3+1);vec3 a=(lo.xyz-cam)*inv,b=(hi.xyz-cam)*inv,low=min(a,b),high=max(a,b);float enter=max(max(low.x,low.y),low.z),exit=min(min(high.x,high.y),high.z);if(exit<max(enter,after+eps(after))||enter>best){node=int(lo.w+.5);continue;}if(hi.w<.5){node++;continue;}vec4 s=dataAt(node*3+2);vec3 c=s.xyz-cam;float along=dot(c,ray);vec3 p=c-ray*along;float h=s.w*s.w-dot(p,p);if(h>=0.0){float root=sqrt(h),t=along-root;if(t<=after+eps(after))t=along+root;if(t>after+eps(after)&&t<best){best=t;normal=normalize(cam+ray*t-s.xyz);if(dot(normal,ray)>0.0)normal=-normal;found=true;}}node++;}return found;}
bool trace(vec3 ray,out float t,out vec3 normal,out bool changed){float b=(R+altitude)*dot(up,ray),c=altitude*(2.0*R+altitude),h=b*b-c;bool planet=h>=0.0;float nearT=1e30,farT=-1e30;if(planet){float root=sqrt(max(0.0,h));farT=-b+root;nearT=c>0.0&&b<0.0?c/max(-b+root,.000001):-b-root;if(farT<.02)planet=false;}t=.02;changed=true;normal=-ray;if(solidAt(cam+ray*t,planet&&t>=nearT&&t<=farT))return true;
 for(int event=0;event<editCount*2+4;event++){float best=1e30;vec3 n=vec3(0);bool found=false,pb=false;if(planet){float candidate=nearT>t+eps(t)?nearT:farT;if(candidate>t+eps(t)){best=candidate;n=normalize(up*(R+altitude)+ray*best);if(dot(n,ray)>0.0)n=-n;found=true;pb=true;}}if(nextBoundary(ray,t,best,n)){found=true;pb=false;}if(!found)return false;t=best;float st=t+eps(t);if(solidAt(cam+ray*st,planet&&st>=nearT&&st<=farT)){normal=n;changed=!pb;return true;}}return false;}
vec3 shade(vec3 base,vec3 n,vec3 ray,float t){float sun=max(0.0,dot(n,normalize(vec3(1,.6,1)))),lamp=max(0.0,dot(n,-ray))/(1.0+t*t*.008);vec3 v=base*(vec3(.22)+vec3(.7,.64,.55)*sun+vec3(1.2,1.05,.85)*lamp);return pow(v/(v+vec3(.65)),vec3(1.0/2.2));}
void main(){vec3 ray=normalize(forward+right*(screen.x*aspect*tanHalf)+viewUp*(screen.y*tanHalf));float t;vec3 n;bool changed;bool hit=trace(ray,t,n,changed);vec3 result=vec3(.006,.008,.014);float depth=hit?t:1e30;if(hit){vec3 base=vec3(.32,.28,.22);if(!changed){float b=sin(n.x*17.0+sin(n.z*23.0)*2.0)+sin(n.y*29.0+n.z*11.0)*.45;base=mix(vec3(.18,.23,.12),vec3(.34,.32,.20),smoothstep(-.7,.9,b));}result=shade(base,n,ray,t);}
 float opaque=depth,ghost=1e30;vec3 on=vec3(0),oc=vec3(0),gn=vec3(0),gc=vec3(0);float ga=0.0;
 for(int i=0;i<objectCount;i++){vec4 s=texelFetch(objects,ivec2(i*2,0),0),info=texelFetch(objects,ivec2(i*2+1,0),0);vec3 c=s.xyz-cam;float a=dot(c,ray);vec3 p=c-ray*a;float h=s.w*s.w-dot(p,p);if(h<0.0)continue;float root=sqrt(h),d=a-root;if(d<.02)d=a+root;if(d<.02)continue;vec3 sn=normalize(cam+ray*d-s.xyz);if(info.w>.99){if(d<opaque){opaque=d;on=sn;oc=info.xyz;}}else if(d<ghost){ghost=d;gn=sn;gc=info.xyz;ga=info.w;}}
 if(opaque<depth){result=shade(oc,on,ray,opaque);depth=opaque;}if(ghost<depth){float rim=pow(1.0-abs(dot(gn,ray)),2.0);result=mix(result,gc,min(.9,ga+rim*.35));}color=vec4(result,1);}

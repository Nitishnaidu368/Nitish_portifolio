// rotating specialty words
const words=["agentic AI systems","backend microservices","full-stack products","cloud-native infra","MCP orchestration"];
let wi=0,ci=0,del=false;
const rotor=document.getElementById('rotor');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function type(){
  const w=words[wi];
  rotor.textContent=w.slice(0,ci);
  if(!del){ci++; if(ci>w.length){del=true;setTimeout(type,1700);return}}
  else{ci--; if(ci===0){del=false;wi=(wi+1)%words.length}}
  setTimeout(type,del?34:70);
}
if(rotor){if(reduced){rotor.textContent=words[0]}else{type()}}

// scroll reveal
const io=new IntersectionObserver(es=>{
  es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}});
},{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

// cursor spotlight
if(!reduced){
  document.addEventListener('pointermove',e=>{
    document.documentElement.style.setProperty('--mx',e.clientX+'px');
    document.documentElement.style.setProperty('--my',e.clientY+'px');
  });
}

// 3D tilt on project cards
if(!reduced && matchMedia('(pointer:fine)').matches){
  document.querySelectorAll('.tilt').forEach(card=>{
    card.addEventListener('pointermove',e=>{
      const r=card.getBoundingClientRect();
      const x=(e.clientX-r.left)/r.width-0.5;
      const y=(e.clientY-r.top)/r.height-0.5;
      card.style.transform=`perspective(900px) rotateY(${x*7}deg) rotateX(${-y*7}deg) translateY(-4px)`;
    });
    card.addEventListener('pointerleave',()=>{card.style.transform=''});
  });
}

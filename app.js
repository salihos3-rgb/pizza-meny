const SB="https://cmmnqckszwgsvaaawouw.supabase.co";
const KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtbW5xY2tzendnc3ZhYWF3b3V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MDM3OTcsImV4cCI6MjEwMzA3OTc5N30.3q6gLw1Zz2ql__Va29fYPwjCkdnJ9-cO1MmKmluF30g";
const TOP=["Stockholm","Göteborg","Malmö","Uppsala","Västerås","Örebro","Linköping","Helsingborg","Norrköping","Jönköping","Lund","Umeå","Eskilstuna"];
const LEAK=["København","Kobenhavn","Copenhagen","Oslo","Helsinki","Vaasa","Nykarleby"];
const COLS="id,name,city,country,phone,lat,lon,menu_url,description,is_sponsored,coords_approx";
const CACHE_KEY="pm_cache_v3";
const SITE="https://pizza-meny.vercel.app";
const H={apikey:KEY,Authorization:"Bearer "+KEY};
const IOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
let all=[],items=[],filter="all",city="",me=null,ovenP=null,formOpen=0,typeT=0;

/* ---------- helpers ---------- */
function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,c=>"&#"+c.charCodeAt(0)+";")}
// Value for use inside an HTML attribute that holds JS (onclick='f(...)'): JSON, then HTML-escaped.
function aj(v){return esc(JSON.stringify(String(v==null?"":v)))}
function emailOk(s){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s||"").trim())}
function safeHttp(u){u=String(u||"").trim();if(/^https?:\/\//i.test(u)&&u.indexOf(" ")<0&&u.indexOf("<")<0)return u;return""}
function safeTel(p){const d=String(p||"").replace(/[^\d+]/g,"");return d.length>=7?d:""}
function uuidOk(id){return /^[0-9a-f-]{8,36}$/i.test(String(id||""))}
function tooSoon(key,ms){let last=0;try{last=+localStorage.getItem(key)||0}catch(e){}if(Date.now()-last<ms)return true;try{localStorage.setItem(key,String(Date.now()))}catch(e){}return false}
function lsGet(k,d){try{const v=JSON.parse(localStorage.getItem(k)||"null");return v==null?d:v}catch(e){return d}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
function slugify(s){return String(s||"").toLowerCase().replace(/[åä]/g,"a").replace(/ö/g,"o").replace(/é/g,"e").replace(/ü/g,"u").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60)}
function pageSlug(p){return slugify(p.name)+"-"+String(p.id).slice(0,8)}
function goodDesc(d){d=String(d||"").trim();if(!d)return"";if(/Källa:\s*OpenStreetMap/i.test(d))return"";if(/^(Pizza|Pizzeria|Klassisk meny) i [^.]+\.$/.test(d))return"";if(d==="Officiell kedja.")return"";return d}
function hasCoords(p){return !!(p.lat&&p.lon&&!p.coords_approx)}
function mapUrl(p){const q=encodeURIComponent((p.name||"")+" "+(p.city||""));if(hasCoords(p)){const ll=encodeURIComponent(p.lat)+","+encodeURIComponent(p.lon);return IOS?"https://maps.apple.com/?daddr="+ll+"&q="+q:"https://www.google.com/maps/dir/?api=1&destination="+ll}return IOS?"https://maps.apple.com/?q="+q:"https://www.google.com/maps/search/?api=1&query="+q}

/* ---------- favourites, own stars, recent searches (stored on this phone only) ---------- */
function favs(){const a=lsGet("pm_fav",[]);return Array.isArray(a)?a.filter(uuidOk):[]}
function saveFav(a){lsSet("pm_fav",a.filter(uuidOk).slice(0,400))}
function isFav(id){return favs().includes(id)}
function toggleFav(id){if(!uuidOk(id))return;const a=favs();const i=a.indexOf(id);if(i>=0)a.splice(i,1);else a.push(id);saveFav(a);if(document.getElementById("detailPage").classList.contains("on"))openDetail(id);else render()}
function rates(){const r=lsGet("pm_rate",{});return r&&typeof r==="object"?r:{}}
function setRate(id,n){if(!uuidOk(id)||n<1||n>5)return;const r=rates();r[id]=n;lsSet("pm_rate",r);if(document.getElementById("detailPage").classList.contains("on"))openDetail(id)}
function recents(){const a=lsGet("pm_q",[]);return Array.isArray(a)?a.map(x=>String(x).slice(0,40)).slice(0,8):[]}
function rememberQ(){const v=document.getElementById("q").value.trim().slice(0,40);if(v.length<2)return;const a=recents().filter(x=>x.toLowerCase()!==v.toLowerCase());a.unshift(v);lsSet("pm_q",a.slice(0,8));drawRecent()}
function clearRecent(){try{localStorage.removeItem("pm_q")}catch(e){}drawRecent()}
function drawRecent(){const a=recents();document.getElementById("recent").innerHTML=a.length?a.map(x=>`<button class="chip" onclick='useRecent(${aj(x)})'>${esc(x)}</button>`).join("")+`<button class="chip" onclick="clearRecent()">Rensa</button>`:""}
function useRecent(v){document.getElementById("q").value=String(v||"").slice(0,40);onType()}

/* ---------- location ---------- */
function km(a,b,c,d){const R=6371,p=Math.PI/180,dLat=(c-a)*p,dLon=(d-b)*p,x=Math.sin(dLat/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
function askNear(){
  if(!navigator.geolocation){alert("Telefonen delar ingen position.");setF("all");return}
  document.getElementById("count").textContent="Hämtar din position…";
  navigator.geolocation.getCurrentPosition(
    p=>{me={lat:p.coords.latitude,lon:p.coords.longitude};render()},
    err=>{alert(err&&err.code===1?"Platsdelning är avstängd. Slå på den för Pizza Meny i telefonens inställningar.":"Kunde inte hitta din position. Försök igen.");setF("all")},
    {enableHighAccuracy:true,timeout:10000,maximumAge:60000})
}
function distLabel(p){if(!me||!hasCoords(p))return"";const d=km(me.lat,me.lon,p.lat,p.lon);return d<10?d.toFixed(1)+" km":Math.round(d)+" km"}

/* ---------- data ---------- */
function okCity(p){const c=p.city||"";if(LEAK.some(x=>c.toLowerCase()===x.toLowerCase()))return false;const co=p.country||"Sverige";return co==="Sverige"||co==="Sweden"}
function clean(rows){const seen=new Set();return rows.filter(p=>p&&p.id&&uuidOk(p.id)&&!seen.has(p.id)&&(seen.add(p.id),okCity(p)))}
function readCache(){const c=lsGet(CACHE_KEY,null);if(!c||!Array.isArray(c.rows)||!c.rows.length)return null;return c}
function writeCache(){try{localStorage.removeItem("pm_cache");localStorage.removeItem("pm_cache_v2")}catch(e){}lsSet(CACHE_KEY,{t:Date.now(),rows:all})}
async function page(off){const r=await fetch(SB+"/rest/v1/pizzerias?select="+COLS+"&hidden=is.false&order=id.asc&limit=1000&offset="+off,{headers:Object.assign({Prefer:"count=exact"},H)});if(!r.ok)throw new Error("err");return{rows:await r.json(),total:parseInt(((r.headers.get("content-range")||"").split("/")[1]||"0"),10)}}
async function loadItems(){try{const ir=await fetch(SB+"/rest/v1/pizza_items?select=pizzeria_id,name,price_sek&is_active=eq.true",{headers:H});items=ir.ok?await ir.json():[]}catch(e){items=[]}}
function paint(msg){document.getElementById("sub").textContent=msg||(all.length+" pizzerior");drawCities();drawRecent();render()}
async function load(){
  city=lsGet("pm_city_v2","")||"";
  try{const st=new URLSearchParams(location.search).get("stad");if(st){city=st.slice(0,60);lsSet("pm_city_v2",city);history.replaceState({},"",location.pathname)}}catch(e){}
  if(city)document.getElementById("q").value=city;syncClear();
  const cached=readCache();if(cached){all=clean(cached.rows);paint(all.length+" pizzerior");applyShare()}
  try{
    const first=await page(0);let rows=first.rows;let off=1000;const total=first.total||rows.length;
    while(off<total){const p=await page(off);rows=rows.concat(p.rows);off+=1000}
    all=clean(rows);writeCache();paint(all.length+" pizzerior");applyShare();loadItems().then(()=>{if(items.length)render()});
  }catch(e){if(!all.length){document.getElementById("sub").textContent="Ingen anslutning";document.getElementById("list").innerHTML="<div class='empty'>Kunde inte läsa listan. Kontrollera nätet och ladda om.</div>"}}
}

/* ---------- list ---------- */
function drawCities(){document.getElementById("cities").innerHTML=`<button class="city ${!city?"on":""}" onclick="setCity('')">Alla städer</button>`+TOP.map(c=>`<button class="city ${city===c?"on":""}" onclick='setCity(${aj(c)})'>${esc(c)}</button>`).join("")}
function setCity(c){city=String(c||"");document.getElementById("q").value=city;lsSet("pm_city_v2",city);if(city)rememberQ();syncClear();drawCities();render()}
function setF(f){filter=f;document.querySelectorAll("[data-f]").forEach(c=>{const on=c.dataset.f===f;c.classList.toggle("on",on);c.setAttribute("aria-pressed",on?"true":"false")});if(f==="near"&&!me){askNear();return}render()}
function onType(){syncClear();clearTimeout(typeT);typeT=setTimeout(()=>{const v=document.getElementById("q").value.trim();city=TOP.find(c=>c.toLowerCase()===v.toLowerCase())||"";lsSet("pm_city_v2",city);drawCities();render()},80)}
function wipe(){document.getElementById("q").value="";city="";lsSet("pm_city_v2","");syncClear();drawCities();render();document.getElementById("q").focus()}
function syncClear(){document.getElementById("clr").classList.toggle("on",!!(document.getElementById("q").value||city))}
function menuOf(id){return items.filter(x=>x.pizzeria_id===id)}
function score(p){return (p.is_sponsored?100:0)+(p.menu_url?2:0)+(p.phone?2:0)+(hasCoords(p)?1:0)}
function getList(){
  const q=document.getElementById("q").value.toLowerCase().trim();
  const cities=new Set(all.map(p=>(p.city||"").toLowerCase()).filter(Boolean));
  const exactCity=(city||"").toLowerCase()||(cities.has(q)?q:"");
  let list=all.filter(p=>{
    if(filter==="fav"&&!isFav(p.id))return false;
    if(filter==="menu"&&!p.menu_url)return false;
    if(filter==="phone"&&!p.phone)return false;
    if(filter==="near")return !!(hasCoords(p)&&me);
    if(exactCity)return (p.city||"").toLowerCase()===exactCity;
    if(!q)return true;
    return (p.name+" "+(p.city||"")).toLowerCase().includes(q)});
  if(filter==="near"&&me)return list.map(p=>({p,d:km(me.lat,me.lon,p.lat,p.lon)})).filter(x=>x.d<=25).sort((a,b)=>a.d-b.d).map(x=>x.p);
  return [...list].sort((a,b)=>score(b)-score(a)||(a.name||"").localeCompare(b.name||"","sv"));
}
function cardHtml(p,full){
  const my=rates()[p.id]||0,m=menuOf(p.id),d=distLabel(p),tel=safeTel(p.phone),web=safeHttp(p.menu_url),desc=goodDesc(p.description);
  const idj=aj(p.id),namej=aj(p.name),cityj=aj(p.city),phonej=aj(p.phone||"");
  const fav=isFav(p.id);
  return `<article class="card">`+
  `<button class="heart" onclick='toggleFav(${idj})' aria-label="${fav?"Ta bort från favoriter":"Spara som favorit"}" aria-pressed="${fav}">${fav?"❤️":"🤍"}</button>`+
  `<button class="namebtn" onclick='openDetail(${idj})'><h2>${esc(p.name)}</h2></button>`+
  `<div class="meta"><span>${esc(p.city||"")}</span>${d?"<span>"+esc(d)+"</span>":""}${web?"<span class='badge'>Meny</span>":""}${tel?"<span class='badge'>Tel</span>":""}${m.length?"<span class='badge'>Lista</span>":""}${p.is_sponsored?"<span class='badge s'>Sponsrad</span>":""}</div>`+
  (full?`<div class="stars" role="group" aria-label="Ditt betyg, sparas bara i din telefon">${[1,2,3,4,5].map(n=>`<button class="star" onclick='setRate(${idj},${n})' aria-label="${n} av 5">${n<=my?"★":"☆"}</button>`).join("")}</div>`:"")+
  (full&&desc?`<p class="desc">${esc(desc)}</p>`:"")+
  `<div class="row">${tel?`<a class="ring" href="tel:${esc(tel)}">📞 Ring</a>`:""}<a class="map" target="_blank" rel="noopener noreferrer" href="${esc(mapUrl(p))}">📍 Karta</a>${web?`<a class="meny" target="_blank" rel="noopener noreferrer" href="${esc(web)}">🍕 Meny</a>`:""}<button class="act claim" onclick='openClaim(${idj},${namej},${phonej})'>Äg</button></div>`+
  (full?`<button class="act claim wide" onclick='openTip("syns_hogre",${idj},${namej},${cityj})'>Syns högre · 299 kr/mån</button><button class="act claim wide" onclick='shareP(${idj})'>Dela</button><a class="act claim wide" href="/p/${esc(pageSlug(p))}">Egen sida för ${esc(p.name)}</a>`:"")+
  (full&&m.length?`<p class="desc" style="margin-top:14px"><b>Digital meny</b></p>`+m.map(i=>`<div class="item"><span>${esc(i.name)}</span><span>${i.price_sek?esc(i.price_sek)+" kr":""}</span></div>`).join("")+`<button class="act claim wide" onclick='slumpPizza(${idj})'>🎲 Slumpa pizza här</button>`:"")+
  (full&&p.coords_approx?`<p class="desc small">Kartan söker på namnet, exakt adress saknas.</p>`:"")+
  `</article>`;
}
function render(){
  const list=getList();
  const cap=(city||document.getElementById("q").value.trim()||filter!=="all")?800:80;
  const shown=Math.min(list.length,cap);
  document.getElementById("count").innerHTML=(!city&&filter==="all"&&!document.getElementById("q").value.trim()?"Skriv en stad eller tryck Slumpa. ":"")+"<b style='color:#fff'>"+shown+"</b> "+(shown===1?"pizzeria":"pizzerior")+(list.length>cap?" av "+list.length:"");
  const emptyMsg=filter==="fav"?"Inga favoriter än. Tryck hjärtat på en pizzeria.":filter==="near"?(me?"Inga pizzerior inom 25 km.":"Hämtar din position…"):"Inget här. Saknas en pizzeria? Tryck Saknas? nedan.";
  document.getElementById("list").innerHTML=list.length?list.slice(0,cap).map(p=>cardHtml(p,false)).join(""):"<div class='empty'>"+emptyMsg+"</div>";
}

/* ---------- detail ---------- */
function applyShare(){
  let id="";try{id=new URLSearchParams(location.search).get("p")||""}catch(e){}
  if(!uuidOk(id)){const m=(location.hash||"").match(/^#p=([0-9a-f-]{8,36})$/i);if(m)id=m[1]}
  if(!uuidOk(id))return;
  const p=all.find(x=>x.id===id)||all.find(x=>String(x.id).startsWith(id));
  if(p)openDetail(p.id);
}
function shareP(id){
  const p=all.find(x=>x.id===id);if(!p)return;
  const u=SITE+"/p/"+pageSlug(p);
  const t="Ikväll: "+p.name+(p.city?" i "+p.city:"")+" — Pizza Meny";
  if(navigator.share)navigator.share({title:t,text:t,url:u}).catch(()=>{});
  else if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(u).then(()=>alert("Länk kopierad")).catch(()=>prompt("Kopiera länken:",u));
  else prompt("Kopiera länken:",u);
}
function openDetail(id){
  const p=all.find(x=>x.id===id);if(!p)return;
  document.getElementById("listPage").classList.remove("on");
  document.getElementById("detailPage").classList.add("on");
  document.getElementById("back").style.display="block";
  document.getElementById("ownerbar").style.display="none";
  document.getElementById("htitle").textContent=p.name;
  document.getElementById("sub").textContent=p.city||"";
  document.getElementById("detail").innerHTML=cardHtml(p,true);
  document.title=p.name+(p.city?" i "+p.city:"")+" – Pizza Meny";
  window.scrollTo(0,0);
}
function goList(){
  document.getElementById("detailPage").classList.remove("on");
  document.getElementById("listPage").classList.add("on");
  document.getElementById("back").style.display="none";
  document.getElementById("ownerbar").style.display="flex";
  document.getElementById("htitle").textContent="🍕 Pizza Meny";
  document.getElementById("sub").textContent=all.length+" pizzerior";
  document.title="Pizza Meny – pizzerior i Sverige, nummer och meny";
  try{if(location.search||location.hash)history.replaceState({},"",location.pathname)}catch(e){}
  render();
}

/* ---------- sheets ---------- */
function openSlump(){document.getElementById("slumpMask").classList.add("on")}
function openHelp(){document.getElementById("helptitle").textContent="Pizza Meny";document.getElementById("helpApp").style.display="block";document.getElementById("helpOwner").style.display="none";document.getElementById("helpMask").classList.add("on")}
function openOwner(){document.getElementById("helptitle").textContent="Äg din sida";document.getElementById("helpApp").style.display="none";document.getElementById("helpOwner").style.display="block";document.getElementById("helpMask").classList.add("on")}
function closeMask(id){document.getElementById(id).classList.remove("on")}
document.addEventListener("keydown",e=>{if(e.key==="Escape")document.querySelectorAll(".mask.on").forEach(m=>m.classList.remove("on"))});

/* ---------- slumpa ---------- */
function pickPool(mode){if(mode==="city")return getList();if(mode==="fav")return all.filter(p=>isFav(p.id));if(mode==="menu")return all.filter(p=>p.menu_url);return all}
function doSlump(mode){closeMask("slumpMask");if(mode==="city"&&!city&&!document.getElementById("q").value.trim()){alert("Välj en stad först.");return}const pool=pickPool(mode);if(!pool.length){alert(mode==="fav"?"Du har inga favoriter än.":"Inget att slumpa där.");return}ovenP=pool[Math.floor(Math.random()*pool.length)];ovenPlay()}
function slumpPizza(id){const m=menuOf(id);if(!m.length){alert("Ingen digital meny på den här pizzerian än.");return}const x=m[Math.floor(Math.random()*m.length)];alert("🍕 "+x.name+(x.price_sek?" · "+x.price_sek+" kr":""))}
function ovenStart(){closeMask("slumpMask");const l=getList();const pool=l.length?l:all;if(!pool.length){alert("Inget att slumpa");return}ovenP=pool[Math.floor(Math.random()*pool.length)];ovenPlay()}
function ovenReset(){document.getElementById("ovenPizza").classList.remove("show");document.getElementById("turtle").classList.remove("in","go","toss","walk","done");document.getElementById("flypie").classList.remove("go")}
function ovenDismiss(){document.getElementById("oven").classList.remove("on");ovenReset();ovenP=null}
function ovenPlay(){
  const door=document.getElementById("door"),pie=document.getElementById("ovenPizza"),tur=document.getElementById("turtle"),fly=document.getElementById("flypie");
  document.getElementById("ovenActs").style.display="none";
  document.getElementById("ovenTitle").textContent="Sköldpaddan kommer";
  document.getElementById("ovenSub").textContent="Pizza in i ugnen";
  ovenReset();door.classList.remove("shut");
  document.getElementById("oven").classList.add("on");
  requestAnimationFrame(()=>{tur.classList.add("in","walk")});
  setTimeout(()=>{tur.classList.remove("walk");tur.classList.add("toss");fly.classList.add("go");
    document.getElementById("ovenTitle").textContent="In den åker";document.getElementById("ovenSub").textContent="Luckan stängs";
    setTimeout(()=>{door.classList.add("shut")},180);
    setTimeout(()=>{pie.classList.add("show");tur.classList.add("done");
      setTimeout(()=>{if(!ovenP)return;door.classList.remove("shut");
        document.getElementById("ovenTitle").textContent=ovenP.name;
        const pizza=menuOf(ovenP.id);
        document.getElementById("ovenSub").textContent=pizza.length?("🍕 "+pizza[Math.floor(Math.random()*pizza.length)].name):(ovenP.city||"");
        document.getElementById("ovenActs").style.display="block";
        const ring=document.getElementById("ovenRing");const tel=safeTel(ovenP.phone);
        if(tel){ring.style.display="block";ring.onclick=()=>{location.href="tel:"+tel};ring.textContent="📞 Ring"}else{ring.style.display="none"}
      },480)},900)},900);
}
function ovenAgain(){document.getElementById("oven").classList.remove("on");ovenReset();setTimeout(ovenStart,80)}
function ovenOpen(){document.getElementById("oven").classList.remove("on");if(ovenP)openDetail(ovenP.id)}

/* ---------- forms: Äg din sida, tips, kontakt ---------- */
function digits(s){s=(s||"").replace(/\D/g,"");if(s.startsWith("46")&&s.length>=10)s="0"+s.slice(2);return s}
function postRow(table,body){return fetch(SB+"/rest/v1/"+table,{method:"POST",headers:Object.assign({"Content-Type":"application/json",Prefer:"return=minimal"},H),body:JSON.stringify(body)})}
function openClaim(id,name,listed){
  document.getElementById("pid").value=id;
  document.getElementById("stitle").textContent="Äg "+name;
  document.getElementById("sdesc").textContent="Är du ägare? Skicka in så ringer vi pizzerian och bekräftar. Sedan kan du rätta uppgifter och meny.";
  ["cname","cmail","cweb","chp"].forEach(i=>{const el=document.getElementById(i);if(el)el.value=""});
  document.getElementById("cphone").value=listed||"";
  const boost=document.getElementById("cboost");if(boost)boost.checked=false;
  formOpen=Date.now();document.getElementById("mask").classList.add("on");
}
function closeSheet(){closeMask("mask")}
async function sendClaim(){
  if(document.getElementById("chp").value)return;
  if(Date.now()-formOpen<1200){alert("Vänta en sekund och skicka igen.");return}
  const name=document.getElementById("cname").value.trim().slice(0,80),phone=document.getElementById("cphone").value.trim().slice(0,30);
  const email=document.getElementById("cmail").value.trim().slice(0,120),web=document.getElementById("cweb").value.trim().slice(0,200);
  const boost=!!document.getElementById("cboost").checked,pid=document.getElementById("pid").value;
  if(!uuidOk(pid)||!name||digits(phone).length<7){alert("Fyll i ditt namn och ett telefonnummer.");return}
  if(email&&!emailOk(email)){alert("Kolla e-postadressen.");return}
  if(tooSoon("pm_claim",20000)){alert("Vänta lite mellan ansökningar.");return}
  const btn=document.getElementById("claimGo");if(btn)btn.disabled=true;
  try{const r=await postRow("claims",{pizzeria_id:pid,status:"pending",verification_method:boost?"syns_hogre":"phone",verification_data:{name,phone,email,web,boost}});
    if(!r.ok)throw 0;closeSheet();alert("Tack! Vi ringer pizzerian och bekräftar.")}
  catch(e){try{localStorage.removeItem("pm_claim")}catch(_){}alert("Kunde inte skicka. Försök igen om en stund.")}
  finally{if(btn)btn.disabled=false}
}
function openTip(kind,pid,name,cty){
  const boost=kind==="syns_hogre";
  document.getElementById("tipkind").value=boost?"syns_hogre":"saknas";
  document.getElementById("tippid").value=pid||"";
  document.getElementById("tname").value=name||"";
  document.getElementById("tcity").value=cty||city||document.getElementById("q").value||"";
  ["tphone","tweb","thp"].forEach(i=>{const el=document.getElementById(i);if(el)el.value=""});
  document.getElementById("tnote").value=boost?"Vill synas högre":"";
  document.getElementById("tiptitle").textContent=boost?"Vill synas högre":"Saknas en pizzeria?";
  document.getElementById("tipdesc").textContent=boost?"Intresseanmälan. Vi hör av oss med villkor.":"Tipsa oss. Vi kontrollerar mot pizzerians egen sajt eller nummer.";
  formOpen=Date.now();document.getElementById("tipMask").classList.add("on");
}
async function sendTip(){
  if(document.getElementById("thp").value)return;
  if(Date.now()-formOpen<1200){alert("Vänta en sekund och skicka igen.");return}
  const kind=document.getElementById("tipkind").value==="syns_hogre"?"syns_hogre":"saknas";
  const pid=document.getElementById("tippid").value||null;
  const body={kind,pizzeria_id:pid&&uuidOk(pid)?pid:null,name:document.getElementById("tname").value.trim().slice(0,80),city:document.getElementById("tcity").value.trim().slice(0,60),phone:document.getElementById("tphone").value.trim().slice(0,30)||null,website:document.getElementById("tweb").value.trim().slice(0,200)||null,note:document.getElementById("tnote").value.trim().slice(0,500)||null};
  if(body.name.length<2||!body.city){alert("Fyll i namn och stad.");return}
  if(tooSoon("pm_tip",15000)){alert("Vänta lite mellan tips.");return}
  try{const r=await postRow("tips",body);if(!r.ok)throw 0;closeMask("tipMask");alert("Tack! Inskickat.")}
  catch(e){try{localStorage.removeItem("pm_tip")}catch(_){}alert("Kunde inte skicka. Försök igen om en stund.")}
}
function openContact(){closeMask("helpMask");formOpen=Date.now();["kname","kmail","kmsg","hp"].forEach(i=>{document.getElementById(i).value=""});document.getElementById("contactMask").classList.add("on")}
async function sendContact(){
  if(document.getElementById("hp").value)return;
  if(Date.now()-formOpen<2500){alert("Vänta en sekund och skicka igen.");return}
  const name=document.getElementById("kname").value.trim().slice(0,80),mail=document.getElementById("kmail").value.trim().slice(0,120),msg=document.getElementById("kmsg").value.trim().slice(0,800);
  if(name.length<2||!emailOk(mail)||msg.length<8){alert("Fyll i namn, en giltig e-post och ett meddelande.");return}
  if(tooSoon("pm_mail",60000)){alert("Vänta en minut mellan meddelanden.");return}
  try{const r=await postRow("tips",{kind:"kontakt",name,city:"Kontakt",phone:null,website:mail,note:msg});if(!r.ok)throw 0;closeMask("contactMask");alert("Tack! Vi läser det.")}
  catch(e){try{localStorage.removeItem("pm_mail")}catch(_){}alert("Kunde inte skicka. Mejla pizzameny.app@gmail.com i stället.")}
}

/* ---------- start ---------- */
try{["pm_me","pm_friends","pm_eats","pm_sess","pm_city"].forEach(k=>localStorage.removeItem(k))}catch(e){}
try{if(/access_token=/.test(location.hash))history.replaceState({},"",location.pathname+location.search)}catch(e){}
load();

/* ------------------------------------------
AMEDEO Prototype (Klimt)
- Loads images from Wikimedia Commons category via MediaWiki API
- Autoplay 4s, tap prev/next, resume autoplay
- Curator note every 5 works
- Search: only "picasso" enabled (placeholder) + "klimt"
------------------------------------------- */

const AUTOPLAY_MS = 4000;
const RESUME_AFTER_MS = 1600;
const NOTE_EVERY = 5;
const NOTE_SHOW_MS = 2400;

// Try multiple category names (Commons titles can vary)
const KLIMT_CATEGORY_CANDIDATES = [
"Category:Paintings by Gustav Klimt",
"Category:Paintings_by_Gustav_Klimt",
"Category:Gustav Klimt paintings",
"Category:Gustav_Klimt_paintings"
];

const $ = (id) => document.getElementById(id);
const imgA = $("imgA");
const imgB = $("imgB");
const loading = $("loading");
const metaTitle = $("metaTitle");
const metaYear = $("metaYear");
const metaLoc = $("metaLoc");
const note = $("note");
const noteText = $("noteText");
const toast = $("toast");

let activeImg = imgA;
let idleTimer = null;
let autoplayTimer = null;
let noteTimer = null;

let exhibition = { key:"klimt", label:"Klimt", works:[] };
let index = 0;
let lastInteractionAt = Date.now();

function showToast(msg){
toast.textContent = msg;
toast.classList.add("is-on");
setTimeout(()=>toast.classList.remove("is-on"), 1400);
}

function filePathFromTitle(fileTitle){
// fileTitle like "File:Something.jpg"
const name = fileTitle.replace(/^File:/i, "");
return "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(name);
}

function guessMetaFromFileTitle(fileTitle, fallbackExhibition){
const clean = fileTitle.replace(/^File:/i,"").replace(/\.(jpg|jpeg|png|webp)$/i,"");
const yearMatch = clean.match(/\b(18|19)\d{2}\b/);
const year = yearMatch ? yearMatch[0] : "";

// title guess
let t = clean
.replace(/^Gustav\s+Klimt\s*[-,]\s*/i,"")
.replace(/^Klimt\s*[-,]\s*/i,"")
.replace(/\s{2,}/g," ")
.trim();

// location guess (weak heuristic)
let loc = "";
if (/Belvedere/i.test(clean)) loc = "Belvedere, Vienna";
else if (/Österreichische Galerie/i.test(clean)) loc = "Österreichische Galerie Belvedere";
else if (/Neue Galerie/i.test(clean)) loc = "Neue Galerie";
else if (/Leopold/i.test(clean)) loc = "Leopold Museum";
else if (/Museum/i.test(clean) && /Vienna|Wien/i.test(clean)) loc = "Vienna (museum)";
else loc = "";

return {
exhibition: fallbackExhibition || "Klimt",
title: t || (fallbackExhibition || "Klimt"),
year,
location: loc,
artist: "Gustav Klimt"
};
}

function curatorNoteFor(i){
const seeds = [
"Let the gold act like silence: it doesn’t decorate — it suspends time.",
"Notice how pattern becomes structure. In Klimt, ornament is architecture.",
"Faces stay calm while the surface burns. That contrast is the tension.",
"Look for the rhythm: repetition, pause, repetition. It’s almost musical.",
"This is intimacy without explanation. Stay with the surface — it opens later."
];
return seeds[i % seeds.length];
}

function setMeta(work){
metaTitle.textContent = work.exhibition || "Klimt";
metaYear.textContent = work.year ? `• ${work.year}` : "";
const loc = work.location ? ` — ${work.location}` : "";
// Under card: title · artist — location
metaLoc.textContent = `${work.title || ""}${work.title ? " · " : ""}${work.artist || ""}${loc}`.trim();
}

function swapTo(imgEl){
imgA.classList.remove("is-on");
imgB.classList.remove("is-on");
imgEl.classList.add("is-on");
activeImg = imgEl;
}

function preload(url){
return new Promise((resolve,reject)=>{
const im = new Image();
im.onload = ()=>resolve(url);
im.onerror = ()=>reject(url);
im.src = url;
});
}

function renderPlaceholderSlide(title, subtitle){
const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="2400">
<rect width="100%" height="100%" fill="#0a0a0a"/>
<text x="90" y="260" fill="#eaeaea" font-family="Helvetica, Arial, sans-serif" font-size="70" letter-spacing="14">${title}</text>
<text x="90" y="360" fill="#9a9a9a" font-family="Helvetica, Arial, sans-serif" font-size="34" letter-spacing="5">${subtitle}</text>
<text x="90" y="2120" fill="#6f6f6f" font-family="Helvetica, Arial, sans-serif" font-size="30">Prototype — images not embedded</text>
</svg>`;
return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

async function renderCurrent(){
const work = exhibition.works[index];
if (!work) return;

setMeta(work);

const shouldNote = ((index+1) % NOTE_EVERY === 0);
if (shouldNote){
noteText.textContent = curatorNoteFor(index);
note.classList.add("is-on");
clearTimeout(noteTimer);
noteTimer = setTimeout(()=>note.classList.remove("is-on"), NOTE_SHOW_MS);
} else {
note.classList.remove("is-on");
}

let url = work.img;
if (!url) url = renderPlaceholderSlide("AMEDEO", "an infinite exhibition");

const nextImg = (activeImg === imgA) ? imgB : imgA;

try{
await preload(url);
}catch(e){
url = renderPlaceholderSlide("IMAGE UNAVAILABLE", "try refresh");
}

loading.classList.add("hide");
nextImg.src = url;
swapTo(nextImg);
}

function clampIndex(){
if (index < 0) index = exhibition.works.length - 1;
if (index >= exhibition.works.length) index = 0;
}

function next(){ index++; clampIndex(); renderCurrent(); }
function prev(){ index--; clampIndex(); renderCurrent(); }

function stopAutoplay(){
clearInterval(autoplayTimer);
autoplayTimer = null;
}
function startAutoplay(){
stopAutoplay();
autoplayTimer = setInterval(()=>{
const idleFor = Date.now() - lastInteractionAt;
if (idleFor >= AUTOPLAY_MS - 200) next();
}, AUTOPLAY_MS);
}

function userInteracted(){
lastInteractionAt = Date.now();
stopAutoplay();
clearTimeout(idleTimer);
idleTimer = setTimeout(()=>startAutoplay(), RESUME_AFTER_MS);
}

/* -------- Wikimedia loader -------- */

async function fetchCategoryMembers(categoryTitle, limit=80){
// MediaWiki API: list categorymembers (namespace 6 = File)
// origin=* enables CORS
const url =
"https://commons.wikimedia.org/w/api.php" +
"?action=query&format=json&origin=*" +
"&list=categorymembers" +
"&cmtitle=" + encodeURIComponent(categoryTitle) +
"&cmnamespace=6" +
"&cmlimit=" + Math.min(limit, 200);

const res = await fetch(url);
if (!res.ok) throw new Error("API error");
const json = await res.json();
const items = json?.query?.categorymembers || [];
return items.map(x => x.title); // "File:....jpg"
}

function keepPaintingLikeFiles(fileTitles){
// Very light filter to avoid random photos (still not perfect)
return fileTitles.filter(t => {
const s = t.toLowerCase();
const okExt = s.endsWith(".jpg") || s.endsWith(".jpeg") || s.endsWith(".png") || s.endsWith(".webp");
if (!okExt) return false;
// avoid obvious non-painting labels
if (s.includes("photo") || s.includes("exhibition") || s.includes("poster")) return false;
return true;
});
}

async function loadKlimtWorks(){
for (const cat of KLIMT_CATEGORY_CANDIDATES){
try{
const files = await fetchCategoryMembers(cat, 120);
const filtered = keepPaintingLikeFiles(files);
if (filtered.length >= 40){
// take first 60 to keep it smooth
const selected = filtered.slice(0, 60);
return selected.map(ft => {
const meta = guessMetaFromFileTitle(ft, "Klimt");
return {
exhibition: "Klimt",
title: meta.title,
year: meta.year,
location: meta.location,
artist: meta.artist,
img: filePathFromTitle(ft)
};
});
}
}catch(e){
// try next candidate
}
}
// fallback: no data
return [{
exhibition:"Klimt",
title:"Klimt (unable to load images)",
year:"",
location:"",
artist:"AMADEO",
img: renderPlaceholderSlide("KLIMT", "Could not load images from Commons")
}];
}

/* Picasso placeholder */
function buildPicassoPlaceholder(){
return Array.from({length: 30}).map((_,i)=>({
exhibition:"Picasso",
title:"Picasso (placeholder)",
year:"",
location:"",
artist:"Pablo Picasso",
img: renderPlaceholderSlide("PICASSO", "prototype flow only")
}));
}

async function loadExhibition(key){
if (key === "klimt"){
showToast("Exhibition: Klimt");
loading.classList.remove("hide");
exhibition = { key:"klimt", label:"Klimt", works: await loadKlimtWorks() };
} else if (key === "picasso"){
showToast("Exhibition: Picasso");
exhibition = { key:"picasso", label:"Picasso", works: buildPicassoPlaceholder() };
} else {
showToast(`Not available yet: "${key}"`);
return;
}
index = 0;
await renderCurrent();
userInteracted();
}

/* Init */
async function init(){
// Tap zones
$("tapZones").addEventListener("click",(e)=>{
const zone = e.target.closest(".zone");
if (!zone) return;
const dir = parseInt(zone.dataset.dir,10);
userInteracted();
(dir === 1) ? next() : prev();
});

// Keyboard
window.addEventListener("keydown",(e)=>{
if (e.key === "ArrowRight"){ userInteracted(); next(); }
if (e.key === "ArrowLeft"){ userInteracted(); prev(); }
if (e.key === " "){ e.preventDefault(); userInteracted(); next(); }
});

// Search: only "picasso" and "klimt"
const search = $("search");
search.addEventListener("keydown", async (e)=>{
if (e.key !== "Enter") return;
const q = (search.value || "").trim().toLowerCase();
search.value = "";
if (!q) return;
if (q === "klimt") await loadExhibition("klimt");
else if (q === "picasso") await loadExhibition("picasso");
else showToast(`Not available yet: "${q}"`);
});

// Start
await loadExhibition("klimt");
startAutoplay();
}

init();

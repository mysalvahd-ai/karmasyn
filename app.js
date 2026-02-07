/* AMEDEO — Modigliani only (prototype)
- Random start (B)
- Optional shuffle on load
- autoplay 4s
- tap left/right prev/next
- resumes autoplay
- skips broken images
*/

const AUTOPLAY_MS = 4000;
const RESUME_AFTER_MS = 1600;

const artImg = document.getElementById("artImg");
const loading = document.getElementById("loading");
const exhTitle = document.getElementById("exhTitle");
const artLine = document.getElementById("artLine");
const artLoc = document.getElementById("artLoc");
const aiCard = document.getElementById("aiCard");
const aiText = document.getElementById("aiText");
const tapLeft = document.getElementById("tapLeft");
const tapRight = document.getElementById("tapRight");

// --- IMPORTANT: stable image URLs (works on iPhone)
function filePathWidth(filename, width = 960){
return "https://commons.wikimedia.org/wiki/Special:FilePath/" +
encodeURIComponent(filename) + "?width=" + width;
}

// ====== EXHIBITION DATA ======
// Inserisci qui le 100 opere (ritratti + nudi) con filename Commons corretto.
// Intanto ne lasciamo alcune di esempio già funzionanti.
const EXHIBITION = {
title: "MODIGLIANI",
works: [
{ title:"Léon Bakst", year:"1917", location:"National Gallery of Art, Washington",
img:filePathWidth("Amedeo Modigliani, Léon Bakst, 1917, NGA 46648.jpg", 960) },

{ title:"Girl in a Green Blouse", year:"1917", location:"National Gallery of Art, Washington",
img:filePathWidth("Amedeo Modigliani, Girl in a Green Blouse, 1917, NGA 46520.jpg", 960) },

{ title:"Madame Amédée (Woman with Cigarette)", year:"1918", location:"National Gallery of Art, Washington",
img:filePathWidth("Amedeo Modigliani, Madame Amédée (Woman with Cigarette), 1918, NGA 46647.jpg", 960) },

{ title:"Woman with Red Hair", year:"1917", location:"National Gallery of Art, Washington",
img:filePathWidth("Amedeo Modigliani, Woman with Red Hair, 1917, NGA 46651.jpg", 960) },

{ title:"Beatrice (Portrait de Béatrice Hastings)", year:"c. 1915–1916", location:"Barnes Foundation, Philadelphia",
img:filePathWidth("Amedeo Modigliani - Beatrice (Portrait de Béatrice Hastings) - BF361 - Barnes Foundation.jpg", 960) },

{ title:"Boy in Sailor Suit", year:"c. 1918", location:"Barnes Foundation, Philadelphia",
img:filePathWidth("Amedeo Modigliani - Boy in Sailor Suit - BF369 - Barnes Foundation.jpg", 960) },
],
aiNotes: [
"Modigliani doesn’t describe a person — he distills them.",
"The line is mercy: it removes noise and keeps presence.",
"The eyes are space. You complete them."
]
};

// ====== OPTIONS ======
const RANDOM_START = true; // B
const SHUFFLE_ON_LOAD = true; // se vuoi “ordine vivo” oltre allo start casuale

// ====== STATE ======
exhTitle.textContent = EXHIBITION.title;

let idx = 0;
let timer = null;
let resumeTimer = null;

function shuffleInPlace(arr){
for (let i = arr.length - 1; i > 0; i--){
const j = Math.floor(Math.random() * (i + 1));
[arr[i], arr[j]] = [arr[j], arr[i]];
}
}

function clearTimers(){
if (timer) { clearInterval(timer); timer = null; }
if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; }
}

function startAuto(){
clearTimers();
timer = setInterval(next, AUTOPLAY_MS);
}

function pauseAndResume(){
if (timer) { clearInterval(timer); timer = null; }
if (resumeTimer) clearTimeout(resumeTimer);
resumeTimer = setTimeout(() => startAuto(), RESUME_AFTER_MS);
}

function showAIIfNeeded(){
const show = ((idx + 1) % 5 === 0);
if (!show) { aiCard.hidden = true; return; }
const noteIdx = Math.floor((idx + 1) / 5 - 1) % EXHIBITION.aiNotes.length;
aiText.textContent = EXHIBITION.aiNotes[noteIdx];
aiCard.hidden = false;
}

function setMeta(work){
artLine.textContent = `${work.title}${work.year ? " · " + work.year : ""}`;
artLoc.textContent = work.location || "";
}

function loadImage(url, timeoutMs = 8000){
return new Promise((resolve, reject) => {
const img = new Image();
const t = setTimeout(() => reject(new Error("timeout")), timeoutMs);
img.onload = () => { clearTimeout(t); resolve(url); };
img.onerror = () => { clearTimeout(t); reject(new Error("error")); };
img.src = url;
});
}

async function render(){
const work = EXHIBITION.works[idx];
if (!work) return;

setMeta(work);
showAIIfNeeded();

loading.style.display = "block";
artImg.classList.remove("is-ready");

try{
await loadImage(work.img);
artImg.src = work.img;
requestAnimationFrame(() => {
artImg.classList.add("is-ready");
loading.style.display = "none";
});
}catch(e){
// skip broken image so show never gets stuck on LOADING
loading.textContent = "SKIPPING…";
setTimeout(() => {
loading.textContent = "LOADING";
next();
}, 300);
}
}

function next(){
idx = (idx + 1) % EXHIBITION.works.length;
render();
}
function prev(){
idx = (idx - 1 + EXHIBITION.works.length) % EXHIBITION.works.length;
render();
}

// Tap controls
tapLeft.addEventListener("click", () => { pauseAndResume(); prev(); });
tapRight.addEventListener("click", () => { pauseAndResume(); next(); });

// Boot
(function init(){
if (SHUFFLE_ON_LOAD) shuffleInPlace(EXHIBITION.works);
if (RANDOM_START && EXHIBITION.works.length > 0) {
idx = Math.floor(Math.random() * EXHIBITION.works.length);
}
render().then(startAuto);
})();

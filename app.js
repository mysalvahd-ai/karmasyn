/* AMEDEO — Modigliani only (prototype)
- autoplay 4s
- tap left/right prev/next
- resumes autoplay
*/

const AUTOPLAY_MS = 4000;
const RESUME_AFTER_MS = 1600;

const $ = id => document.getElementById(id);
const artImg = document.getElementById("artImg");
const loading = document.getElementById("loading");
const exhTitle = document.getElementById("exhTitle");
const artLine = document.getElementById("artLine");
const artLoc = document.getElementById("artLoc");
const aiCard = document.getElementById("aiCard");
const aiText = document.getElementById("aiText");
const tapLeft = document.getElementById("tapLeft");
const tapRight = document.getElementById("tapRight");

function filePathWidth(filename, width=960){
return "https://commons.wikimedia.org/wiki/Special:FilePath/" +
encodeURIComponent(filename) + "?width=" + width;
}

const EXHIBITION = {
title: "MODIGLIANI",
works: [
{
title: "Léon Bakst",
year: "1917",
location: "National Gallery of Art, Washington",
img: filePathWidth("Amedeo Modigliani, Léon Bakst, 1917, NGA 46648.jpg", 960)
},
{
title: "Girl in a Green Blouse",
year: "1917",
location: "National Gallery of Art, Washington",
img: filePathWidth("Amedeo Modigliani, Girl in a Green Blouse, 1917, NGA 46520.jpg", 960)
},
{
title: "Madame Amédée (Woman with Cigarette)",
year: "1918",
location: "National Gallery of Art, Washington",
img: filePathWidth("Amedeo Modigliani, Madame Amédée (Woman with Cigarette), 1918, NGA 46647.jpg", 960)
},
{
title: "Woman with Red Hair",
year: "1917",
location: "National Gallery of Art, Washington",
img: filePathWidth("Amedeo Modigliani, Woman with Red Hair, 1917, NGA 46651.jpg", 960)
},
{
title: "Beatrice (Portrait de Béatrice Hastings)",
year: "c. 1915–1916",
location: "Barnes Foundation, Philadelphia",
img: filePathWidth("Amedeo Modigliani - Beatrice (Portrait de Béatrice Hastings) - BF361 - Barnes Foundation.jpg", 960)
},
{
title: "Boy in Sailor Suit",
year: "c. 1918",
location: "Barnes Foundation, Philadelphia",
img: filePathWidth("Amedeo Modigliani - Boy in Sailor Suit - BF369 - Barnes Foundation.jpg", 960)
}
],
aiNotes: [
"Modigliani paints faces as quiet masks: elongated, calm, inevitable.",
"Less likeness, more presence — the person as a mood.",
"The eyes are space: a pause where you project your own feeling."
]
};

exhTitle.textContent = EXHIBITION.title;

let idx = 0;
let timer = null;
let resumeTimer = null;

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
artLine.textContent = `${work.title} · ${work.year}`;
artLoc.textContent = work.location || "";
}

function loadImage(url, timeoutMs=8000){
return new Promise((resolve, reject) => {
const img = new Image();
const t = setTimeout(() => {
img.src = ""; // abort-ish
reject(new Error("timeout"));
}, timeoutMs);

img.onload = () => { clearTimeout(t); resolve(url); };
img.onerror = () => { clearTimeout(t); reject(new Error("error")); };
img.src = url;
});
}

async function render(){
const work = EXHIBITION.works[idx];
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
// skip if an image fails
loading.textContent = "SKIPPING…";
setTimeout(() => {
loading.textContent = "LOADING";
next();
}, 350);
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

tapLeft.addEventListener("click", () => { pauseAndResume(); prev(); });
tapRight.addEventListener("click", () => { pauseAndResume(); next(); });

render().then(() => startAuto());

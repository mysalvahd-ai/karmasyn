/* AMADEO — single exhibition prototype (Modigliani) */

const EXHIBITION = {
title: "MODIGLIANI",
// NOTE: using Wikimedia "thumb" URLs (960px) to avoid huge originals that often stall on mobile.
works: [
{
title: "Léon Bakst",
year: "1917",
location: "National Gallery of Art, Washington",
img: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Amedeo_Modigliani%2C_L%C3%A9on_Bakst%2C_1917%2C_NGA_46648.jpg/960px-Amedeo_Modigliani%2C_L%C3%A9on_Bakst%2C_1917%2C_NGA_46648.jpg"
},
{
title: "Girl in a Green Blouse",
year: "1917",
location: "National Gallery of Art, Washington",
img: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Amedeo_Modigliani_-_Girl_in_a_green_blouse_%281917%29.jpg/960px-Amedeo_Modigliani_-_Girl_in_a_green_blouse_%281917%29.jpg"
},
{
title: "Woman with Red Hair",
year: "1917",
location: "National Gallery of Art, Washington",
img: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Amedeo_Modigliani%2C_Woman_with_Red_Hair%2C_1917%2C_NGA_46651.jpg/960px-Amedeo_Modigliani%2C_Woman_with_Red_Hair%2C_1917%2C_NGA_46651.jpg"
},
{
title: "Madame Amédée (Woman with Cigarette)",
year: "1918",
location: "National Gallery of Art, Washington",
img: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Amedeo_Modigliani%2C_Madame_Am%C3%A9d%C3%A9e_%28Woman_with_Cigarette%29%2C_1918%2C_NGA_46647.jpg/960px-Amedeo_Modigliani%2C_Madame_Am%C3%A9d%C3%A9e_%28Woman_with_Cigarette%29%2C_1918%2C_NGA_46647.jpg"
},
{
title: "Beatrice (Portrait de Béatrice Hastings)",
year: "c. 1915–1916",
location: "Barnes Foundation, Philadelphia",
img: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Amedeo_Modigliani_-_Beatrice_%28Portrait_de_B%C3%A9atrice_Hastings%29_-_BF361_-_Barnes_Foundation.jpg/960px-Amedeo_Modigliani_-_Beatrice_%28Portrait_de_B%C3%A9atrice_Hastings%29_-_BF361_-_Barnes_Foundation.jpg"
},
{
title: "Boy in Sailor Suit",
year: "c. 1918",
location: "Barnes Foundation, Philadelphia",
img: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Amedeo_Modigliani_-_Boy_in_Sailor_Suit_-_BF369_-_Barnes_Foundation.jpg/960px-Amedeo_Modigliani_-_Boy_in_Sailor_Suit_-_BF369_-_Barnes_Foundation.jpg"
}
],

// Minimal “AI notes” shown every 5 works (prototype: soft, human, non-encyclopedic)
aiNotes: [
"Modigliani paints faces as if they were quiet masks: elongated, calm, almost inevitable. It’s intimacy without noise.",
"His portraits feel like a single breath: less “likeness” and more presence — the person as a mood.",
"The emptiness in the eyes isn’t cold: it’s space. A pause where you project your own feeling."
]
};

const artImg = document.getElementById("artImg");
const loading = document.getElementById("loading");
const exhTitle = document.getElementById("exhTitle");
const artLine = document.getElementById("artLine");
const artLoc = document.getElementById("artLoc");
const aiCard = document.getElementById("aiCard");
const aiText = document.getElementById("aiText");

const tapLeft = document.getElementById("tapLeft");
const tapRight = document.getElementById("tapRight");

exhTitle.textContent = EXHIBITION.title;

let idx = 0;
let timer = null;
let resumeTimer = null;
const AUTO_MS = 4000;
const RESUME_AFTER_MS = 1200; // after manual tap, wait a bit then resume auto

function clearTimers(){
if (timer) { clearInterval(timer); timer = null; }
if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; }
}

function startAuto(){
clearTimers();
timer = setInterval(next, AUTO_MS);
}

function pauseAndResume(){
if (timer) { clearInterval(timer); timer = null; }
if (resumeTimer) clearTimeout(resumeTimer);
resumeTimer = setTimeout(() => startAuto(), RESUME_AFTER_MS);
}

function showAIIfNeeded(){
// Every 5 works → show AI card (prototype behavior)
const show = ((idx + 1) % 5 === 0);
if (!show) {
aiCard.hidden = true;
return;
}
const noteIdx = Math.floor((idx + 1) / 5 - 1) % EXHIBITION.aiNotes.length;
aiText.textContent = EXHIBITION.aiNotes[noteIdx];
aiCard.hidden = false;
}

function setMeta(work){
artLine.textContent = `${work.title} · ${work.year}`;
artLoc.textContent = work.location ? work.location : "";
}

function loadImage(url){
return new Promise((resolve, reject) => {
const img = new Image();
img.crossOrigin = "anonymous";
img.onload = () => resolve(url);
img.onerror = () => reject(new Error("img load failed"));
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
// small delay makes fade-in smoother on iOS
requestAnimationFrame(() => {
artImg.classList.add("is-ready");
loading.style.display = "none";
});
}catch(e){
// If one image fails, skip to next quickly (but don’t lock in infinite spinner)
loading.textContent = "SKIPPING…";
setTimeout(() => {
loading.textContent = "LOADING";
next();
}, 450);
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

// Also allow keyboard on desktop
window.addEventListener("keydown", (e) => {
if (e.key === "ArrowLeft") { pauseAndResume(); prev(); }
if (e.key === "ArrowRight") { pauseAndResume(); next(); }
});

// Boot
render().then(() => startAuto());

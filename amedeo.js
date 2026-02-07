/* AMEDEO — Modigliani only (prototype)
- autoplay 4s
- tap left/right prev/next
- resumes autoplay after user stops
- curator note every 5 works
*/

const AUTOPLAY_MS = 4000;
const RESUME_AFTER_MS = 1600;
const NOTE_EVERY = 5;
const NOTE_SHOW_MS = 2500;

const $ = id => document.getElementById(id);
const imgA = $("imgA");
const imgB = $("imgB");
const loading = $("loading");
const metaYear = $("metaYear");
const metaLoc = $("metaLoc");
const note = $("note");
const noteText = $("noteText");

let activeImg = imgA;
let index = 0;
let autoplayTimer = null;
let idleTimer = null;
let lastInteraction = Date.now();

function filePath(filename){
return "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(filename);
}

const exhibition = {
name: "MODIGLIANI",
works: [
// These are filenames on Wikimedia Commons. If one fails, replace it with another Commons filename.
{ title:"Portrait of Jeanne Hébuterne", year:"1918", location:"—", img:filePath("Amedeo Modigliani - Jeanne Hébuterne - 1918.jpg") },
{ title:"Léon Bakst", year:"1917", location:"National Gallery of Art, Washington", img:filePath("Amedeo Modigliani, Léon Bakst, 1917, NGA 46648.jpg") },
{ title:"Girl in a Green Blouse", year:"1917", location:"National Gallery of Art, Washington", img:filePath("Amedeo Modigliani, Girl in a Green Blouse, 1917, NGA 46520.jpg") },
{ title:"Madame Amédée (Woman with Cigarette)", year:"1918", location:"National Gallery of Art, Washington", img:filePath("Amedeo Modigliani, Madame Amédée (Woman with Cigarette), 1918, NGA 46647.jpg") },
{ title:"Woman with Red Hair", year:"1917", location:"National Gallery of Art, Washington", img:filePath("Amedeo Modigliani, Woman with Red Hair, 1917, NGA 46651.jpg") },

{ title:"Beatrice Hastings", year:"c.1915", location:"Barnes Foundation", img:filePath("Amedeo Modigliani - Beatrice (Portrait de Béatrice Hastings) - BF361 - Barnes Foundation.jpg") },
{ title:"Boy in Sailor Suit", year:"c.1918", location:"Barnes Foundation", img:filePath("Amedeo Modigliani - Boy in Sailor Suit - BF369 - Barnes Foundation.jpg") },
{ title:"Léopold Zborowski", year:"c.1916", location:"Barnes Foundation", img:filePath("Amedeo Modigliani - Léopold Zborowksi - BF261 - Barnes Foundation.jpg") },
{ title:"Young Woman in Blue", year:"c.1918", location:"Barnes Foundation", img:filePath("Amedeo Modigliani - Young Woman in Blue (Giovane donna in azzurro) - BF268 - Barnes Foundation.jpg") },
{ title:"Redheaded Girl in Evening Dress", year:"c.1918", location:"Barnes Foundation", img:filePath("Amedeo Modigliani - Redheaded Girl in Evening Dress (Jeune fille rousse en robe de soir) - BF206 - Barnes Foundation.jpg") },

{ title:"Cagnes Landscape", year:"1919", location:"—", img:filePath("Modigliani - Cagnes Landscape, 1919.jpg") },
{ title:"La Petite Servante", year:"—", location:"Kunsthaus Zürich", img:filePath("Amedeo Modigliani - La Petite Servante - 1851 - Kunsthaus Zürich.jpg") },

// ✅ Add more works here (up to 40)
]
};

const curatorNotes = [
"The gaze does not explain itself. It waits.",
"Line is the structure. Everything else is quiet.",
"The face becomes a mask, not a portrait.",
"Intimacy here is silent, not emotional.",
"What looks simple is deeply intentional."
];

function setMeta(work) {
metaYear.textContent = work.year ? `• ${work.year}` : "";
metaLoc.textContent = `${work.title || ""}${work.location ? " — " + work.location : ""}`.trim();
}

function showNoteIfNeeded() {
if ((index + 1) % NOTE_EVERY === 0) {
noteText.textContent = curatorNotes[Math.floor((index / NOTE_EVERY)) % curatorNotes.length];
note.classList.add("is-on");
setTimeout(() => note.classList.remove("is-on"), NOTE_SHOW_MS);
} else {
note.classList.remove("is-on");
}
}

function swapImage(url) {
const next = (activeImg === imgA) ? imgB : imgA;
next.onload = () => {
imgA.classList.remove("is-on");
imgB.classList.remove("is-on");
next.classList.add("is-on");
activeImg = next;
loading.classList.add("hide");
};
next.onerror = () => {
// If one image fails, skip to next
nextWork();
};
next.src = url;
}

function render() {
const work = exhibition.works[index];
if (!work) return;
setMeta(work);
showNoteIfNeeded();
swapImage(work.img);
}

function nextWork() {
index = (index + 1) % exhibition.works.length;
render();
}

function prevWork() {
index = (index - 1 + exhibition.works.length) % exhibition.works.length;
render();
}

function stopAutoplay() {
clearInterval(autoplayTimer);
}

function startAutoplay() {
stopAutoplay();
autoplayTimer = setInterval(() => {
if (Date.now() - lastInteraction > AUTOPLAY_MS - 200) nextWork();
}, AUTOPLAY_MS);
}

function userAction() {
lastInteraction = Date.now();
stopAutoplay();
clearTimeout(idleTimer);
idleTimer = setTimeout(startAutoplay, RESUME_AFTER_MS);
}

$("tapZones").addEventListener("click", e => {
userAction();
const dir = e.target?.dataset?.dir;
if (dir === "1") nextWork();
else prevWork();
});

// Start
render();
startAutoplay();


/* AMEDEO — Infinite Exhibition
Prototype v0.1
Default exhibition: Modigliani
*/

const AUTOPLAY_MS = 4000;
const RESUME_AFTER_MS = 1600;
const NOTE_EVERY = 5;
const NOTE_SHOW_MS = 2500;

const $ = id => document.getElementById(id);

const imgA = $("imgA");
const imgB = $("imgB");
const loading = $("loading");
const metaTitle = $("metaTitle");
const metaYear = $("metaYear");
const metaLoc = $("metaLoc");
const note = $("note");
const noteText = $("noteText");

let activeImg = imgA;
let index = 0;
let autoplayTimer = null;
let idleTimer = null;
let lastInteraction = Date.now();

/* ===============================
MODIGLIANI — STATIC EXHIBITION
================================ */

const exhibition = {
name: "MODIGLIANI",
works: [
{
title: "Portrait of Jeanne Hébuterne",
year: "1918",
location: "Private collection",
img: "https://upload.wikimedia.org/wikipedia/commons/9/9b/Amedeo_Modigliani_-_Jeanne_H%C3%A9buterne_-_1918.jpg"
},
{
title: "Young Woman in a Blue Dress",
year: "1918",
location: "Solomon R. Guggenheim Museum",
img: "https://upload.wikimedia.org/wikipedia/commons/6/6e/Amedeo_Modigliani_-_Young_Woman_in_a_Blue_Dress.jpg"
},
{
title: "Seated Nude",
year: "1917",
location: "Royal Museum of Fine Arts, Antwerp",
img: "https://upload.wikimedia.org/wikipedia/commons/4/4f/Amedeo_Modigliani_-_Seated_Nude_-_1917.jpg"
},
{
title: "Portrait of Léopold Zborowski",
year: "1916",
location: "Private collection",
img: "https://upload.wikimedia.org/wikipedia/commons/7/7c/Amedeo_Modigliani_-_Portrait_of_L%C3%A9opold_Zborowski.jpg"
},
{
title: "Woman with Red Hair",
year: "1917",
location: "National Gallery of Art, Washington",
img: "https://upload.wikimedia.org/wikipedia/commons/3/3e/Amedeo_Modigliani_-_Woman_with_Red_Hair_-_1917.jpg"
}
// 👉 qui puoi aggiungere facilmente fino a 40 opere
]
};

/* ===============================
CURATOR NOTES
================================ */

const curatorNotes = [
"The gaze does not explain itself. It waits.",
"Modigliani stretches time through the body.",
"The face becomes a mask, not a portrait.",
"Intimacy here is silent, not emotional.",
"What looks simple is deeply intentional."
];

/* ===============================
RENDER
================================ */

function setMeta(work) {
metaTitle.textContent = exhibition.name;
metaYear.textContent = `• ${work.year}`;
metaLoc.textContent = `${work.title} — ${work.location}`;
}

function showNoteIfNeeded() {
if ((index + 1) % NOTE_EVERY === 0) {
noteText.textContent = curatorNotes[(index / NOTE_EVERY) % curatorNotes.length];
note.classList.add("is-on");
setTimeout(() => note.classList.remove("is-on"), NOTE_SHOW_MS);
} else {
note.classList.remove("is-on");
}
}

function swapImage(url) {
const next = activeImg === imgA ? imgB : imgA;
next.src = url;
next.onload = () => {
imgA.classList.remove("is-on");
imgB.classList.remove("is-on");
next.classList.add("is-on");
activeImg = next;
loading.classList.add("hide");
};
}

function render() {
const work = exhibition.works[index];
setMeta(work);
showNoteIfNeeded();
swapImage(work.img);
}

/* ===============================
NAVIGATION
================================ */

function next() {
index = (index + 1) % exhibition.works.length;
render();
}

function prev() {
index = (index - 1 + exhibition.works.length) % exhibition.works.length;
render();
}

function stopAutoplay() {
clearInterval(autoplayTimer);
}

function startAutoplay() {
stopAutoplay();
autoplayTimer = setInterval(() => {
if (Date.now() - lastInteraction > AUTOPLAY_MS - 200) {
next();
}
}, AUTOPLAY_MS);
}

function userAction() {
lastInteraction = Date.now();
stopAutoplay();
clearTimeout(idleTimer);
idleTimer = setTimeout(startAutoplay, RESUME_AFTER_MS);
}

/* ===============================
INIT
================================ */

document.getElementById("tapZones").addEventListener("click", e => {
userAction();
if (e.target.dataset.dir === "1") next();
else prev();
});

render();
startAutoplay();

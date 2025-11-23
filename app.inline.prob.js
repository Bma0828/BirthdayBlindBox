// Inline app with live probability & chart (patched threshold)
// Final Challenge threshold constant:
const FINAL_THRESHOLD = 280;
// Inline app with live probability & chart
window.PRICES_EMBED = [{"name": "Box1-4", "price": 109}, {"name": "LOVE", "price": 108}, {"name": "HOPE", "price": 114}, {"name": "SERENITY", "price": 114}, {"name": "LUCK", "price": 130}, {"name": "HAPPINESS", "price": 109}, {"name": "LOYALTY", "price": 103}, {"name": "Secret-ID", "price": 629}, {"name": "Box15-16", "price": 96}, {"name": "A", "price": 129}, {"name": "B", "price": 154}, {"name": "C", "price": 109}, {"name": "D", "price": 104}, {"name": "E", "price": 94}, {"name": "F", "price": 98}, {"name": "G", "price": 125}, {"name": "H", "price": 99}, {"name": "I", "price": 96}, {"name": "J", "price": 101}, {"name": "K", "price": 105}, {"name": "L", "price": 179}, {"name": "M", "price": 126}, {"name": "?", "price": 91}, {"name": "Secret-爱心", "price": 282}, {"name": "Box9-14", "price": 96}, {"name": "N", "price": 96}, {"name": "O", "price": 101}, {"name": "P", "price": 94}, {"name": "Q", "price": 98}, {"name": "R", "price": 144}, {"name": "S", "price": 105}, {"name": "T", "price": 94}, {"name": "U", "price": 130}, {"name": "V", "price": 103}, {"name": "W", "price": 111}, {"name": "X", "price": 107}, {"name": "Y", "price": 93}, {"name": "Z", "price": 99}, {"name": "&", "price": 115}, {"name": "Secret-!", "price": 254}, {"name": "Box7-8", "price": 127}, {"name": "LITTLE HAPPINESS", "price": 143}, {"name": "LITTLE SUPERMAN", "price": 127}, {"name": "LITTLE CUTIE", "price": 111}, {"name": "LITTLE SUN", "price": 135}, {"name": "LITTLE STAR", "price": 129}, {"name": "LITTLE YAWN", "price": 153}, {"name": "Secret-晚安星星人", "price": 299}, {"name": "Box5-6", "price": 119}, {"name": "KEEP SHINING", "price": 159}, {"name": "MESS IN WIND", "price": 194}, {"name": "RAIN ON ME", "price": 128}, {"name": "FLASH WARNING", "price": 124}, {"name": "AFTERGLOW MARSHMALLOW", "price": 119}, {"name": "HUG FROM SNOWMAN", "price": 110}, {"name": "Secret-好彩天天来", "price": 258}];


const state = {
  balance: 150,
  pool: Array.from({length: 16}, (_, i) => i + 1),
  opened: [],
  currentRoll: null,
  pricesRaw: [],
  ranges: [],
  session: null,
  boxMap: {}
};

const $ = (sel) => document.querySelector(sel);
const view = $("#view");
const fmt = (n) => Number(n).toLocaleString();

async function loadPrices() {
  const data = window.PRICES_EMBED;
  state.pricesRaw = data;

  const ranges = [];
  let current = null;
  for (const row of data) {
    const nm = String(row.name || "").trim();
    const pr = row.price;
    const headerMatch = nm.match(/^Box(\d+)-(\d+)$/i);
    if (headerMatch) {
      if (current) ranges.push(current);
      current = {
        label: nm,
        start: parseInt(headerMatch[1], 10),
        end: parseInt(headerMatch[2], 10),
        purchasePrice: (typeof pr === "number" ? pr : 0),
        items: []
      };
      continue;
    }
    if (current && nm) current.items.push({name:nm, price: (typeof pr === "number" ? pr : 0)});
  }
  if (current) ranges.push(current);
  state.ranges = ranges;

  // Build boxMap: non-secret items only
  const boxMap = {};
  for (const rg of ranges) {
    const items = rg.items.filter(it => !String(it.name).toLowerCase().startsWith("secret"));
    for (let n = rg.start; n <= rg.end; n++) {
      boxMap[n] = { purchase: rg.purchasePrice, items, nChoices: items.length };
    }
  }
  state.boxMap = boxMap;
}

function updateHUD() {
  $("#balance").textContent = fmt(state.balance);
  $("#openedCount").textContent = state.opened.length;
  $("#remainingPool").textContent = state.pool.join(", ");
  // Trigger probability update (debounced minimal)
  updateProbabilities();
}

function homeView() {
  const canFinal = state.balance >= FINAL_THRESHOLD;
  view.innerHTML = `
    <div class="panel center">
      <p class="kicker">Welcome, U1! 🎁</p>
      <p class="big">Roll to get a box number from 1–16. Boxes are unique — once opened, they're gone.</p>
      <div class="btnrow" style="justify-content:center; margin-top: 12px;">
        <button id="rollBtn">Roll!</button>
        <button id="finalBtn" class="${canFinal ? 'secondary' : 'ghost'}">Final Prize Challenge</button>
      </div>
      ${!canFinal ? `<p style="margin-top:10px; color:#ef476f;">U1 needs at least 280 to enter final challenge.</p>` : ""}
    </div>
  `;
  $("#rollBtn").onclick = onRoll;
  $("#finalBtn").onclick = () => {
    if (state.balance < FINAL_THRESHOLD) { alert("U1 needs at least 280 to enter final challenge"); return; }
    finalChallengeIntro();
  };
}

function onRoll() {
  if (state.pool.length === 0) { alert("All boxes are opened!"); return; }
  const idx = Math.floor(Math.random() * state.pool.length);
  const number = state.pool[idx];
  state.currentRoll = number;

  view.innerHTML = `
    <div class="panel">
      <div class="range-tag">🎲 You rolled: <strong>#${number}</strong></div>
      <p class="kicker">Choose to buy this box or re-roll. Re-rolling keeps this number in the pool.</p>
      <div class="btnrow">
        <button id="buyBtn" class="success">Buy this box</button>
        <button id="rerollBtn" class="warn">Re-roll</button>
        <button id="backHome" class="ghost">Back</button>
      </div>
    </div>
  `;
  $("#buyBtn").onclick = () => startPurchase(number);
  $("#rerollBtn").onclick = () => onRoll();
  $("#backHome").onclick = homeView;
}

function findRangeForNumber(num) { return state.ranges.find(r => num >= r.start && num <= r.end); }

function startPurchase(num) {
  const range = findRangeForNumber(num);
  if (!range) { alert("No price range found for this box number."); homeView(); return; }
  state.session = { number: num, rangeLabel: range.label, purchasePrice: range.purchasePrice, items: range.items, guess: null };
  renderPrediction();
}

function renderPrediction() {
  const s = state.session;
  const options = s.items.map(({name}) => `<button class="choiceBtn" data-name="${name}">${name}</button>`).join("");
  view.innerHTML = `
    <div class="panel">
      <div class="range-tag">Box #${s.number} • ${s.rangeLabel}</div>
      <p class="big">Do not open yet — make a guess!</p>
      <p class="kicker">Choose your prediction:</p>
      <div class="btnrow" style="flex-wrap: wrap;">${options}</div>
      <hr/><div class="btnrow"><button id="cancel" class="ghost">Cancel</button></div>
    </div>
  `;
  document.querySelectorAll(".choiceBtn").forEach(btn => {
    btn.addEventListener("click", e => { state.session.guess = e.currentTarget.getAttribute("data-name"); renderOpenPrompt(); });
  });
  $("#cancel").onclick = homeView;
}

function renderOpenPrompt() {
  const s = state.session;
  if (!s._deducted) { state.balance -= s.purchasePrice; s._deducted = true; }
  updateHUD();
  const options = s.items.map(({name}) => `<button class="choiceBtn" data-name="${name}">${name}</button>`).join("");
  view.innerHTML = `
    <div class="panel">
      <div class="range-tag">Prediction: <strong>${s.guess}</strong> • Cost: $${s.purchasePrice}</div>
      <p class="big">Now open the physical box and click the button matching your result.</p>
      <div class="grid">${options}</div>
      <hr/><div class="btnrow"><button id="abort" class="ghost">Abort</button></div>
    </div>
  `;
  document.querySelectorAll(".choiceBtn").forEach(btn => {
    btn.addEventListener("click", e => completePurchase(e.currentTarget.getAttribute("data-name")));
  });
  $("#abort").onclick = () => { if (s._deducted) state.balance += s.purchasePrice; state.session = null; updateHUD(); homeView(); };
}

function completePurchase(resultName) {
  const s = state.session;
  const item = s.items.find(x => x.name === resultName);
  const itemPrice = item?.price ?? 0;
  state.balance += itemPrice;
  if (s.guess === resultName) state.balance += 10;
  state.opened.push(s.number);
  state.pool = state.pool.filter(n => n !== s.number);
  updateHUD();
  view.innerHTML = `
    <div class="panel center">
      <p class="big">Result for Box #${s.number}: <strong>${resultName}</strong></p>
      <p class="kicker">Item value: $${itemPrice}${s.guess === resultName ? " • Correct guess bonus: +$10 🎉" : ""}</p>
      <p>Your new balance is: <strong>$${fmt(state.balance)}</strong></p>
      <div class="btnrow" style="justify-content:center; margin-top: 12px;">
        <button id="home">Back to Home</button>
      </div>
    </div>`;
  $("#home").onclick = () => { state.session = null; homeView(); };
}

/* ========= Final Challenge ========= */
function finalChallengeIntro() {
  const x = state.opened.length, y = state.balance;
  view.innerHTML = `
    <div class="panel center">
      <p class="big">Final Prize Challenge</p>
      <p>You have already got <strong>${x}</strong> blind box(es), the net worth is <strong>$${fmt(y)}</strong>.</p>
      <p class="kicker">Are you willing to spend all boxes and money to get a final roll: <strong>Box 1126</strong>?</p>
      <p class="kicker">If you choose <strong>Yes</strong>, B will receive a text message and come back to collect all open boxes.</p>
      <p class="kicker">If you choose <strong>No</strong>, you may keep all boxes but B will come back to collect <strong>Box 1126</strong>.</p>
      <div class="btnrow" style="justify-content:center; margin-top: 12px;">
        <button id="yes" class="success">Yes</button>
        <button id="no" class="warn">No</button>
        <button id="home" class="ghost">Back</button>
      </div>
    </div>`;
  $("#yes").onclick = finalYes;
  $("#no").onclick = finalNo;
  $("#home").onclick = homeView;
}

function finalYes() {
  view.innerHTML = `
    <div class="panel center">
      <p class="big">Open Box 1126</p>
      <p>Please input the name of the item you get (in Chinese):</p>
      <input id="answer" type="text" placeholder="请输入答案…" style="padding:10px;border-radius:8px;border:1px solid rgba(255, 107, 156, 0.35);background:#fff;color:#2d3748;width:280px;"/>
      <div class="btnrow" style="justify-content:center; margin-top: 12px;">
        <button id="submit" class="secondary">Submit</button>
        <button id="back" class="ghost">Back</button>
      </div>
      <p class="kicker" style="margin-top:12px;">(Only one correct answer.)</p>
    </div>`;
  $("#submit").onclick = () => { const val = ($("#answer").value || "").trim(); if (val === "花园") finalWin(); else alert("Incorrect. Try again."); };
  $("#back").onclick = finalChallengeIntro;
}

function finalWin() {
  const x = state.opened.length;
  view.innerHTML = `
    <div class="panel center">
      <p class="big">Happy Birthday U1!!!! 🎉🎂</p>
      <p>Because of your brave heart and lucky hand, you have a balance of <strong>${x}</strong> number of blind boxes of any brand, any size from B.</p>
      <p>Please screenshot this page as the ticket! Happy 1126~</p>
      <div class="btnrow" style="justify-content:center; margin-top: 12px;">
        <button id="restart">Restart</button>
      </div>
    </div>`;
  $("#restart").onclick = resetGame;
}

function finalNo() {
  view.innerHTML = `
    <div class="panel center">
      <p class="big">Happy Birthday U1!!</p>
      <p>B will NOT collect anything but he knows you are small air ghost!</p>
      <p>Open the 1126 box anyway to collect the final gift!</p>
      <div class="btnrow" style="justify-content:center; margin-top: 12px;">
        <button id="home">Back to Home</button>
      </div>
    </div>`;
  $("#home").onclick = homeView;
}

function resetGame() {
  state.balance = 150;
  state.pool = Array.from({length: 16}, (_, i) => i + 1);
  state.opened = [];
  state.currentRoll = null;
  state.session = null;
  updateHUD();
  homeView();
}

/* ========= Probability Model ========= */
/* Simulate from CURRENT state to estimate P(reach threshold) given:
   - Remaining pool (numbers)
   - Current balance
   - Buy every box, outcomes uniform among NON-secret items in each range
   - Optional random guess bonus (+$10 with probability 1/choices)
*/
function simulateOnce(threshold, withGuess=false) {
  let balance = state.balance;
  const pool = state.pool.slice(); // remaining numbers
  // random shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  for (const num of pool) {
    const info = state.boxMap[num];
    balance -= info.purchase;
    if (info.items.length > 0) {
      const item = info.items[Math.floor(Math.random() * info.items.length)];
      balance += item.price;
      if (withGuess && info.nChoices > 0) {
        if (Math.random() < 1 / info.nChoices) balance += 10;
      }
    }
    if (balance >= threshold) return true;
  }
  return false;
}

let probTimer = null;
function updateProbabilities() {
  if (probTimer) cancelAnimationFrame(probTimer);
  probTimer = requestAnimationFrame(() => {
    const N = 5000; // keep fast per step
    const threshold = 280;

    let hitA = 0, hitB = 0;
    for (let i = 0; i < N; i++) {
      if (simulateOnce(threshold, false)) hitA++;
      if (simulateOnce(threshold, true)) hitB++;
    }
    const pA = hitA / N, pB = hitB / N;
    $("#pNoGuess").textContent = (pA*100).toFixed(1) + "%";
    $("#pGuess").textContent = (pB*100).toFixed(1) + "%";

    // draw curve for thresholds
    drawCurve();
  });
}

function drawCurve() {
  const cvs = $("#probChart");
  if (!cvs) return;
  const ctx = cvs.getContext("2d");
  const W = cvs.width, H = cvs.height;
  ctx.clearRect(0,0,W,H);

  const thresholds = [240,250,260,270,280,290,300,310,320];
  const N = 2000; // lighter for curve
  const pNo = [], pGe = [];

  for (const T of thresholds) {
    let a=0,b=0;
    for (let i=0;i<N;i++) { if (simulateOnce(T,false)) a++; if (simulateOnce(T,true)) b++; }
    pNo.push(a/N); pGe.push(b/N);
  }

  // axes
  ctx.strokeStyle = "#e9c3d2";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(35, 10);
  ctx.lineTo(35, H-25);
  ctx.lineTo(W-10, H-25);
  ctx.stroke();

  function plot(series, color) {
    const minT = thresholds[0], maxT = thresholds[thresholds.length-1];
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    series.forEach((p, idx) => {
      const T = thresholds[idx];
      const x = 35 + (W-45) * (T - minT) / (maxT - minT);
      const y = (H-25) - (H-35) * p;
      if (idx===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
    // points
    series.forEach((p, idx) => {
      const T = thresholds[idx];
      const x = 35 + (W-45) * (T - minT) / (maxT - minT);
      const y = (H-25) - (H-35) * p;
      ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
    });
  }

  plot(pNo, "#ff9ac0");   // no-guess = light pink
  plot(pGe, "#a78bfa");   // guess = lavender

  // highlight T=280
  const tIdx = thresholds.indexOf(280);
  if (tIdx >= 0) {
    const p = pGe[tIdx];
    const x = 35 + (W-45) * (280 - thresholds[0]) / (thresholds[thresholds.length-1]-thresholds[0]);
    const y = (H-25) - (H-35) * p;
    ctx.fillStyle = "#ff417d";
    ctx.beginPath(); ctx.arc(x,y,4.5,0,Math.PI*2); ctx.fill();
  }
}

document.addEventListener("click", (e) => {
  if (e.target && e.target.id === "refreshProb") {
    updateProbabilities();
  }
});

(async function init() {
  await loadPrices();
  updateHUD();
  homeView();
  // initial probability draw
  updateProbabilities();
})();

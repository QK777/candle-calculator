/* ============================================================
   Sky キャンドル計算機 main.js
   ------------------------------------------------------------
   ✔ パン屋 + パン屋2 合算 → 最大1000（460処理含む）
   ✔ Sunday モード
   ✔ Undo 対応
   ✔ スマホ用「15 → 16」しきい値表示
   ✔ ゲージアニメーション
   ✔ カテゴリ小計（ソーシャルも1000上限で補正）
   ✔ ローカルストレージ保存
   ✔ ロウソクアイコン差し替え & ボヨンアニメ
   ✔ 合計スロット：変化した桁だけ回転
   ============================================================ */


/* ===================
   データ定義
=================== */
const categories = ["孤島","草原","雨林","峡谷","捨てられた地","書庫","その他","ソーシャル"];

const items = [
  ["砂丘","予言者の石窟","水の試練","土の試練","風の試練","火の試練"],
  ["蝶々の住処","草原の村","洞窟","8人エリア","鳥の巣","楽園の島々"],
  ["開拓地","小川","神殿前","高台広場","神殿","ツリーハウス","地下洞窟"],
  ["スロープ","陸レース","要塞","空レース","コロセウム","神殿","夢見の町","隠者","隠者レース"],
  ["倒壊した祠","墓地","戦場","座礁船","箱舟","秘宝"],
  ["１階","２階","３階","４階","最上部","保存庫","資料庫","星月夜の砂漠","オフィス"],
  ["花鳥郷","ホーム","シナモン","大キャン4","大キャン4","風の街道"],
  ["パン屋","パン屋2","ウニ焼き","ウニ焼き2","闇の欠片"]
];

const values = [
  [200,50,100,105,200,200],
  [55,119,45,99,50,299],
  [45,227,175,42,83,55,57],
  [104,135,79,150,10,93,100,50,215],
  [65,92,111,63,109,188],
  [69,110,12,222,64,31,50,140,57],
  [23,23,50,200,200,80],
  [540,540,300,300,200]
];

// 日曜版
const sundayValues = [
  [200,50,100,105,200,200],
  [55,119,45,99,50,299],
  [45,227,175,42,83,55,57],
  [104,135,79,150,10,93,100,50,215],
  [86,119,139,101,109,188],
  [69,110,12,222,64,31,50,140,57],
  [23,23,50,200,200,80],
  [540,540,300,300,200]
];


/* ============================
   キャンドルしきい値
============================= */
const candleThresholds = [
  {max:93,candles:0},{max:187,candles:1},{max:281,candles:2},{max:375,candles:3},
  {max:469,candles:4},{max:608,candles:5},{max:747,candles:6},{max:886,candles:7},
  {max:1025,candles:8},{max:1164,candles:9},{max:1342,candles:10},{max:1520,candles:11},
  {max:1698,candles:12},{max:1876,candles:13},{max:2054,candles:14},{max:2267,candles:15},
  {max:2480,candles:16},{max:2718,candles:17},{max:3206,candles:18},{max:4194,candles:19},
  {max:Infinity,candles:20}
];

// 上側ラベルで使用
const thresholdMap = {
  15:2055,16:2268,17:2481,18:2719,19:3207,20:4195
};


/* ============================
   Sunday モード
============================= */
let activeValues = values;
let sundayMode = false;
const SUNDAY_MODE_KEY = "sky_candle_sunday_mode";


/* ============================
   DOM
============================= */
const mainPanel = document.getElementById("mainPanel");
const totalLabel = document.getElementById("total");
const gaugeFill = document.getElementById("gaugeFill");
const gaugeMarker = document.getElementById("gaugeMarker");
const gaugeTrack = document.getElementById("gaugeTrack");
const topLabelLayer = document.getElementById("topLabelLayer");
const bottomLabelLayer = document.getElementById("bottomLabelLayer");
const resetButton = document.getElementById("resetButton");
const undoButton = document.getElementById("undoButton");
const dailyListEl = document.getElementById("dailyList");

let checkBoxes = [];
let categorySumTags = [];
let sundaySwitchInput = null;
let lastCandles = 0;

// Undo 用
let undoState = null;


/* ============================================================
   ゲージのメモリ線（0〜20の中間線）生成
============================================================ */
for (let i = 1; i <= 19; i++) {
  const mem = document.createElement("div");
  mem.classList.add("gauge-segment");
  mem.style.left = (i / 20 * 100) + "%";
  if (i === 5 || i === 10 || i === 15) {
    mem.classList.add("major");
  }
  gaugeTrack.appendChild(mem);
}


/* ============================================================
   DOM生成：カテゴリ & アイテム
============================================================ */
categories.forEach((cat,i)=>{
  const card=document.createElement("div");
  card.className="category";

  const head=document.createElement("div");
  head.className="category-header";

  const leftBox=document.createElement("div");
  leftBox.className="category-left";

  // ---- カテゴリ全 ON/OFF ----
  const toggle=document.createElement("input");
  toggle.type="checkbox";
  toggle.className="category-toggle";

  toggle.addEventListener("change",()=>{
    items[i].forEach((_,j)=>{
      const cb=checkBoxes[i][j];
      cb.checked=toggle.checked;
      localStorage.setItem(cb.id,cb.checked);
      cb.parentElement.classList.toggle("checked",cb.checked);
    });
    updateTotal();
    updateCategoryTotals();
  });

  const titleWrap=document.createElement("div");
  titleWrap.className="category-title";

  const label=document.createElement("span");
  label.className="category-label";
  label.textContent=cat;

  const sumTag=document.createElement("span");
  sumTag.className="category-sum";
  sumTag.textContent="(+0)";
  categorySumTags[i]=sumTag;

  titleWrap.appendChild(label);
  titleWrap.appendChild(sumTag);

  leftBox.appendChild(toggle);
  leftBox.appendChild(titleWrap);
  head.appendChild(leftBox);

  // ---- 捨てられた地に Sunday モードボタン ----
  if(i===4){
    const sundayContainer = document.createElement("div");
    sundayContainer.className = "sunday-toggle-container";

    const text = document.createElement("span");
    text.className = "sunday-label-text";
    text.textContent = "日曜日";

    const sundayWrap=document.createElement("label");
    sundayWrap.className="sunday-switch";

    const sunInput=document.createElement("input");
    sunInput.type="checkbox";
    sunInput.id="sundayToggle";

    const slider=document.createElement("span");
    slider.className="sunday-slider";

    sundayWrap.appendChild(sunInput);
    sundayWrap.appendChild(slider);

    sundayContainer.appendChild(text);
    sundayContainer.appendChild(sundayWrap);
    head.appendChild(sundayContainer);

    sundaySwitchInput = sunInput;

    sunInput.addEventListener("change",()=>{
      sundayMode = sunInput.checked;
      localStorage.setItem(SUNDAY_MODE_KEY, sundayMode);
      applySundayMode();
    });
  }

  card.appendChild(head);

  const list=document.createElement("div");
  list.className="items";

  checkBoxes[i]=[];

  items[i].forEach((name,j)=>{
    const wrap=document.createElement("label");
    wrap.className="check-wrapper";

    const cb=document.createElement("input");
    cb.type="checkbox";
    cb.className="check-input";
    cb.id=`cb_${i}_${j}`;
    cb.dataset.value=activeValues[i][j];

    // restore from localStorage
    cb.checked = localStorage.getItem(cb.id)==="true";
    wrap.classList.toggle("checked",cb.checked);

    cb.addEventListener("change",()=>{
      localStorage.setItem(cb.id,cb.checked);
      wrap.classList.toggle("checked",cb.checked);
      updateTotal();
      updateCategoryTotals();
    });

    const ns=document.createElement("span");
    ns.className="item-name";
    ns.textContent=name;

    const vs=document.createElement("span");
    vs.className="item-value";
    vs.textContent=`+${cb.dataset.value}`;

    wrap.appendChild(cb);
    wrap.appendChild(ns);
    wrap.appendChild(vs);

    list.appendChild(wrap);
    checkBoxes[i][j]=cb;
  });

  card.appendChild(list);
  mainPanel.appendChild(card);
});


/* ============================================================
   合計キャンドル数 → 本数
============================================================ */
function getCandleCount(t){
  for(const x of candleThresholds){
    if(t<=x.max) return x.candles;
  }
  return 0;
}


/* ============================================================
   パン屋ロジック（540+540 = 見た目460 / 実計算上1000 まで）
============================================================ */
function calcPanya(){
  const p1 = checkBoxes[7][0];
  const p2 = checkBoxes[7][1];

  const v1 = parseInt(p1.dataset.value,10);
  const v2 = parseInt(p2.dataset.value,10);

  let s = 0;
  if(p1.checked) s += v1;
  if(p2.checked) s += v2;

  // 最大1000
  const capped = Math.min(s, 1000);

  // パン屋2の表示操作
  const p2Label = p2.parentElement.querySelector(".item-value");
  if (p1.checked && p2.checked){
    p2Label.textContent = "+460";
    p2Label.style.color = "red";
    p2Label.style.fontWeight = "700";
  } else {
    p2Label.textContent = `+${v2}`;
    p2Label.style.color = "";
    p2Label.style.fontWeight = "";
  }

  return {raw:s, capped};
}


/* ============================================================
   合計計算（スロット4桁アニメ付き・変化した桁だけ回転）
============================================================ */
let prevDigits = null;
let slotInitialized = false;

function initTotalSlotDisplay() {
  if (slotInitialized) return;
  slotInitialized = true;

  // スロット4桁のHTMLを生成
  let slotInner = "";
  for (let i = 0; i < 4; i++) {
    slotInner += `
      <span class="digit-slot">
        <span class="digit-reel" id="slot_reel_${i}">
          <span>0</span>
          <span>1</span>
          <span>2</span>
          <span>3</span>
          <span>4</span>
          <span>5</span>
          <span>6</span>
          <span>7</span>
          <span>8</span>
          <span>9</span>
        </span>
      </span>`;
  }

  totalLabel.innerHTML = `
    合計：
    <span id="totalSlot" class="slot-wrapper">
      ${slotInner}
    </span>
    （<span id="totalCandles">0</span>キャンドル）
  `;
}

function updateTotal(){
  let total = 0;

  // ▼ 初回のみ：スロットDOM構築
  initTotalSlotDisplay();

  // 全アイテム合計
  checkBoxes.forEach(row=>{
    row.forEach(cb=>{
      if(cb.checked){
        total += parseInt(cb.dataset.value,10);
      }
    });
  });

  // パン屋補正（raw → capped に差し替え）
  const {raw, capped} = calcPanya();
  total = total - raw + capped;

  const c = getCandleCount(total);

  // キャンドル本数表示だけ更新
  const candleSpan = document.getElementById("totalCandles");
  if (candleSpan) {
    candleSpan.textContent = c;
  }

  /* ----------------------------
     ▼ スロット4桁に変換（ゼロ埋め）
  ---------------------------- */
  const padded = total.toString().padStart(4, "0");
  const digits = padded.split(""); // [ "0","1","2","3" ]

  /* ----------------------------
     ▼ スロットに数字を反映（変化した桁だけアニメ）
  ---------------------------- */
  digits.forEach((d, i) => {
    const reel = document.getElementById(`slot_reel_${i}`);
    if (!reel) return;

    const offset = parseInt(d, 10) * -32;  // サイズ32px（上方向へスクロール）

    // 初回は prevDigits が null → 全桁アニメ
    if (prevDigits === null) {
      reel.style.transition = "transform 0.45s ease-out";
      requestAnimationFrame(() => {
        reel.style.transform = `translateY(${offset}px)`;
      });
      return;
    }

    const prev = prevDigits[i];

    // ▼ 同じ数字 → 何もしない（位置もそのまま、回転もしない）
    if (prev === d) {
      return;
    }

    // ▼ 異なる数字 → アニメさせる
    reel.style.transition = "transform 0.45s ease-out";
    requestAnimationFrame(() => {
      reel.style.transform = `translateY(${offset}px)`;
    });
  });

  // 次回比較用に保存
  prevDigits = digits;

  updateGauge(c, total);
  updateDailyList();
}


/* ============================================================
   カテゴリ小計（ソーシャルのみパン屋補正）
============================================================ */
function updateCategoryTotals(){
  categories.forEach((cat,i)=>{
    let sum = 0;

    // まず通常の合計
    checkBoxes[i].forEach(cb=>{
      if(cb.checked) sum += parseInt(cb.dataset.value,10);
    });

    // ソーシャルカテゴリだけパン屋補正
    if(i === 7){
      const p1 = checkBoxes[7][0];
      const p2 = checkBoxes[7][1];

      const v1 = parseInt(p1.dataset.value,10);
      const v2 = parseInt(p2.dataset.value,10);

      let raw = 0;
      if(p1.checked) raw += v1;
      if(p2.checked) raw += v2;

      const capped = Math.min(raw, 1000);

      // 生のパン屋合計 raw を capped に置き換え
      sum = sum - raw + capped;
    }

    const tag=categorySumTags[i];
    const newText=`(+${sum})`;

    if(tag.textContent!==newText){
      tag.textContent=newText;
      tag.classList.add("flash");
      setTimeout(()=>tag.classList.remove("flash"),250);
    }
  });
}


/* ==========================================
   ロウソクアイコンの差し替え処理
========================================== */
function updateCandleIcon(total) {
  let newIcon = "";

  // ▼ アイコン選択
  if (total <= 607) {
    newIcon = "Sky_Candle3.png";
  } else if (total <= 1341) {
    newIcon = "Sky_Candle2.png";
  } else if (total <= 2054) {
    newIcon = "Sky_Candle1.png";
  } else if (total <= 4194) {
    newIcon = "Sky_Candle0.png";
  } else {
    newIcon = "Sky_Candle0-.png"; // 灰キャン
  }

  const img = gaugeMarker.querySelector("img");
  if (!img) return;

  if (img.dataset.currentIcon !== newIcon) {
    img.dataset.currentIcon = newIcon;
    img.src = newIcon;

    gaugeMarker.classList.add("flash-icon");
    setTimeout(() => gaugeMarker.classList.remove("flash-icon"), 900);
  }

  gaugeMarker.classList.add("bounce");
  setTimeout(() => gaugeMarker.classList.remove("bounce"), 500);
}


/* ============================================================
   ゲージ更新（スマホ時だけロウソク位置補正）
============================================================ */
function updateGauge(c, total){
  const ratio = c / 20;

  if (c > lastCandles) {
    gaugeFill.classList.add("flash");
    setTimeout(()=>gaugeFill.classList.remove("flash"),450);

    gaugeMarker.classList.add("flash");
    setTimeout(()=>gaugeMarker.classList.remove("flash"),450);
  }

  gaugeFill.style.width = (ratio * 100) + "%";

  /* 🔥 スマホ専用ロウソク位置補正 */
  let offset = 0;
  if (window.matchMedia("(max-width: 480px)").matches) {
    offset = 4;   
  }

  gaugeMarker.style.left = `calc(${ratio * 100}% + ${offset}px)`;

  lastCandles = c;

  updateCandleIcon(total);
}

/* ============================================================
   スマホ向け：15 → 16 表示
============================================================ */
function updateDailyList(){
  const isMobile=window.matchMedia("(max-width: 480px)").matches;
  if(!isMobile){
    dailyListEl.textContent="";
    return;
  }

  // 再計算（パン屋補正込み）
  let total = 0;
  checkBoxes.forEach(r=>r.forEach(cb=>{
    if(cb.checked) total += parseInt(cb.dataset.value,10);
  }));

  const {raw,capped} = calcPanya();
  total = total - raw + capped;

  const thresholds = [
    { base: 2055, next: 2268, candle: 15 },
    { base: 2268, next: 2481, candle: 16 },
    { base: 2481, next: 2719, candle: 17 },
    { base: 2719, next: 3207, candle: 18 },
    { base: 3207, next: 4195, candle: 19 }
  ];

  let baseText="", nextText="", glow=false;

  if(total>=4195){
    baseText = `4195（20キャンドル）`;
    nextText = `灰キャン`;
    glow = true;
  } else {
    let found=false;

    if(total < 2055){
      baseText = `2055（15キャンドル）`;
      nextText = `2268（16キャンドル）`;
      found=true;
    }

    for(const t of thresholds){
      if(total >= t.base && total < t.next){
        baseText = `${t.base}（${t.candle}キャンドル）`;
        nextText = `${t.next}（${t.candle+1}キャンドル）`;
        glow=true;
        found=true;
        break;
      }
    }

    if(!found){
      baseText = `3207（19キャンドル）`;
      nextText = `4195（20キャンドル）`;
      glow=true;
    }
  }

  dailyListEl.innerHTML = `
    <span class="sp-line1 ${glow ? "sp-glow" : ""}">
      ${baseText}
    </span>
    <div class="sp-line2">
      <span><span class="sp-arrow">➡：</span>${nextText}</span>
    </div>
  `;
}


/* ============================================================
   上側ラベル配置
============================================================ */
function placeTopLabels(){
  topLabelLayer.innerHTML="";
  const rect=gaugeTrack.getBoundingClientRect();
  const topY=rect.top-24;

  for(let c=15;c<=20;c++){
    const v=thresholdMap[c];
    const label=document.createElement("div");
    label.className="gauge-top-label";
    label.textContent=v;

    const px=rect.left + rect.width*(c/20);
    label.style.left=px+"px";
    label.style.top=topY+"px";

    topLabelLayer.appendChild(label);
  }
}


/* ============================================================
   下側ラベル配置
============================================================ */
function placeBottomLabels(){
  bottomLabelLayer.innerHTML="";

  for(const n of [0,5,10,15,20]){
    const ratio = n / 20;
    const label=document.createElement("div");
    label.className="bottom-gauge-label";
    label.textContent=n;
    label.style.left = (ratio * 100) + "%";
    label.style.top = "0px";
    bottomLabelLayer.appendChild(label);
  }
}


/* ============================================================
   Sunday モード適用
============================================================ */
function applySundayMode(){
  activeValues = sundayMode ? sundayValues : values;

  categories.forEach((cat,i)=>{
    items[i].forEach((name,j)=>{
      const cb = checkBoxes[i][j];
      const v  = activeValues[i][j];
      cb.dataset.value = v;

      const vs = cb.parentElement.querySelector(".item-value");
      vs.textContent = `+${v}`;
    });
  });

  updateTotal();
  updateCategoryTotals();
}


/* ============================================================
   Undo
============================================================ */
function snapshotState(){
  return checkBoxes.map(row => row.map(cb => cb.checked));
}

function restoreState(state){
  checkBoxes.forEach((row,i)=>{
    row.forEach((cb,j)=>{
      const checked = state[i][j];
      cb.checked = checked;
      localStorage.setItem(cb.id, checked);
      cb.parentElement.classList.toggle("checked", checked);
    });
  });

  document.querySelectorAll(".category-toggle").forEach((toggle,i)=>{
    const allChecked = state[i].every(v=>v);
    toggle.checked = allChecked;
  });

  updateTotal();
  updateCategoryTotals();
  placeTopLabels();
  placeBottomLabels();
  updateDailyList();
}

function updateUndoButton(){
  undoButton.style.display = undoState ? "inline-block" : "none";
}


/* ============================================================
   リセット
============================================================ */
resetButton.onclick=()=>{
  undoState = snapshotState();
  updateUndoButton();

  checkBoxes.forEach(row=>
    row.forEach(cb=>{
      cb.checked=false;
      localStorage.setItem(cb.id,false);
      cb.parentElement.classList.remove("checked");
    })
  );

  document.querySelectorAll(".category-toggle").forEach(a=>a.checked=false);

  updateTotal();
  updateCategoryTotals();
  placeTopLabels();
  placeBottomLabels();
  updateDailyList();
};


/* ============================================================
   Undo
============================================================ */
undoButton.onclick=()=>{
  if(!undoState) return;
  restoreState(undoState);
  undoState = null;
  updateUndoButton();
};


/* ============================================================
   wrapクリックでチェックトグル
============================================================ */
function applyWrapToggle(){
  checkBoxes.forEach(row=>{
    row.forEach(cb=>{
      const wrap=cb.parentElement;
      wrap.addEventListener("click",()=>{
        cb.checked=!cb.checked;
        localStorage.setItem(cb.id,cb.checked);
        wrap.classList.toggle("checked",cb.checked);
        updateTotal();
        updateCategoryTotals();
      });
    });
  });
}


/* ============================================================
   初期化
============================================================ */
window.addEventListener("load",()=>{
  // Sunday モード復元
  const savedMode = localStorage.getItem(SUNDAY_MODE_KEY);
  if(savedMode === "true"){
    sundayMode = true;
    if(sundaySwitchInput) sundaySwitchInput.checked = true;
  }
  applySundayMode();

  updateTotal();
  updateCategoryTotals();
  placeTopLabels();
  placeBottomLabels();
  updateDailyList();
  applyWrapToggle();
  updateUndoButton();
});


/* ============================================================
   リサイズ時
============================================================ */
window.addEventListener("resize",()=>{
  placeTopLabels();
  placeBottomLabels();
  updateDailyList();
});

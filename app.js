import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  runTransaction,
  Timestamp,
  getCountFromServer
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ROUND_LABELS = {
  round1: "第一次抽選",
  round2: "第二次抽選",
  final: "最終抽選"
};
const ROUND_ORDER = ["round1", "round2", "final"];

const initialPrograms = [
  {
    programId: "p01",
    order: 1,
    capacity: 40,
    title: "環境負荷を軽減する有機的考えから耕作放棄地を解消。新しい農業の形を考えるツアー",
    tags: ["耕作放棄地", "第一次産業", "農ある暮らし"],
    description: "全国で40万haある耕作放棄地のうち、都市近郊の農地に注目し、レンタル農園サービスや農作業体験を通じて、新しい農業の形を考えます。",
    imageUrl: ""
  },
  {
    programId: "p02",
    order: 2,
    capacity: 40,
    title: "テクノロジーで課題解決。SNSを活用したごみ問題の課題解決を考えるツアー",
    tags: ["ごみ問題", "プラスチックごみ", "SNS"],
    description: "自然界に流出するごみ問題について、SNSの活用やごみ拾い体験を通じて、テクノロジーと自分にできることを考えます。",
    imageUrl: ""
  },
  {
    programId: "p03",
    order: 3,
    capacity: 40,
    title: "空き家のリノベーションから、その建築技法と「住む京都」を考えるツアー",
    tags: ["空き家", "地域コミュニティ", "暮らし"],
    description: "町家の取り壊しや空き家問題を踏まえ、空き家をリノベーションした職住一体の拠点を見学し、住みやすい地域を考えます。",
    imageUrl: ""
  },
  {
    programId: "p04",
    order: 4,
    capacity: 40,
    title: "多様な太陽光発電の形から、自然エネルギーの可能性を考えるツアー",
    tags: ["再生可能エネルギー", "脱炭素社会", "気候変動"],
    description: "気候危機や自然エネルギーの拡大をテーマに、農地上の太陽光発電で作物生産と発電を両立するソーラーシェアリングを見学します。",
    imageUrl: ""
  },
  {
    programId: "p05",
    order: 5,
    capacity: 40,
    title: "伝統工芸品はどうやって造られる？伝統産業とその技術について知り、継承について考えるツアー",
    tags: ["伝統産業", "後継者不足", "職人"],
    description: "伝統や文化を次世代につなぐ意味を、伝統工芸品の造り方や化学的な知見も含めて考え、ギャラリー見学を行います。",
    imageUrl: ""
  },
  {
    programId: "p06",
    order: 6,
    capacity: 40,
    title: "作業療法士＆お笑い芸人と“新たな介護の選択肢”を考えるツアー",
    tags: ["高齢化社会", "作業療法士", "介護"],
    description: "介護現場の現状と自分らしい生き方について、レクリエーションを通じて健康と笑いを届ける活動から考えます。",
    imageUrl: ""
  },
  {
    programId: "p07",
    order: 7,
    capacity: 40,
    title: "看護師の新たな働き方？コミュニティナースの価値と地域医療について考えるツアー",
    tags: ["地域医療", "高齢化", "コミュニティナース"],
    description: "地域に入り込み、暮らしの身近な存在として健康に関する活動を行うコミュニティナースから、地域医療のあり方を考えます。",
    imageUrl: ""
  },
  {
    programId: "p08",
    order: 8,
    capacity: 40,
    title: "心理学博士と考える。アスリートが引退後も人生を豊かに歩む世界を考えるツアー",
    tags: ["アスリート", "デュアルキャリア", "多様性"],
    description: "アスリートの進学・卒業・就職などのライフイベントとキャリア支援をテーマに、引退後も豊かに歩むために必要なことを考えます。",
    imageUrl: ""
  }
];

let currentUser = null;
let currentProfile = null;
let isAdmin = false;
let programs = [];
let rounds = {};
let assignments = {};
let selectedProgramId = null;

const $ = (id) => document.getElementById(id);

function show(id, visible = true) {
  $(id).classList.toggle("hidden", !visible);
}
function toast(message) {
  $("toast").textContent = message;
  show("toast", true);
  setTimeout(() => show("toast", false), 2800);
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (s) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[s]));
}
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}
function nowMs() {
  return Date.now();
}
function tsToMs(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return new Date(ts).getTime();
}
function toDatetimeLocal(ts) {
  const ms = tsToMs(ts);
  if (!ms) return "";
  const d = new Date(ms);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
function fromDatetimeLocal(value) {
  if (!value) return null;
  return Timestamp.fromDate(new Date(value));
}
function roundLabel(roundId) {
  return ROUND_LABELS[roundId] || roundId;
}
function nextRoundAfter(roundId) {
  const idx = ROUND_ORDER.indexOf(roundId);
  return idx >= 0 ? ROUND_ORDER[idx + 1] : null;
}

function getCurrentRoundForApply() {
  const n = nowMs();
  for (const rid of ROUND_ORDER) {
    const r = rounds[rid];
    if (!r?.enabled) continue;
    const start = tsToMs(r.applyStartAt);
    const end = tsToMs(r.applyEndAt);
    if ((!start || n >= start) && (!end || n <= end) && !r.drawExecuted) return rid;
  }
  return null;
}
function getLatestResultOpenRound() {
  const n = nowMs();
  let latest = null;
  for (const rid of ROUND_ORDER) {
    const r = rounds[rid];
    if (!r?.enabled || !r.drawExecuted) continue;
    const open = tsToMs(r.resultOpenAt);
    if (!open || n >= open) latest = rid;
  }
  return latest;
}

async function loadPrograms() {
  const snap = await getDocs(query(collection(db, "programs"), orderBy("order")));
  programs = snap.docs.map(d => ({ programId: d.id, ...d.data() }));
}
async function loadRounds() {
  const snap = await getDocs(collection(db, "rounds"));
  rounds = {};
  snap.docs.forEach(d => rounds[d.id] = { roundId: d.id, ...d.data() });
  for (const rid of ROUND_ORDER) {
    if (!rounds[rid]) {
      rounds[rid] = { roundId: rid, enabled: true, drawExecuted: false };
    }
  }
  rounds.round2.enabled = true;
}
async function getMyApplication(roundId) {
  if (!currentUser) return null;
  const ref = doc(db, "applications", roundId, "items", currentUser.uid);
  const snap = await getDoc(ref);
  return snap.exists() ? { uid: currentUser.uid, ...snap.data() } : null;
}
async function getMyAssignment() {
  if (!currentUser) return null;
  const snap = await getDoc(doc(db, "assignments", currentUser.uid));
  return snap.exists() ? { uid: currentUser.uid, ...snap.data() } : null;
}
async function getAllAssignments() {
  const snap = await getDocs(collection(db, "assignments"));
  const data = {};
  snap.docs.forEach(d => data[d.id] = { uid: d.id, ...d.data() });
  assignments = data;
  return data;
}
async function programCountsForRound(roundId) {
  const result = {};
  for (const p of programs) {
    const q = query(
      collection(db, "applications", roundId, "items"),
      where("programId", "==", p.programId)
    );
    const c = await getCountFromServer(q);
    result[p.programId] = c.data().count;
  }
  return result;
}
async function fixedCountsByProgram() {
  const result = {};
  programs.forEach(p => result[p.programId] = 0);
  const snap = await getDocs(collection(db, "assignments"));
  snap.docs.forEach(d => {
    const a = d.data();
    if (a.programId && result[a.programId] !== undefined) result[a.programId]++;
  });
  return result;
}

async function handleLogin() {
  await signInWithPopup(auth, new GoogleAuthProvider());
}
async function handleLogout() {
  await signOut(auth);
}

async function bootstrapUser(user) {
  show("loadingView", true);
  show("notRegisteredView", false);
  show("studentView", false);
  show("adminView", false);
  currentUser = user;
  currentProfile = null;
  isAdmin = false;

  if (!user) {
    $("subtitle").textContent = "Googleアカウントでログインしてください";
    show("loginBtn", true);
    show("logoutBtn", false);
    show("userBadge", false);
    show("loadingView", false);
    return;
  }

  show("loginBtn", false);
  show("logoutBtn", true);
  $("userBadge").textContent = user.email;
  show("userBadge", true);

  const email = normalizeEmail(user.email);
  const adminSnap = await getDoc(doc(db, "admins", email));
  isAdmin = adminSnap.exists() && adminSnap.data().active !== false;

  const userSnap = await getDoc(doc(db, "usersByEmail", email));
  if (!isAdmin && (!userSnap.exists() || userSnap.data().active === false)) {
    show("loadingView", false);
    show("notRegisteredView", true);
    return;
  }

  if (userSnap.exists()) {
    const profile = userSnap.data();
    currentProfile = { ...profile, email };
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email,
      name: profile.name,
      classNo: Number(profile.classNo),
      attendanceNo: Number(profile.attendanceNo),
      role: "student",
      active: profile.active !== false,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } else if (isAdmin) {
    currentProfile = {
      email,
      name: adminSnap.data().name || "管理者",
      role: "admin",
      active: true
    };
  }

  $("subtitle").textContent = isAdmin ? "管理者画面" : `${currentProfile.name} さんの申込画面`;

  await loadPrograms();
  await loadRounds();

  show("loadingView", false);
  if (isAdmin) {
    show("adminView", true);
    await renderAdmin();
  } else {
    show("studentView", true);
    await renderStudent();
  }
}

async function renderStudent() {
  await loadPrograms();
  await loadRounds();
  const myAssignment = await getMyAssignment();
  const applyRound = getCurrentRoundForApply();
  const latestOpenRound = getLatestResultOpenRound();

  if (myAssignment) {
    const p = programs.find(x => x.programId === myAssignment.programId);
    $("studentStatus").innerHTML = `
      <p class="successText">あなたのプログラムは確定しました。</p>
      <h3>${escapeHtml(p?.title || myAssignment.programId)}</h3>
      <p>確定回：${escapeHtml(roundLabel(myAssignment.fixedRound))}</p>
    `;
    show("applicationCard", false);
    await renderCountList(applyRound || latestOpenRound || "round1");
    return;
  }

  let statusHtml = "";
  if (latestOpenRound) {
    const app = await getMyApplication(latestOpenRound);
    statusHtml += `<p>${escapeHtml(roundLabel(latestOpenRound))}の結果：<strong>未確定</strong></p>`;
    if (app) {
      const p = programs.find(x => x.programId === app.programId);
      statusHtml += `<p>申込していたプログラム：${escapeHtml(p?.title || app.programId)}</p>`;
    } else {
      statusHtml += `<p>この回の申込はありません。</p>`;
    }
  }

  if (applyRound) {
    const app = await getMyApplication(applyRound);
    const label = roundLabel(applyRound);
    if (app) {
      const p = programs.find(x => x.programId === app.programId);
      statusHtml += `<p>現在：${escapeHtml(label)} 申込受付中</p>`;
      statusHtml += `<p>現在の申込：<strong>${escapeHtml(p?.title || app.programId)}</strong></p>`;
    } else {
      statusHtml += `<p>現在：${escapeHtml(label)} 申込受付中</p>`;
      statusHtml += `<p>現在の申込：未申込</p>`;
    }
    $("studentStatus").innerHTML = statusHtml;
    await renderApplicationForm(applyRound, app);
    show("applicationCard", true);
  } else {
    $("studentStatus").innerHTML = statusHtml || `<p>現在、申込受付中の抽選はありません。</p>`;
    show("applicationCard", false);
  }

  await renderCountList(applyRound || latestOpenRound || "round1");
}

async function renderCountList(roundId) {
  const counts = await programCountsForRound(roundId);
  const fixed = await fixedCountsByProgram();
  $("countList").innerHTML = programs.map(p => {
    const c = counts[p.programId] || 0;
    const f = fixed[p.programId] || 0;
    return `<div class="countRow">
      <span>${escapeHtml(p.order)}. ${escapeHtml(p.title)}</span>
      <strong>申込 ${c}名 / 確定 ${f}名 / 定員 ${p.capacity}名</strong>
    </div>`;
  }).join("");
}

async function renderApplicationForm(roundId, existingApp) {
  selectedProgramId = existingApp?.programId || null;
  const fixed = await fixedCountsByProgram();
  $("applicationTitle").textContent = existingApp ? "申込内容を修正" : "プログラムを選択";
  $("submitApplicationBtn").textContent = existingApp ? "修正する" : "申し込む";
  $("submitApplicationBtn").disabled = !selectedProgramId;

  $("programCards").innerHTML = programs.map(p => {
    const remaining = Number(p.capacity || 0) - Number(fixed[p.programId] || 0);
    const disabled = remaining <= 0 && p.programId !== selectedProgramId;
    const selected = p.programId === selectedProgramId;
    return `<button class="programCard ${selected ? "selected" : ""}" data-program="${escapeHtml(p.programId)}" ${disabled ? "disabled" : ""}>
      ${p.imageUrl ? `<img src="${escapeHtml(p.imageUrl)}" alt="">` : ""}
      <h3>${escapeHtml(p.order)}. ${escapeHtml(p.title)}</h3>
      <p>${escapeHtml(p.description || "")}</p>
      <p class="tags">${(p.tags || []).map(t => `<span>${escapeHtml(t)}</span>`).join("")}</p>
      <p class="${remaining <= 0 ? "closed" : "muted"}">残り枠：${Math.max(remaining, 0)}名</p>
    </button>`;
  }).join("");

  document.querySelectorAll(".programCard").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedProgramId = btn.dataset.program;
      document.querySelectorAll(".programCard").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      $("submitApplicationBtn").disabled = false;
    });
  });

  $("submitApplicationBtn").onclick = async () => {
    if (!selectedProgramId) return;
    await setDoc(doc(db, "applications", roundId, "items", currentUser.uid), {
      programId: selectedProgramId,
      roundId,
      updatedAt: serverTimestamp()
    }, { merge: true });
    toast("申込を保存しました");
    await renderStudent();
  };
}

async function renderAdmin() {
  await Promise.all([loadPrograms(), loadRounds(), getAllAssignments()]);
  renderAdminTabs();
  await renderAdminDashboard();
  renderProgramAdmin();
  renderRoundForms();
  await renderAdminList();
}

function renderAdminTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tabPanel").forEach(p => p.classList.add("hidden"));
      $(btn.dataset.tab).classList.remove("hidden");
    };
  });
}

async function renderAdminDashboard() {
  const usersSnap = await getDocs(collection(db, "usersByEmail"));
  const fixed = await fixedCountsByProgram();
  const totalCapacity = programs.reduce((sum, p) => sum + Number(p.capacity || 0), 0);
  const fixedTotal = Object.values(fixed).reduce((a, b) => a + b, 0);
  $("adminSummary").innerHTML = `
    <div><strong>${usersSnap.size}</strong><span>登録生徒数</span></div>
    <div><strong>${programs.length}</strong><span>プログラム数</span></div>
    <div><strong>${totalCapacity}</strong><span>総定員</span></div>
    <div><strong>${fixedTotal}</strong><span>確定済み人数</span></div>
  `;
}

function renderProgramAdmin() {
  $("programAdminList").innerHTML = programs.map(p => `
    <div class="adminItem">
      <div>
        <strong>${escapeHtml(p.order)}. ${escapeHtml(p.title)}</strong>
        <p>定員 ${escapeHtml(p.capacity)}名 / ${(p.tags || []).map(escapeHtml).join("・")}</p>
      </div>
      <div class="actions">
        <button class="secondary" data-edit-program="${escapeHtml(p.programId)}">編集</button>
        <button class="danger light" data-delete-program="${escapeHtml(p.programId)}">削除</button>
      </div>
    </div>
  `).join("");

  document.querySelectorAll("[data-edit-program]").forEach(btn => {
    btn.onclick = () => {
      const p = programs.find(x => x.programId === btn.dataset.editProgram);
      if (!p) return;
      $("programId").value = p.programId;
      $("programOrder").value = p.order || "";
      $("programCapacity").value = p.capacity || 40;
      $("programTitle").value = p.title || "";
      $("programTags").value = (p.tags || []).join(",");
      $("programImageUrl").value = p.imageUrl || "";
      $("programDescription").value = p.description || "";
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  });

  document.querySelectorAll("[data-delete-program]").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("このプログラムを削除しますか？")) return;
      await deleteDoc(doc(db, "programs", btn.dataset.deleteProgram));
      await loadPrograms();
      renderProgramAdmin();
      toast("削除しました");
    };
  });
}

function clearProgramForm() {
  $("programForm").reset();
  $("programId").value = "";
  $("programCapacity").value = 40;
}

$("programForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("programId").value || `p${String(Date.now()).slice(-6)}`;
  await setDoc(doc(db, "programs", id), {
    order: Number($("programOrder").value),
    capacity: Number($("programCapacity").value),
    title: $("programTitle").value.trim(),
    tags: $("programTags").value.split(",").map(s => s.trim()).filter(Boolean),
    imageUrl: $("programImageUrl").value.trim(),
    description: $("programDescription").value.trim(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  clearProgramForm();
  await loadPrograms();
  renderProgramAdmin();
  toast("保存しました");
});
$("clearProgramFormBtn").onclick = clearProgramForm;

function renderRoundForms() {
  $("roundForms").innerHTML = ROUND_ORDER.map(rid => {
    const r = rounds[rid] || {};
    return `<section class="roundForm" data-round-form="${rid}">
      <h3>${roundLabel(rid)}</h3>
      <label><input type="checkbox" data-field="enabled" ${r.enabled !== false ? "checked" : ""} ${rid === "round2" ? "disabled checked" : ""}> 実施する</label>
      <label>申込開始 <input type="datetime-local" data-field="applyStartAt" value="${toDatetimeLocal(r.applyStartAt)}"></label>
      <label>申込締切 <input type="datetime-local" data-field="applyEndAt" value="${toDatetimeLocal(r.applyEndAt)}"></label>
      <label>結果公開 <input type="datetime-local" data-field="resultOpenAt" value="${toDatetimeLocal(r.resultOpenAt)}"></label>
      <p>抽選実行済み：${r.drawExecuted ? "はい" : "いいえ"}</p>
    </section>`;
  }).join("");
}

$("saveRoundsBtn").onclick = async () => {
  const batch = writeBatch(db);
  document.querySelectorAll("[data-round-form]").forEach(form => {
    const rid = form.dataset.roundForm;
    const enabledInput = form.querySelector('[data-field="enabled"]');
    batch.set(doc(db, "rounds", rid), {
      enabled: rid === "round2" ? true : enabledInput.checked,
      applyStartAt: fromDatetimeLocal(form.querySelector('[data-field="applyStartAt"]').value),
      applyEndAt: fromDatetimeLocal(form.querySelector('[data-field="applyEndAt"]').value),
      resultOpenAt: fromDatetimeLocal(form.querySelector('[data-field="resultOpenAt"]').value),
      updatedAt: serverTimestamp()
    }, { merge: true });
  });
  await batch.commit();
  await loadRounds();
  renderRoundForms();
  toast("日程を保存しました");
};

$("seedProgramsBtn").onclick = async () => {
  if (!confirm("PDF掲載の8プログラムを初期登録します。既存の同じIDは上書きされます。")) return;
  const batch = writeBatch(db);
  for (const p of initialPrograms) {
    batch.set(doc(db, "programs", p.programId), {
      ...p,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
  await batch.commit();
  await loadPrograms();
  await renderAdminDashboard();
  renderProgramAdmin();
  toast("初期プログラムを登録しました");
};

$("refreshAdminBtn").onclick = renderAdmin;

$("downloadStudentTemplateBtn").onclick = () => {
  const rows = ["email,name,classNo,attendanceNo"];
  for (let c = 1; c <= 8; c++) {
    for (let n = 1; n <= 40; n++) {
      rows.push(`student${c}${String(n).padStart(2, "0")}@example.jp,${c}組${n}番 生徒,${c},${n}`);
    }
  }
  downloadText("students_template.csv", rows.join("\n"));
};

$("importStudentsBtn").onclick = async () => {
  const lines = $("studentsCsv").value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const rows = lines[0]?.toLowerCase().startsWith("email,") ? lines.slice(1) : lines;
  const batch = writeBatch(db);
  let count = 0;
  for (const line of rows) {
    const [emailRaw, nameRaw, classRaw, noRaw] = parseCsvLine(line);
    const email = normalizeEmail(emailRaw);
    const name = String(nameRaw || "").trim();
    const classNo = Number(classRaw);
    const attendanceNo = Number(noRaw);
    if (!email || !name || !classNo || !attendanceNo) continue;
    batch.set(doc(db, "usersByEmail", email), {
      email,
      name,
      classNo,
      attendanceNo,
      active: true,
      updatedAt: serverTimestamp()
    }, { merge: true });
    count++;
  }
  await batch.commit();
  $("studentsResult").textContent = `${count}名を登録・更新しました。`;
  await renderAdminDashboard();
};

function parseCsvLine(line) {
  const result = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
    } else if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      result.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
}

document.querySelectorAll("[data-draw]").forEach(btn => {
  btn.onclick = async () => {
    const roundId = btn.dataset.draw;
    if (!confirm(`${roundLabel(roundId)}を実行します。よろしいですか？`)) return;
    $("drawStatus").textContent = "抽選処理中...";
    try {
      const summary = roundId === "final" ? await executeFinalDraw() : await executeNormalDraw(roundId);
      $("drawStatus").innerHTML = `<pre>${escapeHtml(JSON.stringify(summary, null, 2))}</pre>`;
      await renderAdmin();
      toast("抽選を実行しました");
    } catch (err) {
      console.error(err);
      $("drawStatus").textContent = `エラー：${err.message}`;
    }
  };
});

async function executeNormalDraw(roundId) {
  await loadPrograms();
  await loadRounds();
  if (rounds[roundId]?.drawExecuted) throw new Error("この抽選はすでに実行済みです。");

  const allAssignments = await getAllAssignments();
  const fixedUids = new Set(Object.keys(allAssignments));
  const fixedCounts = {};
  programs.forEach(p => fixedCounts[p.programId] = 0);
  Object.values(allAssignments).forEach(a => fixedCounts[a.programId] = (fixedCounts[a.programId] || 0) + 1);

  const appsSnap = await getDocs(collection(db, "applications", roundId, "items"));
  const applicantsByProgram = {};
  programs.forEach(p => applicantsByProgram[p.programId] = []);
  appsSnap.docs.forEach(d => {
    if (fixedUids.has(d.id)) return;
    const app = d.data();
    if (!app.programId) return;
    if (!applicantsByProgram[app.programId]) applicantsByProgram[app.programId] = [];
    applicantsByProgram[app.programId].push(d.id);
  });

  const winners = [];
  const summary = {};
  for (const p of programs) {
    const remain = Number(p.capacity || 0) - Number(fixedCounts[p.programId] || 0);
    const applicants = shuffle(applicantsByProgram[p.programId] || []);
    const selected = remain > 0 ? applicants.slice(0, remain) : [];
    selected.forEach(uid => winners.push({ uid, programId: p.programId }));
    summary[p.programId] = {
      title: p.title,
      capacity: p.capacity,
      alreadyFixed: fixedCounts[p.programId] || 0,
      applicants: applicants.length,
      winners: selected.length,
      losers: Math.max(applicants.length - selected.length, 0)
    };
  }

  await commitAssignments(roundId, winners, summary);
  return summary;
}

async function executeFinalDraw() {
  await loadPrograms();
  await loadRounds();
  if (rounds.final?.drawExecuted) throw new Error("最終抽選はすでに実行済みです。");

  const usersSnap = await getDocs(collection(db, "users"));
  const allUsers = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.active !== false && u.role === "student");
  const allAssignments = await getAllAssignments();
  const fixedUids = new Set(Object.keys(allAssignments));
  const fixedCounts = {};
  programs.forEach(p => fixedCounts[p.programId] = 0);
  Object.values(allAssignments).forEach(a => fixedCounts[a.programId] = (fixedCounts[a.programId] || 0) + 1);

  const remainingSeats = [];
  for (const p of programs) {
    const remain = Number(p.capacity || 0) - Number(fixedCounts[p.programId] || 0);
    for (let i = 0; i < remain; i++) remainingSeats.push(p.programId);
  }

  const unfixedUsers = allUsers.filter(u => !fixedUids.has(u.uid));
  if (remainingSeats.length < unfixedUsers.length) {
    throw new Error(`空き枠が不足しています。空き枠 ${remainingSeats.length}、未確定 ${unfixedUsers.length}`);
  }

  const appsSnap = await getDocs(collection(db, "applications", "final", "items"));
  const finalApps = {};
  appsSnap.docs.forEach(d => {
    if (!fixedUids.has(d.id)) finalApps[d.id] = d.data().programId;
  });

  const winners = [];
  const newlyFixed = new Set();

  for (const p of programs) {
    const applicants = shuffle(Object.entries(finalApps)
      .filter(([uid, programId]) => programId === p.programId && !newlyFixed.has(uid))
      .map(([uid]) => uid));
    const seatsForP = remainingSeats.filter(pid => pid === p.programId).length;
    const selected = applicants.slice(0, seatsForP);
    selected.forEach(uid => {
      winners.push({ uid, programId: p.programId });
      newlyFixed.add(uid);
      const idx = remainingSeats.indexOf(p.programId);
      if (idx >= 0) remainingSeats.splice(idx, 1);
    });
  }

  const rest = shuffle(unfixedUsers.filter(u => !newlyFixed.has(u.uid)).map(u => u.uid));
  const shuffledSeats = shuffle(remainingSeats);
  rest.forEach((uid, i) => {
    winners.push({ uid, programId: shuffledSeats[i] });
    newlyFixed.add(uid);
  });

  const summary = {};
  programs.forEach(p => summary[p.programId] = { title: p.title, winners: winners.filter(w => w.programId === p.programId).length });
  await commitAssignments("final", winners, summary);
  return summary;
}

async function commitAssignments(roundId, winners, summary) {
  const batch = writeBatch(db);
  for (const w of winners) {
    batch.set(doc(db, "assignments", w.uid), {
      uid: w.uid,
      programId: w.programId,
      fixedRound: roundId,
      fixedAt: serverTimestamp()
    }, { merge: false });
  }
  batch.set(doc(db, "rounds", roundId), {
    drawExecuted: true,
    drawExecutedAt: serverTimestamp(),
    drawExecutedBy: currentUser.email
  }, { merge: true });
  batch.set(doc(db, "drawLogs", roundId), {
    roundId,
    executedBy: currentUser.email,
    executedAt: serverTimestamp(),
    seed: crypto.randomUUID(),
    summary
  }, { merge: false });
  await batch.commit();
}

function shuffle(array) {
  const a = [...array];
  crypto.getRandomValues(new Uint32Array(a.length)).forEach((rand, i) => {
    const j = i + (rand % (a.length - i || 1));
    [a[i], a[j]] = [a[j], a[i]];
  });
  return a;
}

async function renderAdminList() {
  const snap = await getDocs(collection(db, "admins"));
  $("adminList").innerHTML = snap.docs.map(d => {
    const a = d.data();
    return `<div class="adminItem">
      <div><strong>${escapeHtml(a.name || "")}</strong><p>${escapeHtml(d.id)}</p></div>
      <button class="danger light" data-remove-admin="${escapeHtml(d.id)}">削除</button>
    </div>`;
  }).join("");

  document.querySelectorAll("[data-remove-admin]").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("管理者から削除しますか？")) return;
      await deleteDoc(doc(db, "admins", btn.dataset.removeAdmin));
      await renderAdminList();
    };
  });
}

$("addAdminBtn").onclick = async () => {
  const email = normalizeEmail($("adminEmailInput").value);
  const name = $("adminNameInput").value.trim();
  if (!email) return;
  await setDoc(doc(db, "admins", email), {
    email,
    name,
    active: true,
    updatedAt: serverTimestamp()
  }, { merge: true });
  $("adminEmailInput").value = "";
  $("adminNameInput").value = "";
  await renderAdminList();
  toast("管理者を追加しました");
};

$("exportTentativeBtn").onclick = () => exportExcel("暫定版");
$("exportFinalBtn").onclick = () => exportExcel("確定版");

async function exportExcel(label) {
  await loadPrograms();
  const usersSnap = await getDocs(collection(db, "users"));
  const users = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }))
    .filter(u => u.role === "student")
    .sort((a, b) => Number(a.classNo) - Number(b.classNo) || Number(a.attendanceNo) - Number(b.attendanceNo));

  const assignSnap = await getDocs(collection(db, "assignments"));
  const assign = {};
  assignSnap.docs.forEach(d => assign[d.id] = d.data());

  const programMap = Object.fromEntries(programs.map(p => [p.programId, p]));
  const wb = XLSX.utils.book_new();

  const allRows = users.map(u => {
    const a = assign[u.uid];
    const p = a ? programMap[a.programId] : null;
    return {
      組: u.classNo,
      番: u.attendanceNo,
      氏名: u.name,
      メール: u.email,
      プログラム番号: p?.order || "",
      プログラム名: p?.title || "未確定",
      確定回: a ? roundLabel(a.fixedRound) : ""
    };
  });
  addSheet(wb, "全体一覧", allRows);

  for (let c = 1; c <= 8; c++) {
    addSheet(wb, `${c}組`, allRows.filter(r => Number(r.組) === c), true);
  }

  for (const p of programs) {
    const rows = allRows.filter(r => r.プログラム名 === p.title);
    addSheet(wb, `P${String(p.order).padStart(2, "0")}`, rows, true);
  }

  addSheet(wb, "未確定者", allRows.filter(r => r.プログラム名 === "未確定"), true);
  XLSX.writeFile(wb, `修学旅行プログラム名簿_${label}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function addSheet(wb, name, rows, printOnePage = false) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 組: "", 番: "", 氏名: "", メール: "", プログラム番号: "", プログラム名: "", 確定回: "" }]);
  ws["!cols"] = [
    { wch: 6 }, { wch: 6 }, { wch: 16 }, { wch: 28 }, { wch: 12 }, { wch: 60 }, { wch: 14 }
  ];
  ws["!pageSetup"] = printOnePage ? {
    paperSize: 9,
    orientation: "portrait",
    fitToWidth: 1,
    fitToHeight: 1
  } : { paperSize: 9, orientation: "landscape", fitToWidth: 1 };
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

$("loginBtn").onclick = handleLogin;
$("logoutBtn").onclick = handleLogout;

onAuthStateChanged(auth, (user) => {
  bootstrapUser(user).catch(err => {
    console.error(err);
    show("loadingView", false);
    alert(`読み込みエラー：${err.message}`);
  });
});

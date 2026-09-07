// ==========================================================================
// X5cope Chat Widget — Firebase Auth + Firestore
// Floating bubble → sign in with Google → chat thread.
// Admins (see firebase-config.js ADMIN_EMAILS) see every conversation.
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, setDoc, addDoc, onSnapshot,
  query, orderBy, serverTimestamp, collectionGroup, where, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig, ADMIN_EMAILS } from "./firebase-config.js";
import { AGENT_NAME, MENU_TREE } from "./agent-knowledge.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let isAdmin = false;
let activeConversationId = null;
let unsubMessages = null;
let unsubConvoList = null;

// ---------- Widget DOM ----------
function buildWidgetDOM(){
  const root = document.createElement('div');
  root.id = 'x5-chat-root';
  root.innerHTML = `
    <button id="x5-chat-bubble" aria-label="Open chat">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v11H8l-4 4V5z"/></svg>
    </button>
    <div id="x5-chat-panel" hidden>
      <div id="x5-chat-header">
        <span id="x5-chat-title">X5cope</span>
        <div>
          <button id="x5-chat-signout" hidden title="Sign out">Sign out</button>
          <button id="x5-chat-close" aria-label="Close chat">&times;</button>
        </div>
      </div>
      <div id="x5-chat-body"></div>
      <form id="x5-chat-input-row" hidden>
        <input id="x5-chat-input" type="text" placeholder="Type a message..." autocomplete="off">
        <button type="submit">Send</button>
      </form>
    </div>
  `;
  document.body.appendChild(root);

  document.getElementById('x5-chat-bubble').addEventListener('click', () => {
    const panel = document.getElementById('x5-chat-panel');
    togglePanel(panel.hidden);
  });
  document.getElementById('x5-chat-close').addEventListener('click', () => togglePanel(false));
  document.getElementById('x5-chat-signout').addEventListener('click', () => signOut(auth));
  document.getElementById('x5-chat-input-row').addEventListener('submit', handleSend);
}

function togglePanel(open){
  document.getElementById('x5-chat-panel').hidden = !open;
  const bubble = document.getElementById('x5-chat-bubble');
  bubble.innerHTML = open
    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4l16 16M20 4 4 20"/></svg>`
    : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v11H8l-4 4V5z"/></svg>`;
}

function renderSignedOut(){
  document.getElementById('x5-chat-signout').hidden = true;
  document.getElementById('x5-chat-input-row').hidden = true;
  document.getElementById('x5-chat-title').textContent = 'X5cope';
  const body = document.getElementById('x5-chat-body');
  body.innerHTML = `
    <div class="x5-chat-welcome">
      <p>Got a question or a project in mind? Sign in and message us directly.</p>
      <button id="x5-chat-google-btn">Sign in with Google</button>
    </div>
  `;
  document.getElementById('x5-chat-google-btn').addEventListener('click', () => {
    signInWithPopup(auth, new GoogleAuthProvider()).catch(err => {
      console.error('Sign-in failed', err);
      alert('Sign-in failed, please try again.');
    });
  });
}

// ---------- Visitor mode: guided agent menu, then human thread ----------
async function renderVisitorThread(){
  document.getElementById('x5-chat-signout').hidden = false;
  document.getElementById('x5-chat-title').textContent = AGENT_NAME;

  activeConversationId = currentUser.uid;
  const convoRef = doc(db, 'conversations', activeConversationId);
  const convoSnap = await getDoc(convoRef);

  // Resume an already-escalated conversation straight into human mode
  if(convoSnap.exists() && convoSnap.data().needsHuman){
    enterHumanMode();
    return;
  }

  document.getElementById('x5-chat-input-row').hidden = true;
  renderMenuNode('root');
}

function renderMenuNode(nodeKey){
  const node = MENU_TREE[nodeKey];
  if(!node) return;

  const body = document.getElementById('x5-chat-body');
  body.innerHTML = `
    <div class="x5-msg x5-msg-admin">${node.bot}</div>
    <div class="x5-menu-options"></div>
  `;
  const optionsWrap = body.querySelector('.x5-menu-options');

  if(node.escalate){
    escalateToHuman(node.bot);
    return;
  }

  if(node.freeform){
    enterFreeformAI();
    return;
  }

  node.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'x5-menu-btn';
    btn.textContent = opt.label;
    btn.addEventListener('click', () => renderMenuNode(opt.next));
    optionsWrap.appendChild(btn);
  });
}

// ---------- Freeform AI sub-mode (talks to /api/chat, no Firestore writes) ----------
let aiHistory = [];

function enterFreeformAI(){
  aiHistory = [];
  document.getElementById('x5-chat-input-row').hidden = false;
  document.getElementById('x5-chat-input-row').dataset.mode = 'ai';
  document.getElementById('x5-chat-input').focus();
}

async function handleAIMessage(text){
  const body = document.getElementById('x5-chat-body');

  const userBubble = document.createElement('div');
  userBubble.className = 'x5-msg x5-msg-visitor';
  userBubble.textContent = text;
  body.appendChild(userBubble);
  body.scrollTop = body.scrollHeight;

  if(text.trim().toLowerCase() === 'human'){
    escalateToHuman("Connecting you with a human now.");
    return;
  }

  const typingBubble = document.createElement('div');
  typingBubble.className = 'x5-msg x5-msg-admin';
  typingBubble.textContent = '...';
  body.appendChild(typingBubble);
  body.scrollTop = body.scrollHeight;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: aiHistory })
    });
    const data = await res.json();
    const reply = data.reply || "Sorry, something went wrong, want to talk to a human instead?";
    typingBubble.textContent = reply;
    aiHistory.push({ role: 'user', content: text }, { role: 'assistant', content: reply });
  } catch (err) {
    console.error('AI request failed', err);
    typingBubble.textContent = "Couldn't reach the assistant, want to talk to a human instead? Type 'human'.";
  }
  body.scrollTop = body.scrollHeight;
}

async function escalateToHuman(botMessage){
  const convoRef = doc(db, 'conversations', activeConversationId);
  const convoSnap = await getDoc(convoRef);
  if(!convoSnap.exists()){
    await setDoc(convoRef, {
      customerEmail: currentUser.email,
      customerName: currentUser.displayName || currentUser.email,
      createdAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
      needsHuman: true
    });
  } else {
    await setDoc(convoRef, { needsHuman: true, lastMessageAt: serverTimestamp() }, { merge: true });
  }
  // Log the bot's handoff line so the human admin has context
  const msgsRef = collection(db, 'conversations', activeConversationId, 'messages');
  await addDoc(msgsRef, {
    text: botMessage,
    senderEmail: 'agent',
    isAdmin: true,
    createdAt: serverTimestamp()
  });
  enterHumanMode();
}

function enterHumanMode(){
  document.getElementById('x5-chat-title').textContent = 'Message us';
  document.getElementById('x5-chat-input-row').hidden = false;
  document.getElementById('x5-chat-input-row').dataset.mode = 'human';
  listenToMessages(activeConversationId);
}

// ---------- Admin mode: inbox of every conversation ----------
function renderAdminInbox(){
  document.getElementById('x5-chat-signout').hidden = false;
  document.getElementById('x5-chat-input-row').hidden = true;
  document.getElementById('x5-chat-title').textContent = 'Inbox';

  const body = document.getElementById('x5-chat-body');
  body.innerHTML = `<div id="x5-admin-convo-list" class="x5-admin-list"></div>`;

  const q = query(collection(db, 'conversations'), orderBy('lastMessageAt', 'desc'));
  if(unsubConvoList) unsubConvoList();
  unsubConvoList = onSnapshot(q, (snap) => {
    const list = document.getElementById('x5-admin-convo-list');
    if(!list) return;
    if(snap.empty){
      list.innerHTML = `<p class="x5-chat-empty">No conversations yet.</p>`;
      return;
    }
    list.innerHTML = '';
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const item = document.createElement('button');
      item.className = 'x5-admin-convo-item';
      item.textContent = data.customerName || data.customerEmail || 'Unknown';
      item.addEventListener('click', () => openAdminThread(docSnap.id, data));
      list.appendChild(item);
    });
  });
}

function openAdminThread(conversationId, data){
  activeConversationId = conversationId;
  document.getElementById('x5-chat-title').textContent = data.customerName || data.customerEmail;
  document.getElementById('x5-chat-input-row').hidden = false;
  document.getElementById('x5-chat-input-row').dataset.mode = 'human';

  const body = document.getElementById('x5-chat-body');
  body.innerHTML = `
    <button id="x5-back-to-inbox">&larr; All conversations</button>
    <div id="x5-thread-messages"></div>
  `;
  document.getElementById('x5-back-to-inbox').addEventListener('click', () => {
    document.getElementById('x5-chat-input-row').hidden = true;
    renderAdminInbox();
  });

  listenToMessages(conversationId, 'x5-thread-messages');
}

// ---------- Shared: message listener + send ----------
function listenToMessages(conversationId, containerId = null){
  if(unsubMessages) unsubMessages();
  const msgsRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(msgsRef, orderBy('createdAt', 'asc'));
  unsubMessages = onSnapshot(q, (snap) => {
    const container = containerId
      ? document.getElementById(containerId)
      : document.getElementById('x5-chat-body');
    if(!container) return;
    container.innerHTML = '';
    snap.forEach(docSnap => {
      const m = docSnap.data();
      const bubble = document.createElement('div');
      bubble.className = 'x5-msg ' + (m.isAdmin ? 'x5-msg-admin' : 'x5-msg-visitor');
      bubble.textContent = m.text;
      container.appendChild(bubble);
    });
    container.scrollTop = container.scrollHeight;
  });
}

async function handleSend(e){
  e.preventDefault();
  const input = document.getElementById('x5-chat-input');
  const text = input.value.trim();
  if(!text) return;
  input.value = '';

  const mode = document.getElementById('x5-chat-input-row').dataset.mode;
  if(mode === 'ai'){
    handleAIMessage(text);
    return;
  }

  if(!activeConversationId) return;
  const msgsRef = collection(db, 'conversations', activeConversationId, 'messages');
  await addDoc(msgsRef, {
    text,
    senderEmail: currentUser.email,
    isAdmin,
    createdAt: serverTimestamp()
  });
  await setDoc(doc(db, 'conversations', activeConversationId), {
    lastMessageAt: serverTimestamp()
  }, { merge: true });
}

// ---------- Boot ----------
function init(){
  buildWidgetDOM();
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if(unsubMessages) { unsubMessages(); unsubMessages = null; }
    if(unsubConvoList) { unsubConvoList(); unsubConvoList = null; }

    if(!user){
      isAdmin = false;
      renderSignedOut();
      return;
    }
    isAdmin = ADMIN_EMAILS.includes(user.email);
    if(isAdmin){
      renderAdminInbox();
    } else {
      renderVisitorThread();
    }
  });
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

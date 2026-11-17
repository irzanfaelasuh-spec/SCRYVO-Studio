/* SCRYVO Studio 0.1 - offline-first visual programming prototype. */
'use strict';

const $ = (id) => document.getElementById(id);
const clone = (value) => JSON.parse(JSON.stringify(value));
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = (prefix='id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const DB_NAME = 'scryvo-local-studio';
const DB_VERSION = 1;
let db = null;
let currentUser = null;
let currentProject = null;
let activeSpriteId = null;
let activeCategory = 'motion';
let activeEditorTab = 'code';
let saveTimer = null;
let savePromise = Promise.resolve();
let runToken = 0;
let isRunning = false;
let stageImages = new Map();
let audioContext = null;
let activeAudio = null;
let undoStack = [];
let redoStack = [];
let dragState = null;
let suppressPaletteClick = false;
let tutorialIndex = -1;
let tutorialActive = false;
let pendingImageData = null;
let pendingImageName = 'Imported image';
let paintState = null;
let recorder = null;
let recorderStream = null;
let recordedChunks = [];
let recorderStartedAt = 0;
let recorderTimer = null;
let recordingShouldSave = false;

const BUILTIN_SOUNDS = [
  {id:'pop', name:'Pop', description:'A short soft pop', notes:[[520,.07],[760,.09]]},
  {id:'chime', name:'Chime', description:'A bright two-note chime', notes:[[660,.12],[880,.18]]},
  {id:'click', name:'Click', description:'A tiny interface click', notes:[[420,.035]]},
  {id:'spark', name:'Spark', description:'A quick rising sparkle', notes:[[440,.06],[620,.06],[880,.13]]},
  {id:'boop', name:'Boop', description:'A playful low boop', notes:[[330,.1],[260,.12]]},
  {id:'success', name:'Success', description:'A small success flourish', notes:[[523,.09],[659,.09],[784,.2]]}
];

function svgData(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
const SPRITE_LIBRARY = [
  {id:'pip',name:'Pip',kind:'Character',svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><path d="M23 70 51 20q8-14 18 0l30 50q8 14-7 18l-53 9q-17 3-16-13z" fill="#f2bd50" stroke="#24364b" stroke-width="5" stroke-linejoin="round"/><path d="m43 58 18-18 18 18-15 23-25-7z" fill="#fff2d2" stroke="#24364b" stroke-width="4"/><circle cx="54" cy="62" r="3.5" fill="#24364b"/><circle cx="72" cy="62" r="3.5" fill="#24364b"/><path d="M57 76q8 6 15-1" fill="none" stroke="#24364b" stroke-width="3.5" stroke-linecap="round"/><path d="m33 94-9 10m62-10 10 8" stroke="#24364b" stroke-width="5" stroke-linecap="round"/></svg>`},
  {id:'orbit',name:'Orbit',kind:'Space friend',svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="58" r="35" fill="#70b8e8" stroke="#21384e" stroke-width="5"/><path d="M21 61Q59 10 100 56" fill="none" stroke="#21384e" stroke-width="5" stroke-linecap="round"/><circle cx="48" cy="56" r="5" fill="#21384e"/><circle cx="72" cy="56" r="5" fill="#21384e"/><path d="M51 74q9 8 18 0" fill="none" stroke="#21384e" stroke-width="4" stroke-linecap="round"/><path d="M60 18V7m-7 0h14M27 86l-9 10m75-10 9 10" stroke="#21384e" stroke-width="5" stroke-linecap="round"/><circle cx="60" cy="7" r="4" fill="#f2bd50"/></svg>`},
  {id:'tavi',name:'Tavi',kind:'Animal',svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><path d="M28 47 19 16q-2-8 7-4l28 19h15l27-19q9-5 7 5l-9 31q12 21-2 42-14 21-43 15-28-6-33-30-3-16 12-28z" fill="#8d83d8" stroke="#26374b" stroke-width="5" stroke-linejoin="round"/><path d="M38 65q22-14 44 0" fill="none" stroke="#26374b" stroke-width="4" stroke-linecap="round"/><circle cx="45" cy="56" r="4" fill="#26374b"/><circle cx="76" cy="56" r="4" fill="#26374b"/><path d="M54 78q7 7 14 0" fill="none" stroke="#26374b" stroke-width="4" stroke-linecap="round"/><path d="m38 99-7 9m52-9 7 9" stroke="#26374b" stroke-width="5" stroke-linecap="round"/></svg>`},
  {id:'bolt',name:'Bolt',kind:'Robot',svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect x="27" y="31" width="66" height="62" rx="15" fill="#69c5a0" stroke="#203a4d" stroke-width="5"/><path d="M60 30V15m-8 0h16" stroke="#203a4d" stroke-width="5" stroke-linecap="round"/><circle cx="47" cy="57" r="5" fill="#203a4d"/><circle cx="73" cy="57" r="5" fill="#203a4d"/><path d="M47 75h26" stroke="#203a4d" stroke-width="5" stroke-linecap="round"/><path d="M27 58H14m92 0H93M43 93v12m34-12v12" stroke="#203a4d" stroke-width="5" stroke-linecap="round"/><circle cx="60" cy="13" r="4" fill="#f2bd50"/></svg>`},
  {id:'leaf',name:'Leaf',kind:'Nature',svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><path d="M96 16Q25 15 20 67q-3 39 42 35 49-5 34-86z" fill="#75c98a" stroke="#26463b" stroke-width="5"/><path d="M25 95Q52 67 87 37M47 76l-2-24m21 3 15-3" fill="none" stroke="#26463b" stroke-width="4" stroke-linecap="round"/><circle cx="55" cy="65" r="4" fill="#26463b"/><circle cx="75" cy="53" r="4" fill="#26463b"/><path d="M58 81q8 7 15-3" fill="none" stroke="#26463b" stroke-width="3" stroke-linecap="round"/></svg>`}
];

const BACKDROP_LIBRARY = [
  {id:'meadow',name:'Meadow',colors:['#b7e5c9','#ecf5c9'],decor:'meadow'},
  {id:'sunset',name:'Sunset',colors:['#f7ad86','#f4d48b'],decor:'sunset'},
  {id:'ocean',name:'Ocean',colors:['#70c7df','#d8f0e8'],decor:'ocean'},
  {id:'night',name:'Night sky',colors:['#273b68','#687fa8'],decor:'night'},
  {id:'paper',name:'Paper studio',colors:['#f5f0e5','#e1e8f0'],decor:'paper'},
  {id:'candy',name:'Candy town',colors:['#e6c7ef','#f9e0d1'],decor:'candy'},
  {id:'forest',name:'Forest',colors:['#96c6a2','#d4e4b6'],decor:'forest'},
  {id:'ice',name:'Ice field',colors:['#c4e0f5','#f2f7fa'],decor:'ice'}
];

const BLOCKS = {
  motion:[
    {type:'move',label:'move 10 steps',color:'motion'},
    {type:'turn',label:'turn clockwise 15 degrees',color:'motion'},
    {type:'go_to',label:'go to x: 0 y: 0',color:'motion'},
    {type:'change_x',label:'change x by 10',color:'motion'},
    {type:'change_y',label:'change y by 10',color:'motion'}
  ],
  looks:[
    {type:'say',label:'say Hello! for 2 seconds',color:'looks'},
    {type:'think',label:'think Hmm... for 2 seconds',color:'looks'},
    {type:'change_size',label:'change size by 10',color:'looks'},
    {type:'set_size',label:'set size to 100%',color:'looks'},
    {type:'show',label:'show',color:'looks'},
    {type:'hide',label:'hide',color:'looks'},
    {type:'next_costume',label:'next costume',color:'looks'}
  ],
  sound:[
    {type:'play_sound',label:'play sound Pop',color:'sound'},
    {type:'stop_sounds',label:'stop all sounds',color:'sound'}
  ],
  events:[
    {type:'event_start',label:'when green flag clicked',color:'events'}
  ],
  control:[
    {type:'wait',label:'wait 1 seconds',color:'control'},
    {type:'repeat',label:'repeat 10 times',color:'control'},
    {type:'forever',label:'forever',color:'control'}
  ],
  sensing:[
    {type:'ask',label:'ask What is your name? and wait',color:'sensing'},
    {type:'set_random',label:'set score to random 1 to 10',color:'sensing'}
  ],
  operators:[
    {type:'change_variable',label:'change score by 1',color:'operators'},
    {type:'set_variable',label:'set score to 0',color:'operators'}
  ],
  variables:[
    {type:'set_variable',label:'set score to 0',color:'variables'},
    {type:'change_variable',label:'change score by 1',color:'variables'},
    {type:'set_random',label:'set score to random 1 to 10',color:'variables'}
  ],
  myblocks:[
    {type:'comment',label:'add a note...',color:'myblocks'},
    {type:'set_variable',label:'make a variable value',color:'myblocks'}
  ]
};
const CATEGORY_NAMES = {motion:'Motion',looks:'Looks',sound:'Sound',events:'Events',control:'Control',sensing:'Sensing',operators:'Operators',variables:'Variables',myblocks:'My blocks'};
const COLOR = {motion:'#4c97ff',looks:'#9966ff',sound:'#d65cd6',events:'#e8b92e',control:'#ffab19',sensing:'#4cbfe6',operators:'#59b86a',variables:'#ef9a32',myblocks:'#ec7187'};

function makeSprite(template = SPRITE_LIBRARY[0]) {
  const image = svgData(template.svg);
  return {id:uid('sprite'),name:template.name,image,costumes:[{id:uid('costume'),name:`${template.name} 1`,image}],costumeIndex:0,x:0,y:0,size:100,direction:90,visible:true,message:'',messageKind:'say'};
}
function makeDefaultProject(owner, title='Untitled project') {
  const sprite = makeSprite(SPRITE_LIBRARY[0]);
  return {id:uid('project'),owner,title,createdAt:Date.now(),updatedAt:Date.now(),backdrop:clone(BACKDROP_LIBRARY[0]),sprites:[sprite],sounds:[],blocks:[{id:uid('block'),type:'event_start',fields:{}}],variables:{score:0}};
}
function makeBlock(type) {
  const fields = {
    move:{steps:10},turn:{degrees:15},go_to:{x:0,y:0},change_x:{value:10},change_y:{value:10},
    say:{text:'Hello!',seconds:2},think:{text:'Hmm...',seconds:2},change_size:{value:10},set_size:{value:100},
    play_sound:{sound:BUILTIN_SOUNDS[0].id},wait:{seconds:1},repeat:{times:10},forever:{},
    ask:{question:'What is your name?'},set_random:{name:'score',min:1,max:10},set_variable:{name:'score',value:0},change_variable:{name:'score',value:1},
    comment:{text:'A note for this script'},event_start:{},show:{},hide:{},next_costume:{},stop_sounds:{}
  }[type] || {};
  return {id:uid('block'),type,fields:clone(fields),children:[]};
}

function openDatabase() {
  return new Promise((resolve,reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const store = request.result;
      if (!store.objectStoreNames.contains('accounts')) store.createObjectStore('accounts',{keyPath:'usernameKey'});
      if (!store.objectStoreNames.contains('projects')) {
        const projects = store.createObjectStore('projects',{keyPath:'id'});
        projects.createIndex('owner','owner',{unique:false});
      }
    };
    request.onsuccess = () => { db = request.result; resolve(db); };
    request.onerror = () => reject(request.error || new Error('Could not open local storage'));
  });
}
function dbRequest(storeName, method, value, key) {
  return new Promise((resolve,reject) => {
    const transaction = db.transaction(storeName, method === 'getAll' ? 'readonly' : (method === 'get' ? 'readonly' : 'readwrite'));
    const store = transaction.objectStore(storeName);
    let request;
    if (method === 'get') request = store.get(key);
    else if (method === 'getAll') request = value === undefined ? store.getAll() : store.index('owner').getAll(value);
    else if (method === 'put') request = store.put(value);
    else if (method === 'delete') request = store.delete(key);
    else reject(new Error('Unsupported local database operation'));
    if (!request) return;
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Local database operation failed'));
  });
}
async function derivePassword(password, saltText) {
  const salt = Uint8Array.from(atob(saltText), c => c.charCodeAt(0));
  const material = await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:120000,hash:'SHA-256'},material,256);
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}
function randomSalt() { const bytes = crypto.getRandomValues(new Uint8Array(16)); return btoa(String.fromCharCode(...bytes)); }

function toast(message,kind='success') {
  const node = document.createElement('div');
  node.className = `toast ${kind}`; node.textContent = message; $('toastHost').appendChild(node);
  setTimeout(() => node.remove(),2800);
}
function setAuthMode(mode) {
  $('authForm').dataset.mode = mode;
  document.querySelectorAll('.auth-tab').forEach(tab => tab.classList.toggle('active',tab.dataset.authMode===mode));
  $('authTitle').textContent = mode==='login' ? 'Welcome back' : 'Create your account';
  $('authSubtitle').textContent = mode==='login' ? 'Sign in to continue creating.' : 'Choose a name for your creative space.';
  $('confirmWrap').classList.toggle('hidden',mode!=='register');
  $('authSubmit').innerHTML = mode==='login' ? 'Log in <span>→</span>' : 'Create account <span>→</span>';
  $('passwordInput').autocomplete = mode==='login' ? 'current-password' : 'new-password';
  $('authMessage').textContent=''; $('authMessage').className='form-message';
}
function showOnly(screenId) {
  ['authScreen','dashboard','editor'].forEach(id => $(id).classList.toggle('hidden',id!==screenId));
}
function showAuth() { showOnly('authScreen'); setAuthMode('login'); $('usernameInput').focus(); }
function currentUserName() { return currentUser?.username || 'Creator'; }

async function handleAuth(event) {
  event.preventDefault();
  const mode = $('authForm').dataset.mode || 'login';
  const username = $('usernameInput').value.trim();
  const usernameKey = username.toLocaleLowerCase('en-US');
  const password = $('passwordInput').value;
  const message = $('authMessage');
  message.className='form-message'; message.textContent='';
  if (!/^[a-zA-Z0-9_-]{3,22}$/.test(username)) { message.textContent='Use 3–22 letters, numbers, underscores or hyphens.'; return; }
  if (password.length < 6) { message.textContent='Password must contain at least 6 characters.'; return; }
  $('authSubmit').disabled=true;
  try {
    if (mode==='register') {
      if (password !== $('confirmInput').value) { message.textContent='Password confirmation does not match.'; return; }
      const exists = await dbRequest('accounts','get',null,usernameKey);
      if (exists) { message.textContent='That username already exists on this device.'; return; }
      const salt = randomSalt();
      const passwordHash = await derivePassword(password,salt);
      const account = {username,usernameKey,salt,passwordHash,createdAt:Date.now(),welcomeHandled:false,tutorialCompleted:false};
      await dbRequest('accounts','put',account);
      await enterAccount(account,true);
    } else {
      const account = await dbRequest('accounts','get',null,usernameKey);
      if (!account) { message.textContent='Account not found on this device.'; return; }
      const candidate = await derivePassword(password,account.salt);
      if (candidate !== account.passwordHash) { message.textContent='Incorrect password. Please try again.'; return; }
      await enterAccount(account,!account.welcomeHandled);
    }
  } catch (error) {
    console.error(error); message.textContent='Could not access local storage. Please restart SCRYVO.';
  } finally { $('authSubmit').disabled=false; }
}
async function enterAccount(account, showWelcome) {
  currentUser = account;
  localStorage.setItem('scryvo.session',account.usernameKey);
  $('profileInitial').textContent = account.username.slice(0,1).toUpperCase();
  $('profileName').textContent = account.username;
  $('menuUsername').textContent = account.username;
  $('editorMenuUsername').textContent = account.username;
  $('welcomeName').textContent = account.username;
  showOnly('dashboard');
  await renderDashboard();
  if (showWelcome) showTutorialPrompt();
}
async function restoreSession() {
  const usernameKey = localStorage.getItem('scryvo.session');
  if (!usernameKey) return false;
  const account = await dbRequest('accounts','get',null,usernameKey);
  if (!account) { localStorage.removeItem('scryvo.session'); return false; }
  await enterAccount(account,!account.welcomeHandled);
  return true;
}
async function logout() {
  stopProgram();
  if (currentProject) await saveProject(true);
  localStorage.removeItem('scryvo.session'); currentUser=null; currentProject=null; activeSpriteId=null;
  closeMenus(); tutorialActive=false; $('tutorialLayer').classList.add('hidden');
  showAuth(); toast('You have logged out.','success');
}

async function renderDashboard() {
  $('welcomeName').textContent=currentUserName();
  const projects = await dbRequest('projects','getAll',currentUser.usernameKey);
  const search = $('projectSearch').value.trim().toLowerCase();
  const visible = projects.filter(project => project.title.toLowerCase().includes(search)).sort((a,b)=>b.updatedAt-a.updatedAt);
  const grid=$('projectGrid'); grid.innerHTML='';
  if (!visible.length) {
    const empty=document.createElement('div'); empty.className='empty-projects';
    empty.innerHTML='<div class="empty-symbol">▱</div><strong>No projects yet</strong><span>Your first idea can start with one block.</span>';
    grid.appendChild(empty); return;
  }
  for (const project of visible) {
    const sprite=project.sprites?.[0];
    const card=document.createElement('article'); card.className='project-card'; card.dataset.id=project.id;
    const thumb=document.createElement('div'); thumb.className='project-thumb';
    if (sprite?.image) { const img=document.createElement('img'); img.src=sprite.image; img.alt=''; img.style.width='74px'; img.style.height='74px'; img.style.objectFit='contain'; img.style.position='relative'; img.style.zIndex='2'; thumb.appendChild(img); }
    const info=document.createElement('div'); info.className='project-card-info';
    const title=document.createElement('div'); title.className='project-card-title';
    const strong=document.createElement('strong'); strong.textContent=project.title;
    const menu=document.createElement('button'); menu.type='button'; menu.textContent='···'; menu.title='Project options';
    title.append(strong,menu);
    const meta=document.createElement('div'); meta.className='project-meta'; meta.textContent=`Edited ${relativeDate(project.updatedAt)} · ${project.blocks?.length||0} blocks`;
    info.append(title,meta);
    const open=document.createElement('button'); open.className='project-open'; open.innerHTML='<span>OPEN PROJECT</span><b>→</b>';
    card.append(thumb,info,open); grid.appendChild(card);
    open.addEventListener('click',()=>openProject(project.id));
    strong.addEventListener('click',()=>openProject(project.id));
    menu.addEventListener('click',(event)=>{event.stopPropagation();showProjectOptions(project.id);});
  }
}
function relativeDate(time) {
  const diff=Math.max(0,Date.now()-time); if(diff<60000)return 'just now'; if(diff<3600000)return `${Math.floor(diff/60000)}m ago`; if(diff<86400000)return `${Math.floor(diff/3600000)}h ago`; if(diff<604800000)return `${Math.floor(diff/86400000)}d ago`; return new Date(time).toLocaleDateString();
}
async function showProjectOptions(id) {
  const project=await dbRequest('projects','get',null,id); if(!project)return;
  showModal(`<h2 class="modal-heading">${escapeHtml(project.title)}</h2><p class="modal-subtitle">Project actions</p><div class="modal-actions" style="justify-content:flex-start;flex-wrap:wrap"><button class="modal-confirm" id="projectOpenAction">Open</button><button class="modal-cancel" id="projectRenameAction">Rename</button><button class="modal-cancel" id="projectDuplicateAction">Duplicate</button><button class="modal-cancel" id="projectExportAction">Export .scryvo</button><button class="modal-cancel" id="projectDeleteAction" style="color:#d45460">Delete</button></div>`);
  $('projectOpenAction').onclick=()=>{closeModal();openProject(id);};
  $('projectRenameAction').onclick=()=>{closeModal();renameProject(id);};
  $('projectDuplicateAction').onclick=async()=>{const copy=clone(project);copy.id=uid('project');copy.title=`${copy.title} copy`;copy.createdAt=Date.now();copy.updatedAt=Date.now();await dbRequest('projects','put',copy);closeModal();renderDashboard();toast('Project duplicated.');};
  $('projectExportAction').onclick=()=>{closeModal();exportProject(project);};
  $('projectDeleteAction').onclick=async()=>{closeModal();showConfirm(`Delete “${project.title}”?`,async()=>{await dbRequest('projects','delete',null,id);renderDashboard();toast('Project deleted.');});};
}
function showConfirm(title, callback) {
  showModal(`<h2 class="modal-heading">${escapeHtml(title)}</h2><p class="modal-subtitle">This cannot be undone.</p><div class="modal-actions"><button class="modal-cancel" id="confirmCancel">Cancel</button><button class="modal-confirm" id="confirmOkay" style="background:#d85a66">Delete</button></div>`);
  $('confirmCancel').onclick=closeModal; $('confirmOkay').onclick=()=>{closeModal();callback();};
}
async function renameProject(id) {
  const project=await dbRequest('projects','get',null,id); if(!project)return;
  showModal(`<h2 class="modal-heading">Rename project</h2><p class="modal-subtitle">Give this project a clear name.</p><input id="renameInput" class="text-field" maxlength="48" value="${escapeHtml(project.title)}"><div class="modal-actions"><button class="modal-cancel" id="renameCancel">Cancel</button><button class="modal-confirm" id="renameConfirm">Save name</button></div>`);
  $('renameInput').focus();$('renameCancel').onclick=closeModal;$('renameConfirm').onclick=async()=>{const value=$('renameInput').value.trim();if(!value){toast('Project name cannot be empty.','error');return;}project.title=value;project.updatedAt=Date.now();await dbRequest('projects','put',project);closeModal();renderDashboard();toast('Project renamed.');};
}
async function createProject(name='Untitled project') {
  const project=makeDefaultProject(currentUser.usernameKey,name);
  await dbRequest('projects','put',project); await openProject(project.id); return project;
}
async function openProject(id) {
  const project=await dbRequest('projects','get',null,id); if(!project || project.owner!==currentUser.usernameKey){toast('Project could not be opened.','error');return;}
  currentProject=project; activeSpriteId=project.sprites?.[0]?.id || null;
  if(!currentProject.blocks)currentProject.blocks=[makeBlock('event_start')];
  if(!currentProject.variables)currentProject.variables={};
  undoStack=[];redoStack=[];
  $('projectTitleInput').value=project.title;
  showOnly('editor'); selectEditorTab('code'); renderPalette(activeCategory);renderWorkspace();renderSprites();renderCostumes();renderSounds();drawStage();updateBlockCount();
  $('saveLabel').textContent='All changes saved'; $('saveDot').classList.remove('saving');
}
async function saveProject(silent=false) {
  if(!currentProject||!currentUser)return;
  clearTimeout(saveTimer); currentProject.title=$('projectTitleInput').value.trim()||'Untitled project';currentProject.updatedAt=Date.now();
  $('saveDot').classList.add('saving');$('saveLabel').textContent='Saving';
  const projectCopy=clone(currentProject);
  savePromise=savePromise.then(()=>dbRequest('projects','put',projectCopy));
  try{await savePromise;$('saveDot').classList.remove('saving');$('saveLabel').textContent='All changes saved';if(!silent)toast('Project saved on this device.');}
  catch(error){console.error(error);$('saveLabel').textContent='Save failed';toast('Could not save project. Storage may be full.','error');}
}
function scheduleSave() {
  if(!currentProject)return;
  $('saveDot').classList.add('saving');$('saveLabel').textContent='Unsaved changes';
  clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveProject(true),850);
}
async function duplicateCurrentProject() {
  if(!currentProject)return;
  const copy=clone(currentProject);copy.id=uid('project');copy.title=`${copy.title} copy`;copy.createdAt=Date.now();copy.updatedAt=Date.now();await dbRequest('projects','put',copy);toast('Project duplicated.');
}

function setProjectTitle() { if(currentProject){currentProject.title=$('projectTitleInput').value;scheduleSave();} }
function addHistory() { if(!currentProject)return;undoStack.push(clone(currentProject.blocks));if(undoStack.length>40)undoStack.shift();redoStack=[]; }
function undo() { if(!currentProject||!undoStack.length)return;redoStack.push(clone(currentProject.blocks));currentProject.blocks=undoStack.pop();renderWorkspace();scheduleSave(); }
function redo() { if(!currentProject||!redoStack.length)return;undoStack.push(clone(currentProject.blocks));currentProject.blocks=redoStack.pop();renderWorkspace();scheduleSave(); }

function renderPalette(category) {
  activeCategory=category;
  document.querySelectorAll('.category').forEach(button=>button.classList.toggle('active',button.dataset.category===category));
  $('paletteCategoryName').textContent=CATEGORY_NAMES[category]||category;
  const target=$('paletteBlocks');target.innerHTML='';
  (BLOCKS[category]||[]).forEach(def=>{
    const button=document.createElement('button');button.className='palette-block';button.type='button';button.style.setProperty('--block-color',COLOR[def.color]||'#4c97ff');button.dataset.paletteType=def.type;button.innerHTML=`<span class="drag-grip">⠿</span><span>${escapeHtml(def.label)}</span>`;
    button.addEventListener('click',()=>{if(suppressPaletteClick){suppressPaletteClick=false;return;}appendBlock(def.type);});
    target.appendChild(button);
  });
  if(!(BLOCKS[category]||[]).length){target.innerHTML='<div class="workspace-empty" style="position:static;transform:none;width:auto;padding:22px 8px"><strong>More blocks are on the way</strong><span>This category is ready for future block packs.</span></div>';}
}
function blockLabel(block) {
  const f=block.fields||{};
  const input=(key,val,type='number')=>`<input data-field="${key}" type="${type}" value="${escapeHtml(val)}" ${type==='number'?'step="1"':''}>`;
  switch(block.type){
    case 'event_start':return 'when green flag clicked';
    case 'move':return `move ${input('steps',f.steps??10)} steps`;
    case 'turn':return `turn clockwise ${input('degrees',f.degrees??15)} degrees`;
    case 'go_to':return `go to x ${input('x',f.x??0)} y ${input('y',f.y??0)}`;
    case 'change_x':return `change x by ${input('value',f.value??10)}`;
    case 'change_y':return `change y by ${input('value',f.value??10)}`;
    case 'say':return `say ${input('text',f.text??'Hello!','text')} for ${input('seconds',f.seconds??2)} sec`;
    case 'think':return `think ${input('text',f.text??'Hmm...','text')} for ${input('seconds',f.seconds??2)} sec`;
    case 'change_size':return `change size by ${input('value',f.value??10)} %`;
    case 'set_size':return `set size to ${input('value',f.value??100)} %`;
    case 'show':return 'show';case 'hide':return 'hide';case 'next_costume':return 'next costume';
    case 'play_sound':return `play sound <select data-field="sound">${soundOptions(f.sound)}</select>`;
    case 'stop_sounds':return 'stop all sounds';
    case 'wait':return `wait ${input('seconds',f.seconds??1)} seconds`;
    case 'repeat':return `repeat ${input('times',f.times??10)} times`;
    case 'forever':return 'forever';
    case 'ask':return `ask ${input('question',f.question??'What is your name?','text')} and wait`;
    case 'set_random':return `set ${input('name',f.name??'score','text')} to random ${input('min',f.min??1)} to ${input('max',f.max??10)}`;
    case 'set_variable':return `set ${input('name',f.name??'score','text')} to ${input('value',f.value??0)}`;
    case 'change_variable':return `change ${input('name',f.name??'score','text')} by ${input('value',f.value??1)}`;
    case 'comment':return `note: ${input('text',f.text??'A note for this script','text')}`;
    default:return escapeHtml(block.type);
  }
}
function soundOptions(selected) {
  const sounds=currentProject?.sounds||[];
  const all=[...BUILTIN_SOUNDS.map(s=>({id:s.id,name:s.name})),...sounds.filter(s=>s.type!=='builtin').map(s=>({id:s.id,name:s.name}))];
  return all.map(sound=>`<option value="${escapeHtml(sound.id)}" ${sound.id===selected?'selected':''}>${escapeHtml(sound.name)}</option>`).join('');
}
function renderBlock(block) {
  const color=COLOR[categoryForBlock(block.type)]||'#4c97ff';
  const element=document.createElement('div');element.className=`block-card ${block.type==='event_start'?'hat':''}`;element.dataset.blockId=block.id;element.style.setProperty('--block-color',color);
  const label=document.createElement('span');label.className='block-text';label.innerHTML=blockLabel(block);
  const grip=document.createElement('span');grip.className='drag-grip';grip.textContent='⠿';element.append(grip,label);
  const remove=document.createElement('button');remove.className='block-remove';remove.type='button';remove.textContent='×';remove.title='Remove block';remove.addEventListener('click',()=>removeBlock(block.id));element.appendChild(remove);
  if(block.type==='repeat'||block.type==='forever'){
    const child=document.createElement('div');child.className='drop-zone nested-drop';child.dataset.parentId=block.id;
    (block.children||[]).forEach(childBlock=>child.appendChild(renderBlock(childBlock)));
    if(!(block.children||[]).length){const hint=document.createElement('span');hint.className='nested-hint';hint.textContent='drop blocks inside';child.appendChild(hint);}
    element.appendChild(child);
  }
  return element;
}
function categoryForBlock(type) {
  for(const [category,defs] of Object.entries(BLOCKS))if(defs.some(def=>def.type===type))return category;
  return 'motion';
}
function renderWorkspace() {
  if(!currentProject)return;
  const zone=$('workspaceDrop');zone.innerHTML='';
  (currentProject.blocks||[]).forEach(block=>zone.appendChild(renderBlock(block)));
  if(!currentProject.blocks.length){const empty=document.createElement('div');empty.className='workspace-empty';empty.innerHTML='<div class="empty-block-icon">⌁</div><strong>Start with a block</strong><span>Tap a block on the left or drag it here.</span>';zone.appendChild(empty);}
  updateBlockCount();
}
function updateBlockCount() {
  if(!currentProject)return;
  let count=0;const walk=list=>list.forEach(block=>{count++;if(block.children)walk(block.children);});walk(currentProject.blocks||[]);
  $('blockCount').textContent=`${count} BLOCK${count===1?'':'S'}`;
}
function findList(parentId) {
  if(parentId==='root')return currentProject.blocks;
  let result=null;const walk=list=>{for(const block of list){if(block.id===parentId){result=block.children||(block.children=[]);return;}if(block.children)walk(block.children);if(result)return;}};walk(currentProject.blocks);return result;
}
function findBlockAndList(id,list=currentProject.blocks,parent=null) {
  for(let i=0;i<list.length;i++){if(list[i].id===id)return {block:list[i],list,index:i,parent};if(list[i].children){const found=findBlockAndList(id,list[i].children,list[i]);if(found)return found;}}
  return null;
}
function appendBlock(type,parentId='root',index=null) {
  if(!currentProject)return;addHistory();const list=findList(parentId);if(!list)return;
  const block=makeBlock(type);if(index===null||index<0||index>list.length)list.push(block);else list.splice(index,0,block);
  renderWorkspace();scheduleSave();if(tutorialActive)completeTutorialAction('addBlock');
}
function removeBlock(id) { const found=findBlockAndList(id);if(!found)return;addHistory();found.list.splice(found.index,1);renderWorkspace();scheduleSave(); }
function updateBlockField(id,key,value) { const found=findBlockAndList(id);if(!found)return;found.block.fields[key]=value;scheduleSave(); }
function beginPointerDrag(event,kind,type,blockId,sourceElement) {
  if(event.button!==undefined&&event.button!==0)return;
  if(event.target.closest('input,select,button'))return;
  dragState={kind,type,blockId,sourceElement,startX:event.clientX,startY:event.clientY,active:false,ghost:null,pointerId:event.pointerId};
}
function handlePointerMove(event) {
  if(!dragState)return;
  const dx=event.clientX-dragState.startX,dy=event.clientY-dragState.startY;
  if(!dragState.active && Math.hypot(dx,dy)>7){
    dragState.active=true;
    if(dragState.kind==='existing')dragState.sourceElement.classList.add('dragging');
    const ghost=dragState.sourceElement.cloneNode(true);ghost.classList.add('drag-ghost');document.body.appendChild(ghost);dragState.ghost=ghost;
  }
  if(dragState.active&&dragState.ghost){dragState.ghost.style.left=`${event.clientX}px`;dragState.ghost.style.top=`${event.clientY}px`;
    document.querySelectorAll('.drop-zone').forEach(zone=>zone.classList.remove('drop-hover'));
    const under=document.elementFromPoint(event.clientX,event.clientY)?.closest('.drop-zone');if(under)under.classList.add('drop-hover');
  }
}
function handlePointerUp(event) {
  if(!dragState)return;
  const drag=dragState;dragState=null;
  document.querySelectorAll('.drop-zone').forEach(zone=>zone.classList.remove('drop-hover'));
  if(!drag.active)return;
  suppressPaletteClick=true;setTimeout(()=>suppressPaletteClick=false,100);
  drag.sourceElement.classList.remove('dragging');drag.ghost?.remove();
  const target=document.elementFromPoint(event.clientX,event.clientY);
  let zone=target?.closest('.drop-zone');let beforeCard=target?.closest('.block-card');
  if(beforeCard&&!zone)zone=beforeCard.parentElement.closest('.drop-zone');
  if(!zone){toast('Drop a block inside the workspace.','error');return;}
  const parentId=zone.dataset.parentId||'root';
  if(drag.kind==='existing'){
    const found=findBlockAndList(drag.blockId);if(!found)return;
    if(found.block.id===parentId)return;
    if(found.block.type==='repeat'||found.block.type==='forever'){
      let contains=false;const check=list=>list.forEach(item=>{if(item.id===parentId)contains=true;if(item.children)check(item.children);});check(found.block.children||[]);if(contains)return;
    }
    addHistory();const [block]=found.list.splice(found.index,1);const targetList=findList(parentId);if(!targetList)return;
    let index=targetList.length;if(beforeCard){const at=targetList.findIndex(item=>item.id===beforeCard.dataset.blockId);if(at>=0)index=at;}targetList.splice(index,0,block);
  } else {
    addHistory();const targetList=findList(parentId);if(!targetList)return;let index=targetList.length;if(beforeCard){const at=targetList.findIndex(item=>item.id===beforeCard.dataset.blockId);if(at>=0)index=at;}targetList.splice(index,0,makeBlock(drag.type));if(tutorialActive)completeTutorialAction('addBlock');
  }
  renderWorkspace();scheduleSave();
}
document.addEventListener('pointerdown',event=>{
  const palette=event.target.closest('[data-palette-type]');if(palette){beginPointerDrag(event,'new',palette.dataset.paletteType,null,palette);return;}
  const card=event.target.closest('.block-card');if(card){beginPointerDrag(event,'existing',null,card.dataset.blockId,card);}
});
document.addEventListener('pointermove',handlePointerMove,{passive:true});document.addEventListener('pointerup',handlePointerUp);document.addEventListener('pointercancel',handlePointerUp);
document.addEventListener('change',event=>{
  const field=event.target.closest('[data-field]');if(!field)return;const card=field.closest('.block-card');if(!card)return;let value=field.value;
  if(field.type==='number')value=Number(value);updateBlockField(card.dataset.blockId,field.dataset.field,value);
});

function selectEditorTab(tab) {
  activeEditorTab=tab;
  document.querySelectorAll('.editor-tab').forEach(button=>button.classList.toggle('active',button.dataset.editorTab===tab));
  $('codeView').classList.toggle('hidden',tab!=='code');$('costumeView').classList.toggle('hidden',tab!=='costumes');$('soundView').classList.toggle('hidden',tab!=='sounds');
  $('codePanel').classList.toggle('hidden',tab!=='code');
  $('workspacePanel').style.gridColumn='';
  if(tab!=='code')$('codePanel').classList.add('hidden');
  else $('codePanel').classList.remove('hidden');
  if(tab!=='code')$('workspacePanel').style.gridColumn='1 / 3';
}
function getSelectedSprite() { return currentProject?.sprites.find(sprite=>sprite.id===activeSpriteId) || currentProject?.sprites[0] || null; }
function renderSprites() {
  if(!currentProject)return;
  const strip=$('spriteStrip');strip.innerHTML='';
  currentProject.sprites.forEach(sprite=>{
    const button=document.createElement('button');button.className=`sprite-thumb ${sprite.id===activeSpriteId?'active':''}`;button.title=sprite.name;
    const img=document.createElement('img');img.src=sprite.image;img.alt='';const label=document.createElement('span');label.textContent=sprite.name;button.append(img,label);button.addEventListener('click',()=>{activeSpriteId=sprite.id;renderSprites();renderCostumes();$('selectedSpriteLabel').textContent=`Sprite: ${sprite.name}`;$('spriteNameValue').textContent=sprite.name;updateSpriteFields();drawStage();});strip.appendChild(button);
  });
  $('spriteCount').textContent=String(currentProject.sprites.length);
  const sprite=getSelectedSprite();$('selectedSpriteLabel').textContent=`Sprite: ${sprite?.name||'None'}`;$('spriteNameValue').textContent=sprite?.name||'None';updateSpriteFields();
}
function updateSpriteFields() {const sprite=getSelectedSprite();if(!sprite)return;$('spriteX').value=Math.round(sprite.x);$('spriteY').value=Math.round(sprite.y);$('spriteSize').value=Math.round(sprite.size);}
function updateSelectedSpriteField(key,value){const sprite=getSelectedSprite();if(!sprite)return;sprite[key]=Number(value);drawStage();scheduleSave();}
function renderCostumes() {
  if(!currentProject)return;const sprite=getSelectedSprite();const grid=$('costumeGrid');grid.innerHTML='';if(!sprite)return;
  (sprite.costumes||[]).forEach((costume,index)=>{
    const card=document.createElement('div');card.className='asset-card';const preview=document.createElement('div');preview.className='asset-preview';const img=document.createElement('img');img.src=costume.image;preview.appendChild(img);
    const meta=document.createElement('div');meta.className='asset-meta';const name=document.createElement('strong');name.textContent=costume.name;const detail=document.createElement('span');detail.textContent=index===sprite.costumeIndex?'Current costume':'Costume';meta.append(name,detail);
    const actions=document.createElement('div');actions.className='asset-card-actions';const use=document.createElement('button');use.textContent='Use';use.onclick=()=>{sprite.costumeIndex=index;sprite.image=costume.image;renderCostumes();drawStage();scheduleSave();};const rename=document.createElement('button');rename.textContent='Rename';rename.onclick=()=>{const name=prompt('Costume name',costume.name);if(name?.trim()){costume.name=name.trim();renderCostumes();scheduleSave();}};actions.append(use,rename);card.append(preview,meta,actions);grid.appendChild(card);
  });
}
function renderSounds() {
  if(!currentProject)return;const grid=$('soundGrid');grid.innerHTML='';
  if(!currentProject.sounds.length){grid.innerHTML='<div class="empty-projects" style="grid-column:1/-1;padding:28px"><div class="empty-symbol">♫</div><strong>No sounds yet</strong><span>Choose a built-in sound, upload one, or record your voice.</span></div>';return;}
  currentProject.sounds.forEach(sound=>{
    const card=document.createElement('div');card.className='sound-card';card.innerHTML=`<div class="sound-icon">♫</div><div class="sound-info"><strong>${escapeHtml(sound.name)}</strong><small>${sound.type==='builtin'?'SCRYVO sound library':(sound.type==='recorded'?'Recorded on this device':'Imported audio')}</small></div>`;
    const play=document.createElement('button');play.className='sound-preview';play.textContent='▶';play.title='Preview sound';play.onclick=()=>playSound(sound.id);const remove=document.createElement('button');remove.className='sound-preview';remove.textContent='×';remove.title='Remove sound';remove.onclick=()=>{currentProject.sounds=currentProject.sounds.filter(item=>item.id!==sound.id);renderSounds();scheduleSave();};card.append(play,remove);grid.appendChild(card);
  });
}

function drawBackdrop(ctx,backdrop) {
  const colors=backdrop?.colors||['#b7e5c9','#ecf5c9'];const gradient=ctx.createLinearGradient(0,0,480,360);gradient.addColorStop(0,colors[0]);gradient.addColorStop(1,colors[1]);ctx.fillStyle=gradient;ctx.fillRect(0,0,480,360);
  const decor=backdrop?.decor;
  if(decor==='meadow'||decor==='forest'){
    ctx.fillStyle='rgba(68,135,91,.18)';ctx.beginPath();ctx.ellipse(95,360,170,90,0,Math.PI,Math.PI*2);ctx.ellipse(365,360,190,100,0,Math.PI,Math.PI*2);ctx.fill();
    for(let i=0;i<9;i++){ctx.fillStyle='rgba(255,255,255,.42)';ctx.beginPath();ctx.arc(30+i*55,65+(i%3)*19,3+(i%2),0,Math.PI*2);ctx.fill();}
  } else if(decor==='sunset'){
    ctx.fillStyle='rgba(255,241,184,.7)';ctx.beginPath();ctx.arc(350,95,46,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(128,88,107,.13)';ctx.beginPath();ctx.moveTo(0,292);ctx.quadraticCurveTo(150,194,240,290);ctx.quadraticCurveTo(340,205,480,285);ctx.lineTo(480,360);ctx.lineTo(0,360);ctx.fill();
  } else if(decor==='ocean'){
    ctx.fillStyle='rgba(40,135,174,.17)';for(let y=235;y<380;y+=30){ctx.beginPath();ctx.moveTo(0,y);for(let x=0;x<=480;x+=24)ctx.lineTo(x,y+Math.sin((x+y)*.035)*7);ctx.lineTo(480,380);ctx.lineTo(0,380);ctx.fill();}
    ctx.fillStyle='rgba(255,255,255,.4)';for(let i=0;i<22;i++){ctx.beginPath();ctx.arc((i*71)%480,(i*43)%220+95,2,0,Math.PI*2);ctx.fill();}
  } else if(decor==='night'){
    ctx.fillStyle='rgba(255,255,255,.8)';for(let i=0;i<26;i++){ctx.beginPath();ctx.arc((i*67)%480,(i*41)%230+15,(i%3)+1,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#f5e6a8';ctx.beginPath();ctx.arc(370,82,28,0,Math.PI*2);ctx.fill();ctx.fillStyle='#4b5e84';ctx.beginPath();ctx.arc(382,70,26,0,Math.PI*2);ctx.fill();
  } else if(decor==='candy'){
    ctx.fillStyle='rgba(255,255,255,.35)';for(let i=0;i<8;i++){ctx.beginPath();ctx.arc(30+i*65,80+(i%3)*38,12+(i%2)*8,0,Math.PI*2);ctx.fill();}
  } else if(decor==='ice'){
    ctx.strokeStyle='rgba(255,255,255,.56)';ctx.lineWidth=3;for(let i=0;i<8;i++){ctx.beginPath();ctx.moveTo(i*70,270);ctx.lineTo(i*70+28,210);ctx.lineTo(i*70+58,270);ctx.stroke();}
  } else if(decor==='paper'){
    ctx.strokeStyle='rgba(72,103,143,.08)';ctx.lineWidth=1;for(let x=0;x<480;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,360);ctx.stroke();}
  }
  if(backdrop?.image){const image=getStageImage(backdrop.image);if(image?.complete)ctx.drawImage(image,0,0,480,360);}
}
function getStageImage(src) {
  if(stageImages.has(src))return stageImages.get(src);const image=new Image();image.onload=()=>drawStage();image.src=src;stageImages.set(src,image);return image;
}
function drawStage() {
  const canvas=$('stageCanvas');if(!canvas||!currentProject)return;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,480,360);drawBackdrop(ctx,currentProject.backdrop);
  for(const sprite of currentProject.sprites){if(!sprite.visible)continue;const image=getStageImage(sprite.image);if(!image?.complete||!image.naturalWidth)continue;
    const x=240+sprite.x,y=180-sprite.y;const width=72*(sprite.size/100),height=72*(sprite.size/100);ctx.save();ctx.translate(x,y);ctx.rotate((sprite.direction-90)*Math.PI/180);ctx.drawImage(image,-width/2,-height/2,width,height);ctx.restore();
    if(sprite.message){ctx.font='bold 13px system-ui';const text=sprite.message;const tw=Math.min(170,ctx.measureText(text).width+22);const bx=Math.max(7,Math.min(473-tw,x-tw/2));const by=Math.max(8,y-height/2-46);ctx.fillStyle='white';roundRect(ctx,bx,by,tw,34,10);ctx.fill();ctx.strokeStyle='#d7e0e9';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#314359';ctx.textAlign='center';ctx.fillText(text.slice(0,24),bx+tw/2,by+22);ctx.beginPath();ctx.moveTo(x-5,by+33);ctx.lineTo(x+2,by+41);ctx.lineTo(x+7,by+33);ctx.fill();}
  }
  const selected=getSelectedSprite();if(selected){$('coordinateLabel').textContent=`x: ${Math.round(selected.x)}   y: ${Math.round(selected.y)}`;}
}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function setSpritePosition(sprite,x,y){sprite.x=Math.max(-240,Math.min(240,x));sprite.y=Math.max(-180,Math.min(180,y));drawStage();updateSpriteFields();scheduleSave();}
let stageDrag=null;
$('stageCanvas').addEventListener('pointerdown',event=>{if(!currentProject)return;const rect=event.currentTarget.getBoundingClientRect();stageDrag={startX:event.clientX,startY:event.clientY,rect};event.currentTarget.setPointerCapture(event.pointerId);});
$('stageCanvas').addEventListener('pointerup',event=>{if(!stageDrag)return;const sprite=getSelectedSprite();if(!sprite){stageDrag=null;return;}const rect=stageDrag.rect;const scaleX=480/rect.width,scaleY=360/rect.height;const dx=(event.clientX-stageDrag.startX)*scaleX,dy=(event.clientY-stageDrag.startY)*scaleY;if(Math.hypot(dx,dy)>3)setSpritePosition(sprite,sprite.x+dx,sprite.y-dy);stageDrag=null;});
$('stageCanvas').addEventListener('pointercancel',()=>stageDrag=null);

function openSpriteLibrary() {
  const cards=SPRITE_LIBRARY.map(item=>`<button class="choice-card" data-sprite-choice="${item.id}"><div class="choice-art"><img src="${svgData(item.svg)}"></div><strong>${item.name}</strong><small>${item.kind}</small></button>`).join('');
  showModal(`<h2 class="modal-heading">Choose a sprite</h2><p class="modal-subtitle">A few original characters to start your scene.</p><div class="choice-grid">${cards}</div><div class="modal-actions"><button class="modal-cancel" id="spriteCancel">Close</button></div>`);
  $('spriteCancel').onclick=closeModal;
  document.querySelectorAll('[data-sprite-choice]').forEach(button=>button.onclick=()=>{const template=SPRITE_LIBRARY.find(item=>item.id===button.dataset.spriteChoice);if(!template)return;const sprite=makeSprite(template);currentProject.sprites.push(sprite);activeSpriteId=sprite.id;closeModal();renderSprites();renderCostumes();drawStage();scheduleSave();toast(`${sprite.name} added to the stage.`);if(tutorialActive)completeTutorialAction('addSprite');});
}
function openCostumeLibrary() {
  const cards=SPRITE_LIBRARY.map(item=>`<button class="choice-card" data-costume-choice="${item.id}"><div class="choice-art"><img src="${svgData(item.svg)}"></div><strong>${item.name}</strong><small>${item.kind}</small></button>`).join('');
  showModal(`<h2 class="modal-heading">Add a costume</h2><p class="modal-subtitle">Add one of SCRYVO’s original library drawings to the selected sprite.</p><div class="choice-grid">${cards}</div>`);
  document.querySelectorAll('[data-costume-choice]').forEach(button=>button.onclick=()=>{const template=SPRITE_LIBRARY.find(item=>item.id===button.dataset.costumeChoice);const sprite=getSelectedSprite();if(!template||!sprite)return;const image=svgData(template.svg);sprite.costumes.push({id:uid('costume'),name:template.name,image});sprite.costumeIndex=sprite.costumes.length-1;sprite.image=image;closeModal();renderCostumes();drawStage();scheduleSave();toast(`${template.name} costume added.`);});
}

function openBackdropLibrary() {
  const cards=BACKDROP_LIBRARY.map(item=>`<button class="choice-card" data-backdrop-choice="${item.id}"><div class="choice-art" style="background:linear-gradient(135deg,${item.colors[0]},${item.colors[1]})"><span style="font-size:24px;color:rgba(35,55,75,.38)">✧</span></div><strong>${item.name}</strong><small>Stage backdrop</small></button>`).join('');
  showModal(`<h2 class="modal-heading">Choose a backdrop</h2><p class="modal-subtitle">Set the scene before your sprites take the stage.</p><div class="choice-grid">${cards}</div><div class="modal-actions"><button class="modal-cancel" id="backdropCancel">Close</button></div>`);
  $('backdropCancel').onclick=closeModal;document.querySelectorAll('[data-backdrop-choice]').forEach(button=>button.onclick=()=>{currentProject.backdrop=clone(BACKDROP_LIBRARY.find(item=>item.id===button.dataset.backdropChoice));closeModal();drawStage();scheduleSave();toast('Backdrop changed.');});
}
function showModal(html) { $('modalContent').innerHTML=html;$('modalLayer').classList.remove('hidden');$('modalCard').scrollTop=0; }
function closeModal() { if(recorder&&recorder.state!=='inactive'){recordingShouldSave=false;discardRecording();} $('modalLayer').classList.add('hidden');$('modalContent').innerHTML=''; }
function closeMenus() { $('profileMenu').classList.add('hidden');$('editorProfileMenu').classList.add('hidden'); }

function showImportProgress(title, detail) {
  showModal(`<div class="import-progress"><div class="import-spinner" aria-hidden="true"></div><p class="eyebrow">SCRYVO ASSET IMPORT</p><h2 class="modal-heading">${escapeHtml(title)}</h2><p class="modal-subtitle" id="importProgressText">${escapeHtml(detail)}</p><div class="import-progress-track"><i id="importProgressBar"></i></div></div>`);
}
function readImageData(file, onDone) {
  showImportProgress('Importing image', file.name || 'Preparing image…');
  const reader=new FileReader();
  reader.onprogress=event=>{if(event.lengthComputable&&$('importProgressBar'))$('importProgressBar').style.width=`${Math.max(2,Math.round(event.loaded/event.total*100))}%`;};
  reader.onload=()=>{if($('importProgressBar'))$('importProgressBar').style.width='100%';onDone(reader.result);};
  reader.onerror=()=>{closeModal();toast('Could not read this image.','error');};
  reader.readAsDataURL(file);
}
function startImageImport(input) {
  const file=input.files?.[0];input.value='';if(!file)return;
  if(file.size>10*1024*1024){toast('Image is larger than 10 MB.','error');return;}
  if(!file.type.startsWith('image/')){toast('Choose an image file.','error');return;}
  pendingImageName=file.name.replace(/\.[^.]+$/,'')||'Imported image';
  readImageData(file,data=>{pendingImageData=data;showImageDestination();});
}
function showImageDestination() {
  showModal(`<h2 class="modal-heading">Import image</h2><p class="modal-subtitle">${escapeHtml(pendingImageName)} is ready. Where should it go?</p><div class="choice-grid"><button class="choice-card" id="imageAsSprite"><div class="choice-art"><img src="${pendingImageData}" alt=""></div><strong>Add as sprite</strong><small>New character or object</small></button><button class="choice-card" id="imageAsBackdrop"><div class="choice-art"><img src="${pendingImageData}" alt=""></div><strong>Use as backdrop</strong><small>Fill the stage</small></button><button class="choice-card" id="imageAsCostume"><div class="choice-art"><img src="${pendingImageData}" alt=""></div><strong>Add as costume</strong><small>Selected sprite</small></button></div>`);
  $('imageAsSprite').onclick=()=>{const sprite={id:uid('sprite'),name:pendingImageName,image:pendingImageData,costumes:[{id:uid('costume'),name:pendingImageName,image:pendingImageData}],costumeIndex:0,x:0,y:0,size:100,direction:90,visible:true,message:''};currentProject.sprites.push(sprite);activeSpriteId=sprite.id;finishImageImport('Sprite added.');};
  $('imageAsBackdrop').onclick=()=>{currentProject.backdrop={id:uid('backdrop'),name:pendingImageName,colors:['#e7edf4','#d8e2ed'],decor:'paper',image:pendingImageData};finishImageImport('Backdrop added.');};
  $('imageAsCostume').onclick=()=>{const sprite=getSelectedSprite();if(!sprite){toast('Select a sprite first.','error');return;}sprite.costumes.push({id:uid('costume'),name:pendingImageName,image:pendingImageData});sprite.costumeIndex=sprite.costumes.length-1;sprite.image=pendingImageData;finishImageImport('Costume added.');};
}
function finishImageImport(message) {pendingImageData=null;closeModal();renderSprites();renderCostumes();drawStage();scheduleSave();toast(`Done — ${message}`);}

function openPaintEditor(target='sprite') {
  const sprite=getSelectedSprite();
  showModal(`<h2 class="modal-heading">Paint editor</h2><p class="modal-subtitle">Draw with your finger, mouse or stylus. Your artwork is saved inside this project.</p><div class="paint-layout"><div class="paint-board"><canvas id="paintCanvas" width="640" height="480"></canvas></div><div class="paint-tools"><div><div class="tool-label">BRUSH COLOR</div><input id="paintColor" type="color" value="#315f9e"><div id="paintSwatches" class="color-palette"></div></div><div><div class="tool-label">BRUSH SIZE</div><input id="paintSize" type="range" min="2" max="48" value="8"><div id="paintSizeLabel" class="draw-note">8 px</div></div><div><div class="tool-label">TOOLS</div><div class="paint-tool-row"><button id="paintBrush" class="active">Brush</button><button id="paintEraser">Eraser</button></div><div class="paint-tool-row" style="margin-top:5px"><button id="paintUndo">Undo stroke</button><button id="paintClear">Clear</button></div></div><p class="draw-note">The canvas uses a transparent background. Exported drawings are stored as PNG costumes.</p><button class="primary-button" id="paintSave">Save drawing</button></div></div>`);
  paintState={target,strokes:[],redo:[],drawing:false,color:'#315f9e',size:8,tool:'brush'};
  const canvas=$('paintCanvas'),ctx=canvas.getContext('2d');ctx.lineCap='round';ctx.lineJoin='round';
  const swatches=['#172536','#315f9e','#4c97ff','#9966ff','#d65cd6','#f36b6b','#f2bd50','#f39b56','#52b88b','#76c9aa','#a2c8e9','#ffffff','#b8c3cf','#7b668e','#d7a9a0','#6b956f','#d7df75','#252d3d'];
  $('paintSwatches').innerHTML=swatches.map((color,i)=>`<button class="swatch ${i===1?'active':''}" data-color="${color}" style="background:${color}" aria-label="${color}"></button>`).join('');
  document.querySelectorAll('.swatch').forEach(button=>button.onclick=()=>{paintState.color=button.dataset.color;paintState.tool='brush';$('paintColor').value=button.dataset.color;updatePaintTools();});
  $('paintColor').oninput=event=>{paintState.color=event.target.value;paintState.tool='brush';updatePaintTools();};
  $('paintSize').oninput=event=>{paintState.size=Number(event.target.value);$('paintSizeLabel').textContent=`${paintState.size} px`;};
  $('paintBrush').onclick=()=>{paintState.tool='brush';updatePaintTools();};$('paintEraser').onclick=()=>{paintState.tool='eraser';updatePaintTools();};
  $('paintUndo').onclick=()=>{if(paintState.strokes.length){paintState.redo.push(paintState.strokes.pop());redrawPaint();}};
  $('paintClear').onclick=()=>{if(confirm('Clear the drawing?')){paintState.strokes=[];paintState.redo=[];redrawPaint();}};
  $('paintSave').onclick=savePainting;
  function point(event){const rect=canvas.getBoundingClientRect();return {x:(event.clientX-rect.left)/rect.width*canvas.width,y:(event.clientY-rect.top)/rect.height*canvas.height};}
  canvas.addEventListener('pointerdown',event=>{event.preventDefault();canvas.setPointerCapture(event.pointerId);paintState.drawing=true;const p=point(event);paintState.current={color:paintState.color,size:paintState.size,tool:paintState.tool,points:[p]};redrawPaint();});
  canvas.addEventListener('pointermove',event=>{if(!paintState?.drawing)return;const p=point(event);paintState.current.points.push(p);redrawPaint();});
  const end=()=>{if(!paintState?.drawing)return;paintState.drawing=false;if(paintState.current){paintState.strokes.push(paintState.current);paintState.current=null;paintState.redo=[];}redrawPaint();};
  canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
  function updatePaintTools(){ $('paintBrush').classList.toggle('active',paintState.tool==='brush');$('paintEraser').classList.toggle('active',paintState.tool==='eraser');document.querySelectorAll('.swatch').forEach(button=>button.classList.toggle('active',button.dataset.color===paintState.color)); }
  function redrawPaint(){ctx.clearRect(0,0,canvas.width,canvas.height);const all=[...paintState.strokes,...(paintState.current?[paintState.current]:[])];all.forEach(stroke=>{if(!stroke.points.length)return;ctx.save();ctx.globalCompositeOperation=stroke.tool==='eraser'?'destination-out':'source-over';ctx.strokeStyle=stroke.color;ctx.lineWidth=stroke.size;ctx.beginPath();ctx.moveTo(stroke.points[0].x,stroke.points[0].y);if(stroke.points.length===1){ctx.lineTo(stroke.points[0].x+.1,stroke.points[0].y+.1);}else stroke.points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));ctx.stroke();ctx.restore();});}
  paintState.redraw=redrawPaint;
}
function savePainting() {
  if(!paintState)return;const canvas=$('paintCanvas');const data=canvas.toDataURL('image/png');
  if(paintState.target==='backdrop')currentProject.backdrop={id:uid('backdrop'),name:'My drawing',colors:['#fff','#f0f3f7'],decor:'paper',image:data};
  else {const sprite=getSelectedSprite();if(!sprite){toast('Select a sprite first.','error');return;}sprite.costumes.push({id:uid('costume'),name:`Drawing ${sprite.costumes.length+1}`,image:data});sprite.costumeIndex=sprite.costumes.length-1;sprite.image=data;}
  paintState=null;closeModal();renderCostumes();drawStage();scheduleSave();toast('Your drawing has been saved.');
}

async function addSound(sound) {currentProject.sounds.push(sound);renderSounds();scheduleSave();toast(`${sound.name} added.`);}
function openSoundLibrary() {
  const items=BUILTIN_SOUNDS.map(sound=>`<div class="sound-library-item"><div class="sound-icon">♫</div><div><strong>${sound.name}</strong><small>${sound.description}</small></div><button data-preview-builtin="${sound.id}">Preview</button><button data-add-builtin="${sound.id}">Add</button></div>`).join('');
  showModal(`<h2 class="modal-heading">Sound library</h2><p class="modal-subtitle">A small set of original synthesized sounds, ready to use.</p><div class="sound-library-grid">${items}</div>`);
  document.querySelectorAll('[data-preview-builtin]').forEach(button=>button.onclick=()=>playBuiltinSound(button.dataset.previewBuiltin));
  document.querySelectorAll('[data-add-builtin]').forEach(button=>button.onclick=()=>{const sound=BUILTIN_SOUNDS.find(item=>item.id===button.dataset.addBuiltin);if(sound&&!currentProject.sounds.some(item=>item.id===sound.id))addSound({id:sound.id,name:sound.name,type:'builtin'});else toast('That sound is already in this project.');});
}
function ensureAudioContext(){if(!audioContext)audioContext=new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume();return audioContext;}
async function playBuiltinSound(id) {
  const sound=BUILTIN_SOUNDS.find(item=>item.id===id);if(!sound)return;
  const context=ensureAudioContext();const start=context.currentTime;
  sound.notes.forEach((note,index)=>{const osc=context.createOscillator();const gain=context.createGain();osc.type=id==='boop'?'triangle':'sine';osc.frequency.setValueAtTime(note[0],start+index*.105);gain.gain.setValueAtTime(.0001,start+index*.105);gain.gain.linearRampToValueAtTime(.13,start+index*.105+.015);gain.gain.exponentialRampToValueAtTime(.0001,start+index*.105+note[1]);osc.connect(gain);gain.connect(context.destination);osc.start(start+index*.105);osc.stop(start+index*.105+note[1]+.02);});
  await sleep(sound.notes.length*105+240);
}
async function playSound(id) {
  const sound=currentProject?.sounds.find(item=>item.id===id)||BUILTIN_SOUNDS.find(item=>item.id===id);
  if(!sound)return;
  if(sound.type==='builtin'||BUILTIN_SOUNDS.some(item=>item.id===id)){await playBuiltinSound(id);return;}
  if(!sound.data)return;
  try{if(activeAudio){activeAudio.pause();activeAudio=null;}const audio=new Audio(sound.data);activeAudio=audio;await audio.play();await new Promise(resolve=>{audio.onended=resolve;audio.onerror=resolve;});activeAudio=null;}catch(error){console.warn(error);toast('This audio could not be played.','error');}
}
function stopSounds(){if(activeAudio){activeAudio.pause();activeAudio.currentTime=0;activeAudio=null;}if(audioContext){audioContext.close().catch(()=>{});audioContext=null;}}
function importSoundFile(input) {
  const file=input.files?.[0];input.value='';if(!file)return;if(!file.type.startsWith('audio/')){toast('Choose an audio file.','error');return;}if(file.size>10*1024*1024){toast('Audio files must be 10 MB or smaller.','error');return;}
  showImportProgress('Preparing audio',file.name||'Reading audio file…');
  const reader=new FileReader();reader.onprogress=event=>{if(event.lengthComputable&&$('importProgressBar'))$('importProgressBar').style.width=`${Math.max(2,Math.round(event.loaded/event.total*100))}%`;};
  reader.onload=()=>{if($('importProgressBar'))$('importProgressBar').style.width='100%';showSoundPreview({id:uid('sound'),name:file.name.replace(/\.[^.]+$/,'')||'Imported sound',type:'imported',data:reader.result},'Preview imported sound');};
  reader.onerror=()=>{closeModal();toast('Could not read this audio file.','error');};reader.readAsDataURL(file);
}
function showSoundPreview(sound,heading='Preview sound') {
  showModal(`<h2 class="modal-heading">${escapeHtml(heading)}</h2><p class="modal-subtitle">Listen first, then add it to your project.</p><div class="record-panel"><div class="sound-icon" style="width:50px;height:50px;font-size:22px">♫</div><strong>${escapeHtml(sound.name)}</strong><audio id="soundPreviewPlayer" controls style="width:min(100%,380px);margin-top:12px"></audio><div class="modal-actions"><button class="modal-cancel" id="soundPreviewCancel">Cancel</button><button class="modal-confirm" id="soundPreviewAdd">Add sound</button></div></div>`);
  const player=$('soundPreviewPlayer');player.src=sound.data;player.load();$('soundPreviewCancel').onclick=closeModal;$('soundPreviewAdd').onclick=()=>{closeModal();addSound(sound);};
}

async function startVoiceRecording() {
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){toast('Audio recording is not available in this WebView.','error');return;}
  showModal(`<h2 class="modal-heading">Record a sound</h2><p class="modal-subtitle">Use your microphone to record a voice or a sound around you.</p><div class="record-panel"><div class="record-indicator" id="recordIndicator">●</div><strong id="recordStatus">Microphone is ready</strong><span id="recordTimer">00:00</span><div class="modal-actions"><button class="modal-cancel" id="recordCancel">Cancel</button><button class="modal-confirm" id="recordStart">Start recording</button><button class="modal-confirm hidden" id="recordStop" style="background:#d85b67">Stop & save</button></div></div>`);
  $('recordCancel').onclick=async()=>{recordingShouldSave=false;await discardRecording();closeModal();};
  $('recordStart').onclick=async()=>{
    try{
      recordingShouldSave=false;
      recorderStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      recordedChunks=[];recorder=new MediaRecorder(recorderStream);recorder.ondataavailable=event=>{if(event.data.size)recordedChunks.push(event.data);};recorder.onstop=async()=>{const keep=recordingShouldSave;const blob=new Blob(recordedChunks,{type:recorder.mimeType||'audio/webm'});await discardRecording(false);if(keep&&blob.size){const reader=new FileReader();reader.onload=()=>{const sound={id:uid('sound'),name:`Voice recording ${currentProject.sounds.length+1}`,type:'recorded',data:reader.result};showSoundPreview(sound,'Preview your recording');};reader.readAsDataURL(blob);}else if(!keep){toast('Recording discarded.');}};
      recorder.start();recorderStartedAt=Date.now();$('recordStatus').textContent='Recording… speak now';$('recordIndicator').classList.add('recording');$('recordStart').classList.add('hidden');$('recordStop').classList.remove('hidden');recorderTimer=setInterval(()=>{const sec=Math.floor((Date.now()-recorderStartedAt)/1000);$('recordTimer').textContent=`${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;},250);
    }catch(error){console.error(error);await discardRecording();$('recordStatus').textContent='Microphone permission is needed to record.';toast('Microphone permission was not granted.','error');}
  };
  $('recordStop').onclick=()=>{if(recorder&&recorder.state!=='inactive'){recordingShouldSave=true;recorder.stop();}};
}
async function discardRecording(stopRecorder=true) {
  if(recorderTimer){clearInterval(recorderTimer);recorderTimer=null;}
  if(stopRecorder&&recorder&&recorder.state!=='inactive'){try{recorder.stop();}catch(_){}}
  if(recorderStream){recorderStream.getTracks().forEach(track=>track.stop());recorderStream=null;}
}

/* Guided first-run tutorial: the step remains active until its matching event fires. */
const TUTORIAL_STEPS=[
  {action:'newProject',selector:'#newProjectBtn',title:'Create your first project',text:'Tap New project. SCRYVO will open a fresh stage where you can build.'},
  {action:'addSprite',selector:'#addSpriteBtn',title:'Give your stage a character',text:'Open Add sprite, then choose any character from the library. The guide will wait until one is added.'},
  {action:'addBlock',selector:'[data-palette-type="move"]',title:'Add your first code block',text:'Tap or drag the blue Motion block into the workspace. Blocks become instructions for your sprite.'},
  {action:'run',selector:'#runBtn',title:'Run your project',text:'Press Run. Your sprite should move on the stage. You can stop the program at any time.'},
  {action:'save',selector:'#saveBtn',title:'Save your work',text:'Press Save. Your project is stored locally under your account on this device.'}
];
function showTutorialPrompt() {
  const mascot=`<svg viewBox="0 0 120 120"><path d="M24 70 52 20q8-14 18 0l30 50q8 14-7 18l-53 9q-17 3-16-13z" fill="#f2bd50" stroke="#24364b" stroke-width="5"/><circle cx="54" cy="62" r="4" fill="#24364b"/><circle cx="73" cy="62" r="4" fill="#24364b"/><path d="M57 77q8 6 15-1" fill="none" stroke="#24364b" stroke-width="4" stroke-linecap="round"/></svg>`;
  showModal(`<div class="tutorial-prompt"><div class="tutorial-prompt-art">${mascot}</div><div class="tutorial-prompt-copy"><p class="eyebrow">A QUICK FIRST TOUR</p><h2>Want a quick tour?</h2><p>Follow a small animated pointer and try the editor yourself. Each step waits until you complete the action.</p><div class="tutorial-prompt-buttons"><button class="tutorial-start" id="promptStart">Start tutorial</button><button class="tutorial-no" id="promptNo">No, thanks</button></div></div></div>`);
  $('promptStart').onclick=async()=>{currentUser.welcomeHandled=true;await dbRequest('accounts','put',currentUser);closeModal();startTutorial();};
  $('promptNo').onclick=async()=>{currentUser.welcomeHandled=true;await dbRequest('accounts','put',currentUser);closeModal();};
}
function startTutorial() {
  tutorialActive=true;tutorialIndex=0;
  showOnly('dashboard');renderDashboard().then(updateTutorialCoach);
}
function updateTutorialCoach() {
  if(!tutorialActive||tutorialIndex<0||tutorialIndex>=TUTORIAL_STEPS.length)return;
  const step=TUTORIAL_STEPS[tutorialIndex];
  let target=document.querySelector(step.selector);
  if(!target && step.action==='addBlock') {renderPalette('motion');target=document.querySelector(step.selector);}
  if(!target){setTimeout(updateTutorialCoach,250);return;}
  target.scrollIntoView?.({block:'nearest',inline:'nearest',behavior:'smooth'});
  const rect=target.getBoundingClientRect();const spot=$('tutorialSpotlight');spot.style.left=`${rect.left-5}px`;spot.style.top=`${rect.top-5}px`;spot.style.width=`${rect.width+10}px`;spot.style.height=`${rect.height+10}px`;
  $('tutorialCursor').style.left=`${rect.left+rect.width*.62}px`;$('tutorialCursor').style.top=`${rect.top+rect.height*.65}px`;
  $('tutorialTitle').textContent=step.title;$('tutorialText').textContent=step.text;$('tutorialStepNumber').textContent=String(tutorialIndex+1);$('tutorialStepTotal').textContent=String(TUTORIAL_STEPS.length);$('tutorialProgressBar').style.width=`${(tutorialIndex/TUTORIAL_STEPS.length)*100}%`;
  $('tutorialLayer').classList.remove('hidden');
}
function completeTutorialAction(action) {
  if(!tutorialActive)return;const step=TUTORIAL_STEPS[tutorialIndex];if(!step||step.action!==action)return;
  tutorialIndex++;
  if(tutorialIndex>=TUTORIAL_STEPS.length){finishTutorial();return;}
  setTimeout(updateTutorialCoach,170);
}
async function finishTutorial() {
  tutorialActive=false;tutorialIndex=-1;$('tutorialLayer').classList.add('hidden');
  currentUser.tutorialCompleted=true;currentUser.welcomeHandled=true;await dbRequest('accounts','put',currentUser);
  showModal(`<div style="text-align:center;padding:15px 8px"><div style="font-size:40px;color:#d9ac4a;margin-bottom:8px">✳</div><p class="eyebrow">SCRYVO BEGINNER TOUR</p><h2 class="modal-heading" style="margin:0 0 8px">You have passed the tutorial</h2><p class="modal-subtitle" style="margin:0 auto;max-width:340px">You created a project, added a sprite, placed a block, ran it and saved your work. Your studio is ready.</p><div class="modal-actions" style="justify-content:center"><button class="modal-confirm" id="tutorialDone">Continue creating</button></div></div>`);
  $('tutorialDone').onclick=closeModal;
}
function exitTutorial() {tutorialActive=false;tutorialIndex=-1;$('tutorialLayer').classList.add('hidden');toast('Tutorial paused. You can start it again from your profile.');}

async function animateSprite(sprite,targetX,targetY,token,duration=260) {
  const startX=sprite.x,startY=sprite.y,start=performance.now();
  return new Promise(resolve=>{
    const tick=(now)=>{if(token!==runToken){resolve();return;}const t=Math.min(1,(now-start)/duration);const eased=1-Math.pow(1-t,3);sprite.x=startX+(targetX-startX)*eased;sprite.y=startY+(targetY-startY)*eased;drawStage();updateSpriteFields();if(t<1)requestAnimationFrame(tick);else resolve();};requestAnimationFrame(tick);
  });
}
async function executeBlocks(list,token) {
  for(const block of list||[]){if(token!==runToken)return;const f=block.fields||{};const sprite=getSelectedSprite();
    switch(block.type){
      case 'event_start':case 'comment':break;
      case 'move':if(sprite){const rad=sprite.direction*Math.PI/180;await animateSprite(sprite,sprite.x+Math.sin(rad)*Number(f.steps||0),sprite.y+Math.cos(rad)*Number(f.steps||0),token);}break;
      case 'turn':if(sprite){sprite.direction=(sprite.direction+Number(f.degrees||0))%360;drawStage();}break;
      case 'go_to':if(sprite)await animateSprite(sprite,Number(f.x)||0,Number(f.y)||0,token);break;
      case 'change_x':if(sprite)await animateSprite(sprite,sprite.x+Number(f.value||0),sprite.y,token);break;
      case 'change_y':if(sprite)await animateSprite(sprite,sprite.x,sprite.y+Number(f.value||0),token);break;
      case 'say':case 'think':if(sprite){sprite.message=String(f.text||'');sprite.messageKind=block.type;drawStage();await sleep(Math.max(.1,Math.min(10,Number(f.seconds)||2))*1000);sprite.message='';drawStage();}break;
      case 'change_size':if(sprite){sprite.size=Math.max(10,Math.min(300,sprite.size+Number(f.value||0)));drawStage();updateSpriteFields();}break;
      case 'set_size':if(sprite){sprite.size=Math.max(10,Math.min(300,Number(f.value)||100));drawStage();updateSpriteFields();}break;
      case 'show':if(sprite){sprite.visible=true;drawStage();}break;
      case 'hide':if(sprite){sprite.visible=false;drawStage();}break;
      case 'next_costume':if(sprite?.costumes?.length){sprite.costumeIndex=(sprite.costumeIndex+1)%sprite.costumes.length;sprite.image=sprite.costumes[sprite.costumeIndex].image;renderCostumes();drawStage();}break;
      case 'play_sound':await playSound(f.sound||BUILTIN_SOUNDS[0].id);break;
      case 'stop_sounds':stopSounds();break;
      case 'wait':await sleep(Math.max(0,Math.min(30,Number(f.seconds)||0))*1000);break;
      case 'repeat':for(let i=0;i<Math.max(0,Math.min(100,Number(f.times)||0));i++){if(token!==runToken)return;await executeBlocks(block.children||[],token);}break;
      case 'forever':while(token===runToken){await executeBlocks(block.children||[],token);if(!block.children?.length)await sleep(50);}break;
      case 'set_variable':currentProject.variables[f.name||'score']=Number(f.value)||0;toast(`${f.name||'score'} = ${currentProject.variables[f.name||'score']}`);break;
      case 'change_variable':{const key=f.name||'score';currentProject.variables[key]=(Number(currentProject.variables[key])||0)+(Number(f.value)||0);toast(`${key}: ${currentProject.variables[key]}`);break;}
      case 'set_random':{const key=f.name||'score';const min=Number(f.min)||0,max=Number(f.max)||10;currentProject.variables[key]=Math.floor(Math.random()*(Math.max(min,max)-Math.min(min,max)+1))+Math.min(min,max);toast(`${key} = ${currentProject.variables[key]}`);break;}
      case 'ask':{const answer=prompt(String(f.question||'What is your answer?'));if(answer!==null)currentProject.variables.answer=answer;break;}
    }
    if(token!==runToken)return;
    if(block.type!=='move'&&block.type!=='go_to'&&block.type!=='change_x'&&block.type!=='change_y'&&block.type!=='wait'&&block.type!=='say'&&block.type!=='think'&&block.type!=='play_sound')await sleep(90);
  }
}
async function runProgram() {
  if(!currentProject||isRunning)return;
  isRunning=true;runToken++;const token=runToken;$('runBtn').disabled=true;$('stopBtn').disabled=false;$('stageStopBtn').disabled=false;
  toast('Project is running.');completeTutorialAction('run');
  try{await executeBlocks(currentProject.blocks,token);}catch(error){console.error(error);toast('The script stopped because of an error.','error');}
  if(token===runToken){isRunning=false;$('runBtn').disabled=false;$('stopBtn').disabled=true;$('stageStopBtn').disabled=true;scheduleSave();}
}
function stopProgram() {
  runToken++;isRunning=false;$('runBtn').disabled=false;$('stopBtn').disabled=true;$('stageStopBtn').disabled=true;stopSounds();
  if(currentProject){currentProject.sprites.forEach(sprite=>sprite.message='');drawStage();scheduleSave();}
}

async function exportProject(project=currentProject) {
  if(!project)return;const copy=clone(project);const text=JSON.stringify({format:'SCRYVO',version:1,exportedAt:new Date().toISOString(),project:copy},null,2);
  const bytes=new TextEncoder().encode(text);let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));const base64=btoa(binary);const name=(project.title||'Project').replace(/[^a-z0-9-_ ]/gi,'').trim().replace(/\s+/g,'_')||'Project';
  if(window.ScryvoBridge?.exportFile){window.ScryvoBridge.exportFile(`${name}.scryvo`,base64);}else{const blob=new Blob([text],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${name}.scryvo`;a.click();URL.revokeObjectURL(url);}
}
async function importProjectFile(input) {
  const file=input.files?.[0];input.value='';if(!file)return;try{if(file.size>40*1024*1024)throw new Error('Project is larger than 40 MB.');const json=JSON.parse(await file.text());const project=json.project||json;if(!project||!Array.isArray(project.sprites)||!Array.isArray(project.blocks))throw new Error('This is not a valid SCRYVO project.');project.id=uid('project');project.owner=currentUser.usernameKey;project.title=(project.title||'Imported project').slice(0,48);project.createdAt=Date.now();project.updatedAt=Date.now();await dbRequest('projects','put',project);await renderDashboard();toast('Project imported.');}catch(error){toast(error.message||'Could not import this project.','error');}}

function openFullscreenStage() {
  $('stageCanvas').requestFullscreen?.().catch(()=>toast('Fullscreen is not available here.','error'));
}
function showProjectNamePrompt() {createProject('Untitled project');}
function closeAllTransient() {closeModal();closeMenus();if(tutorialActive)exitTutorial();}
window.scryvoHandleBack=()=>{if(!$('modalLayer').classList.contains('hidden')){closeModal();return;}if(tutorialActive){exitTutorial();return;}if(!$('editor').classList.contains('hidden')){stopProgram();saveProject(true).then(()=>{showOnly('dashboard');renderDashboard();});return;}if(!$('dashboard').classList.contains('hidden')){$('profileMenu').classList.add('hidden');return;}return;};

/* Wiring */
document.querySelectorAll('.auth-tab').forEach(button=>button.addEventListener('click',()=>setAuthMode(button.dataset.authMode)));
$('authForm').addEventListener('submit',handleAuth);
document.querySelectorAll('.category').forEach(button=>button.addEventListener('click',()=>renderPalette(button.dataset.category)));
document.querySelectorAll('.editor-tab').forEach(button=>button.addEventListener('click',()=>selectEditorTab(button.dataset.editorTab)));
$('newProjectBtn').addEventListener('click',()=>{createProject('Untitled project').then(()=>completeTutorialAction('newProject'));});
$('projectSearch').addEventListener('input',renderDashboard);
$('profileButton').addEventListener('click',()=>$('profileMenu').classList.toggle('hidden'));
$('editorProfileBtn').addEventListener('click',()=>$('editorProfileMenu').classList.toggle('hidden'));
$('logoutBtn').addEventListener('click',logout);$('editorLogoutBtn').addEventListener('click',logout);
$('tutorialAgainBtn').addEventListener('click',()=>{closeMenus();startTutorial();});
$('editorTutorialBtn').addEventListener('click',()=>{closeMenus();showOnly('dashboard');startTutorial();});
$('homeBtn').addEventListener('click',async()=>{stopProgram();await saveProject(true);showOnly('dashboard');renderDashboard();});
$('saveBtn').addEventListener('click',async()=>{await saveProject(false);completeTutorialAction('save');});
$('projectTitleInput').addEventListener('input',setProjectTitle);$('projectTitleInput').addEventListener('change',()=>saveProject(true));
$('runBtn').addEventListener('click',runProgram);$('stopBtn').addEventListener('click',stopProgram);$('greenFlagBtn').addEventListener('click',runProgram);$('stageStopBtn').addEventListener('click',stopProgram);
$('undoBtn').addEventListener('click',undo);$('redoBtn').addEventListener('click',redo);
$('addSpriteBtn').addEventListener('click',openSpriteLibrary);
$('costumeLibraryBtn').addEventListener('click',openCostumeLibrary);
$('uploadCostumeBtn').addEventListener('click',()=>$('imageImportInput').click());$('drawCostumeBtn').addEventListener('click',()=>openPaintEditor('sprite'));
$('imageImportInput').addEventListener('change',event=>startImageImport(event.target));
$('soundLibraryBtn').addEventListener('click',openSoundLibrary);$('uploadSoundBtn').addEventListener('click',()=>$('soundImportInput').click());$('soundImportInput').addEventListener('change',event=>importSoundFile(event.target));$('recordSoundBtn').addEventListener('click',startVoiceRecording);
$('backdropBtn').addEventListener('click',openBackdropLibrary);$('backdropLibraryBtn').addEventListener('click',openBackdropLibrary);$('drawBackdropBtn').addEventListener('click',()=>openPaintEditor('backdrop'));$('importBackdropBtn').addEventListener('click',()=>$('backdropImportInput').click());
$('backdropImportInput').addEventListener('change',event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;if(file.size>10*1024*1024){toast('Image is larger than 10 MB.','error');return;}if(!file.type.startsWith('image/')){toast('Choose an image file.','error');return;}readImageData(file,data=>{currentProject.backdrop={id:uid('backdrop'),name:file.name,colors:['#e7edf4','#d8e2ed'],decor:'paper',image:data};closeModal();drawStage();scheduleSave();toast('Done — backdrop imported.');});});
$('addSpriteBtn').dataset.tutorialTarget='addSprite';
$('spriteX').addEventListener('change',event=>updateSelectedSpriteField('x',event.target.value));$('spriteY').addEventListener('change',event=>updateSelectedSpriteField('y',event.target.value));$('spriteSize').addEventListener('change',event=>updateSelectedSpriteField('size',event.target.value));
$('fullscreenStageBtn').addEventListener('click',openFullscreenStage);
$('importProjectBtn').addEventListener('click',()=>$('projectImportInput').click());$('projectImportInput').addEventListener('change',event=>importProjectFile(event.target));
$('modalClose').addEventListener('click',closeModal);$('modalLayer').addEventListener('click',event=>{if(event.target===$('modalLayer'))closeModal();});
$('tutorialExitBtn').addEventListener('click',exitTutorial);
document.addEventListener('click',event=>{if(!event.target.closest('.profile-button')&&!event.target.closest('.profile-menu')&&!event.target.closest('.mini-profile'))closeMenus();});
$('zoomInBtn').addEventListener('click',()=>adjustWorkspaceZoom(1.1));$('zoomOutBtn').addEventListener('click',()=>adjustWorkspaceZoom(.9));
let workspaceZoom=1;function adjustWorkspaceZoom(factor){workspaceZoom=Math.max(.65,Math.min(1.45,workspaceZoom*factor));$('workspaceDrop').style.transform=`scale(${workspaceZoom})`;$('workspaceDrop').style.transformOrigin='top left';$('zoomLabel').textContent=`${Math.round(workspaceZoom*100)}%`;}
window.addEventListener('resize',()=>{if(tutorialActive)updateTutorialCoach();});
window.addEventListener('beforeunload',()=>{if(currentProject)saveProject(true);});

async function boot() {
  try{await openDatabase();}catch(error){console.error(error);showAuth();toast('Local database could not start in this WebView.','error');$('splash').classList.add('dismiss');return;}
  await sleep(850);$('splash').classList.add('dismiss');
  setTimeout(async()=>{try{const restored=await restoreSession();if(!restored)showAuth();}catch(error){console.error(error);showAuth();}},220);
}
boot();

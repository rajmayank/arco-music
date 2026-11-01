import { AudioEngine } from './audio.js';
import { INSTRUMENTS, EXERCISES, midiToFrequency, frequencyToNote, noteName, getFingering, getSequence } from './music.js';
import { renderFingerboard, renderStaff } from './visuals.js';
import { PracticeSession } from './session.js';
import { initTheme, setTheme, getTheme, resolvedTheme } from './theme.js';

initTheme();
let feedbackPalette;
function refreshFeedbackPalette(){
  const style=getComputedStyle(document.documentElement);
  feedbackPalette=Object.fromEntries(['pitch-good','pitch-adjust','wave-active','wave-idle'].map(name=>[name,style.getPropertyValue(`--${name}`).trim()]));
}
refreshFeedbackPalette();

const icons = {
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon:'<path d="M20 14A8.5 8.5 0 0 1 10 4a8.5 8.5 0 1 0 10 10Z"/>',
  practice:'<path d="M8 18V5l12-2v13M8 8l12-2"/><ellipse cx="5" cy="18" rx="3" ry="2"/><ellipse cx="17" cy="16" rx="3" ry="2"/>',
  tuner:'<path d="M8 3v6a4 4 0 0 0 8 0V3M12 13v8M5 6H3m18 0h-2"/>',
  library:'<rect x="3" y="4" width="6" height="16" rx="1"/><path d="m12 5 5-1 4 15-5 1zM3 8h6m-6 9h6"/>',
  progress:'<path d="M4 20V10m7 10V4m7 16v-7M2 21h20"/>',
  settings:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.1"/>',
  mic:'<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-4 0h8"/>',
  shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  play:'<path d="m8 4 12 8-12 8z" fill="currentColor" stroke="none"/>',
  pause:'<path d="M7 5h3v14H7zm7 0h3v14h-3z" fill="currentColor" stroke="none"/>',
  stop:'<rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" stroke="none"/>',
  volume:'<path d="m11 4-6 5H2v6h3l6 5zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  fire:'<path d="M12 3c1 5 6 5 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 3 2 4 2 4s3-4 1-9Z"/>',
  arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',
  violin:'<path d="m15 2 1 1-4 9m-3-6 2 2m4 1-2-1M7 10c-3 0-4 3-2 5-2 3 1 7 4 6 3 0 4-3 3-5 3-1 3-4 1-5M6 20 18 2m-7 14 4 2"/>',
  metronome:'<path d="m9 3-5 18h16L15 3Zm-1 13h8M12 18l5-12"/>',
  leaf:'<path d="M20 3C7 1 2 10 7 16s14 0 13-13ZM4 21 16 8"/>',
  headphones:'<path d="M4 14v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="12" width="4" height="8" rx="2"/><rect x="17" y="12" width="4" height="8" rx="2"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  reset:'<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7"/>',
  spark:'<path d="m12 3 2 6 6 3-6 2-2 7-3-7-6-2 6-3z"/>',
};
const icon = (name, cls='') => `<svg class="${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.practice}</svg>`;
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp = (x,min,max) => Math.max(min,Math.min(max,x));
const readLocal = (key,fallback) => {try{return JSON.parse(localStorage.getItem(key)) ?? fallback;}catch{return fallback;}};
const stored = readLocal('arco.settings.v1', {});
const settings = {
  instrument: INSTRUMENTS[stored.instrument] ? stored.instrument : 'violin',
  a4: Number.isFinite(stored.a4) ? clamp(stored.a4,430,450) : 440,
  tolerance: [15,25,40].includes(stored.tolerance) ? stored.tolerance : 25,
  holdMs: [250,350,600].includes(stored.holdMs) ? stored.holdMs : 350,
  threshold: Number.isFinite(stored.threshold) ? clamp(stored.threshold,.002,.04) : .006,
  duration: [60,120,300].includes(stored.duration) ? stored.duration : 60,
  bpm: Number.isFinite(stored.bpm) ? clamp(stored.bpm,30,180) : 60,
  labels: stored.labels !== false,
  details: stored.details === true,
  beatEnabled: stored.beatEnabled === true,
  deviceId: typeof stored.deviceId === 'string' ? stored.deviceId : '',
};
let history = readLocal('arco.history.v1', []);
history = Array.isArray(history) ? history.filter(s => s && Number.isFinite(s.npm) && Number.isFinite(s.hits) && Number.isFinite(s.elapsed) && typeof s.date === 'string').slice(-200) : [];
let storageWarning = false;
function persist() { try {localStorage.setItem('arco.settings.v1',JSON.stringify(settings));localStorage.setItem('arco.history.v1',JSON.stringify(history));} catch {if(!storageWarning){toast('Browser storage is unavailable. Progress will last for this visit.');storageWarning=true;}} }
const audio = new AudioEngine();
audio.setThreshold(settings.threshold);
let view = 'practice', exerciseId = 'open-strings', customMidi = INSTRUMENTS[settings.instrument].strings[settings.instrument==='violin'?2:3].midi, session = null, sessionSaved = false;
let micBusy = false, micGeneration = 0, error = '', demo = false, demoTimer = null, demoUntil = 0;
let lastNote = null, lastFrameAt = 0, lastWaveform = null, lastRms = 0, detectedBoardMidi = null;
let metronomeRequest = 0;
let metronome = false, modal = null, modalOrigin = null, devices = [], selectedString = null;
let toastTimer = null, finishShown = false;
let staffPitchKey = null, lastStaffDrawAt = -Infinity, demoOffset = 0;
const app = document.querySelector('#app');

function silenceMetronome(){++metronomeRequest;audio.stopMetronome();metronome=false;}
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3800);}
function instrument(){return INSTRUMENTS[settings.instrument];}
function sequence(){return getSequence(exerciseId,settings.instrument,customMidi);}
function exercise(){return EXERCISES.find(e=>e.id===exerciseId)||EXERCISES[0];}
function currentTarget(){return session?.snapshot(performance.now()).targetMidi ?? sequence()[0];}
function activeSession(){return session && ['running','paused'].includes(session.state);}
function timeString(seconds){const t=Math.max(0,Math.ceil(seconds));return `${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;}
function noteHTML(midi){const name=noteName(midi);return name.replace(/(-?\d+)$/,'<sub>$1</sub>');}
function description(midi){const fingering=getFingering(midi,settings.instrument);if(!fingering)return 'Explore the fingerboard';return `${fingering.stringName} string · ${fingering.finger === 0 ? 'Open string' : fingering.position}`;}
function meter(){return '<div class="tuning-meter"><div class="meter-track"></div><div class="meter-needle"></div></div><div class="meter-labels"><span>♭ &nbsp; Flat</span><span>In tune</span><span>Sharp &nbsp; ♯</span></div>';}
function status(){return `<button class="status-pill ${audio.isRunning?'live':''}" data-action="mic" title="${audio.isRunning?'Disconnect microphone':'Connect microphone'}"><span class="status-dot"></span>${micBusy?'Connecting…':audio.isRunning?'Microphone on':demo?'Demo mode':'Microphone off'}</button>`;}
function themeButton(){return `<button class="icon-button theme-toggle" data-action="theme" aria-label="Switch to ${resolvedTheme()==='dark'?'light':'dark'} mode" title="Switch to ${resolvedTheme()==='dark'?'light':'dark'} mode">${icon(resolvedTheme()==='dark'?'sun':'moon')}</button>`;}
function shell(){return `<div class="shell"><header class="app-header"><a class="brand" href="#practice" data-view="practice" aria-label="Arco practice studio"><svg class="brand-mark" viewBox="8 10 48 48" fill="none" aria-hidden="true"><path fill="currentColor" d="M17 20Q32 13 47 20L48 28C43 28 42 30 43 33S47 37 50 36L54 51H40L38 42C37 38 27 38 26 42L24 51H10L14 36C17 37 20 36 21 33S21 28 16 28L17 20Z"/></svg><span class="brand-word">arco</span></a><nav class="nav" aria-label="Main navigation">${[['practice','Practice'],['tuner','Tune'],['library','Exercises'],['progress','Progress']].map(([id,label])=>`<button class="nav-button ${view===id?'active':''}" data-view="${id}" ${view===id?'aria-current="page"':''}>${icon(id)}<span>${label}</span></button>`).join('')}</nav><div class="header-tools"><span id="theme-control">${themeButton()}</span><button class="icon-button" data-action="settings" aria-label="Settings" title="Settings">${icon('settings')}</button><button class="icon-button" data-action="help" aria-label="How it works" title="How it works">${icon('help')}</button></div></header><main class="main"><div id="page"></div><footer class="bottom-line"><span>${icon('shield')} Your sound stays on your device.</span><button class="text-button" data-action="help">How it works</button></footer></main></div><div id="modal-root"></div><div class="hit-announcer" role="status" aria-live="polite" id="hit-announcer"></div>`;}
function heading(eyebrow,title,subtitle,actions=''){return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div>${actions}</div>`;}
function errorBanner(){return error?`<div class="error-banner" role="alert"><span>${esc(error)}</span><button data-action="dismiss-error" aria-label="Dismiss error">${icon('close')}</button></div>`:'';}
function demoBanner(){
  if(!demo)return '';
  return `<div class="error-banner demo-banner"><div><strong>Demo mode.</strong> Simulated input, separate from your real progress.</div><div class="demo-controls"><label class="sr-only" for="demo-pitch">Simulated pitch</label><select id="demo-pitch">${[[0,'Target pitch'],[12,'One octave higher'],[-12,'One octave lower'],[1,'One semitone higher'],[-1,'One semitone lower'],[.35,'Slightly sharp'],[-.35,'Slightly flat']].map(([value,label])=>`<option value="${value}" ${demoOffset===value?'selected':''}>${label}</option>`).join('')}</select><button class="demo-next" data-action="demo-note">Show pitch</button><button class="demo-next" data-action="exit-demo">Exit demo</button></div></div>`;
}
function setupBar(){return `<div class="setup-bar"><div class="field-inline"><label for="exercise-select">Let’s play</label><select id="exercise-select" ${activeSession()?'disabled':''}>${EXERCISES.map(e=>`<option value="${e.id}" ${exerciseId===e.id?'selected':''}>${esc(e.title)}</option>`).join('')}</select></div><button class="practice-options" data-action="settings" aria-label="Practice settings">${instrument().name} <span>·</span> ${settings.duration/60} min ${icon('settings')}</button></div>`;}
function customPicker(){if(exerciseId!=='custom')return '';const strings=instrument().strings;const midis=[...new Set(strings.flatMap(s=>Array.from({length:settings.instrument==='cello'?7:8},(_,n)=>s.midi+n)))];return `<div class="custom-picker"><span class="chip">Your target note</span>${midis.map(m=>`<button class="note-choice ${m===customMidi?'active':''}" data-midi="${m}" ${activeSession()?'disabled':''}>${esc(noteName(m))}</button>`).join('')}</div>`;}
function visiblePlayedNote(){
  return performance.now()-lastFrameAt<=400&&!audio.isPlayingTone?lastNote:null;
}
function staffMarkup(detectedNote=visiblePlayedNote()){
  const seq=session?.sequence??sequence(),ix=session?.index??0;
  const compact=window.matchMedia('(max-width:740px)').matches;
  const start=Math.max(0,ix-1),notes=[];
  for(let i=0;i<(compact?3:6);i++)notes.push(seq[(start+i)%seq.length]);
  return renderStaff({notes,activeIndex:ix-start,instrument:settings.instrument,completed:Array.from({length:Math.max(0,ix-start)},(_,i)=>i),compact,detectedNote,tolerance:settings.tolerance});
}
function updateStaff(note,force=false){
  if(view!=='practice')return;
  const el=document.querySelector('#staff');
  if(!el)return;
  const key=`${session?.index??0}:${currentTarget()}:${settings.instrument}:${note?.midi??'silent'}:${note?Math.round(note.cents/3):0}:${window.matchMedia('(max-width:740px)').matches}`;
  if(!force&&key===staffPitchKey)return;
  const now=performance.now();
  if(!force&&note&&now-lastStaffDrawAt<70)return;
  el.innerHTML=staffMarkup(note);staffPitchKey=key;lastStaffDrawAt=now;
}
function practiceView(){
  const target=currentTarget(),snap=session?.snapshot(performance.now());
  const result=snap?.finished?`<div class="session-finished"><div><h3>${demo?'Demo complete':'Every note is progress.'}</h3><p>${snap.hits} notes played · ${Math.round(snap.npm)} notes/min${!demo?(storageWarning?' · Kept for this visit':' · Saved on this device'):''}</p></div><button class="small-button" data-action="new-session">Practice again ${icon('arrow')}</button></div>`:'';
  return `<div class="page-heading practice-heading"><div><h1>One note at a time.</h1><p>Play the amber note. See your sound on the staff.</p></div><div id="mic-status">${status()}</div></div>${errorBanner()}${demoBanner()}${result}${setupBar()}${customPicker()}
  <section class="card score-card" aria-label="Live pitch and upcoming notes">
    <div class="target-panel target-summary" id="target-panel"><div class="target-copy"><div class="target-display" id="target-note">${noteHTML(target)}</div><div><div class="target-description" id="target-description">${esc(description(target))}</div><p class="target-hint" id="target-hint">Play steadily and hold. We’ll move on when you’re in tune.</p></div></div><div class="target-tools"><button class="hear-note" data-action="hear">${icon('volume')} Hear note</button><div class="target-hold" role="progressbar" aria-label="Steady note hold" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="hold-fill"></span></div></div></div>
    <div class="score-viewport" id="staff">${staffMarkup()}</div><div class="score-footer"><div class="legend"><span><i class="amber"></i> Note to play</span><span><i class="teal"></i> Your sound</span></div><span>Bring your sound to the amber note</span></div>
    <div class="staff-feedback"><div class="staff-reading"><span class="staff-reading-label">${icon('mic')} You</span><span class="live-note">--</span>${settings.details?'<span class="live-hz detailed-reading">waiting for sound</span>':''}</div><p class="pitch-message">Press Start practice when you’re ready</p></div>
  </section>
  <div class="session-strip"><div class="session-stats"><div class="stat"><div class="stat-label">Time left</div><div class="stat-value" id="time-value">${timeString(snap?.remaining??settings.duration)}</div></div><div class="stat"><div class="stat-label">Notes played</div><div class="stat-value" id="hits-value">${snap?.hits??0}</div></div><div class="stat"><div class="stat-label">Notes / min</div><div class="stat-value" id="npm-value">${Math.round(snap?.npm??0)}</div></div>${settings.details?`<div class="stat detailed-reading"><div class="stat-label">Streak</div><div class="stat-value" id="streak-value">${snap?.streak??0} <small>notes</small></div></div>`:''}</div><div class="session-actions">${activeSession()?`<button class="icon-button" data-action="stop" aria-label="Finish session" title="Finish session">${icon('stop')}</button>`:''}<button class="primary" data-action="start" ${micBusy?'disabled':''}>${icon(session?.state==='running'?'pause':'play')} ${micBusy?'Connecting…':session?.state==='running'?'Pause practice':session?.state==='paused'?'Resume practice':'Start practice'}</button></div></div><div class="practice-progress" role="progressbar" aria-label="Session elapsed" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="session-progress"></span></div>
  <details class="card note-guide" open><summary><span>${icon('violin')} Where to put your fingers</span><span class="guide-summary">Fingerboard guide</span></summary><div class="fingerboard-wrap" id="fingerboard">${renderFingerboard({instrument:settings.instrument,targetMidi:target,detectedMidi:null,showLabels:settings.labels})}</div><div class="fingerboard-footer"><span id="finger-description">${esc(description(target))}</span><span>0 means an open string</span></div></details>
  <div class="practice-bottom"><span class="keyboard-hint"><kbd>Space</kbd> start / pause <span>·</span> <kbd>H</kbd> hear note</span><button class="text-button" data-action="${demo?'exit-demo':'demo'}">${demo?'Return to real practice':'Try without a microphone'}</button></div>`;
}
function tunerView(){return `${heading('','Tune your strings.','One open string at a time. Aim for the center.')}${errorBanner()}<div class="tuner-layout"><section class="card tuner-main"><div class="eyebrow">Chromatic tuner</div><div class="live-note">--</div><span class="live-hz">Waiting for your instrument</span>${meter()}<p class="pitch-message">${audio.isRunning?'Play one open string with a steady bow.':'Enable your microphone when you’re ready.'}</p><canvas class="waveform" aria-label="Live microphone waveform"></canvas><button class="primary" data-action="mic" ${micBusy?'disabled':''}>${icon('mic')} ${micBusy?'Connecting…':audio.isRunning?'Disconnect microphone':'Enable microphone'}</button><div class="tuning-strings">${instrument().strings.map((s,i)=>`<button class="string-button ${selectedString===i?'active':''}" data-string="${i}" title="Play ${esc(s.name)} reference tone">${esc(s.name)}<span>${midiToFrequency(s.midi,settings.a4).toFixed(1)} Hz</span></button>`).join('')}</div><p style="font-size:10px;color:var(--muted);margin-top:15px">Tap a string to hear its reference pitch.</p></section><aside class="card tuner-guide"><h3>Find a clear sound.</h3><div class="help-step"><b>1</b><div><h3>Start with A</h3><p>Tune your A string first, then D, G${settings.instrument==='violin'?', and E':', and C'}.</p></div></div><div class="help-step"><b>2</b><div><h3>Watch the needle</h3><p>Left is flat. Right is sharp. Aim for the center while holding a steady note.</p></div></div><div class="help-step"><b>3</b><div><h3>Make small adjustments</h3><p>Use your fine tuners gently. Release the bow between adjustments.</p></div></div><div class="help-note">The tuner is chromatic, so it listens to any note you play. Reference tones pause listening feedback briefly to avoid hearing themselves.</div></aside></div><section class="card fingerboard-card"><div class="card-heading"><span class="card-title">${icon('violin')} Your ${instrument().name.toLowerCase()} fingerboard</span><span class="tiny-label">LIVE PITCH</span></div><div class="fingerboard-wrap" id="fingerboard">${renderFingerboard({instrument:settings.instrument,targetMidi:instrument().strings[selectedString??(settings.instrument==='violin'?2:3)].midi,detectedMidi:lastNote?.midi,showLabels:settings.labels})}</div></section>`;}
function libraryView(){return `${heading('','Find your next exercise.','Start with open strings, then try a simple scale.')}<div class="exercise-grid">${EXERCISES.map((e,i)=>`<article class="card exercise-card"><div class="exercise-symbol">${['♮','♯','♬','𝄞','♫','♪','♩','♭'][i%8]}</div><h3>${esc(e.title)}</h3><p>${esc(e.description)}</p><div class="card-bottom"><span class="chip">${esc(e.level||'First position')}</span><button class="small-button" data-exercise="${e.id}">Practice ${icon('arrow')}</button></div></article>`).join('')}</div><div class="help-note" style="margin-top:22px">Exercises follow pitch, at your pace. Staff notes show the sequence, not a rhythm score. Repeat notes need a brief break in sound. Your microphone measures pitch; it cannot verify which string or finger you use.</div>`;}
function progressView(){const sessions=history.filter(s=>s.instrument===settings.instrument);const total=sessions.reduce((v,s)=>v+s.hits,0),seconds=sessions.reduce((v,s)=>v+s.elapsed,0),best=Math.max(0,...sessions.map(s=>s.npm));const actions=sessions.length?`<div class="progress-actions"><button class="small-button" data-action="export">${icon('download')} Export</button><button class="icon-button" data-action="clear-history" title="Clear practice history" aria-label="Clear practice history">${icon('reset')}</button></div>`:'';return `${heading('','Your progress.','A little practice adds up. Saved on this device.',actions)}${!sessions.length?`<div class="card empty-state">${icon('leaf')}<h2>Your first note starts here.</h2><p>Complete a practice session to see your progress.<br>A few focused minutes are a lovely place to start.</p><button class="primary" data-view="practice">${icon('play')} Start practicing</button></div>`:`<div class="summary-stats">${[['Sessions',sessions.length,''],['Notes played',total,''],['Practice time',Math.round(seconds/60),'min'],['Best pace',Math.round(best),'notes/min']].map(([label,value,unit])=>`<div class="card"><div class="stat-label">${label}</div><div class="stat-value">${value} <small>${unit}</small></div></div>`).join('')}</div><section class="card progress-chart"><div class="card-title">A little more fluent, one session at a time.</div><div class="chart-bars">${sessions.slice(-12).map(s=>`<div class="chart-column"><span>${Math.round(s.npm)}</span><div class="chart-bar" style="height:${Math.max(2,s.npm/Math.max(1,best)*100)}px" title="${Math.round(s.npm)} notes per minute"></div></div>`).join('')}</div><p class="chart-caption">Notes per minute · Your last ${Math.min(sessions.length,12)} sessions, oldest to newest</p></section><h2 class="section-title">Recent practice</h2><div class="card history-scroll"><table class="history-table"><thead><tr><th>Exercise</th><th>When</th><th>Time</th><th>Notes/min</th><th>On target</th></tr></thead><tbody>${sessions.slice().reverse().map(s=>`<tr><td>${esc(EXERCISES.find(e=>e.id===s.exercise)?.title||'Practice')}</td><td>${esc(new Date(s.date).toLocaleDateString(undefined,{month:'short',day:'numeric'}))}</td><td>${timeString(s.elapsed)}</td><td>${Math.round(s.npm)}</td><td>${s.accuracy===null?'--':Math.round(s.accuracy)+'%'}</td></tr>`).join('')}</tbody></table></div><p class="chart-caption">On target is the share of confidently detected playing time that matches the requested note and tolerance. It does not grade rhythm or technique.</p>`}`;}
function render(){app.innerHTML=shell();document.querySelector('#page').innerHTML=({practice:practiceView,tuner:tunerView,library:libraryView,progress:progressView})[view]();if(modal)renderModal();detectedBoardMidi=undefined;staffPitchKey=null;lastStaffDrawAt=-Infinity;updateLive();updateStats();}
function refreshPractice(){if(view==='practice')render();}
function updateBoard(effectiveNote=lastNote){const el=document.querySelector('#fingerboard');if(!el)return;el.innerHTML=renderFingerboard({instrument:settings.instrument,targetMidi:view==='tuner'?instrument().strings[selectedString??(settings.instrument==='violin'?2:3)].midi:currentTarget(),detectedMidi:effectiveNote?.midi??null,showLabels:settings.labels});}
function updateTarget(){if(view!=='practice')return;const target=currentTarget();document.querySelector('#target-note').innerHTML=noteHTML(target);document.querySelector('#target-description').textContent=description(target);document.querySelector('#finger-description').textContent=description(target);updateStaff(visiblePlayedNote(),true);updateBoard();const panel=document.querySelector('#target-panel');panel.classList.remove('flash');void panel.offsetWidth;panel.classList.add('flash');document.querySelector('#hit-announcer').textContent=`Good note. Next, ${noteName(target)}.`;}
function updateStats(){if(view!=='practice'||!session)return;const snap=session.snapshot(performance.now());const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};set('time-value',timeString(snap.remaining));set('hits-value',snap.hits);set('npm-value',Math.round(snap.npm));const streak=document.getElementById('streak-value');if(streak)streak.innerHTML=`${snap.streak} <small>notes</small>`;const hold=document.getElementById('hold-fill');if(hold){hold.style.width=`${snap.holdProgress*100}%`;hold.parentElement.setAttribute('aria-valuenow',Math.round(snap.holdProgress*100));}const progress=document.getElementById('session-progress');if(progress){progress.style.width=`${snap.progress*100}%`;progress.parentElement.setAttribute('aria-valuenow',Math.round(snap.progress*100));}const hint=document.getElementById('target-hint');if(hint)hint.innerHTML=snap.state==='paused'?'Take a breath. Resume when you’re ready.':snap.releaseRequired?'Lift the bow briefly. Then play the note again.':snap.state==='finished'?'Session complete. Every note is progress.':'Play steadily and hold. We’ll move on when you’re in tune.';if(snap.finished&&!finishShown)finishSession(snap);}
function finishSession(snap){finishShown=true;silenceMetronome();if(!sessionSaved&&!demo&&snap.elapsed>0){sessionSaved=true;history.push({date:new Date().toISOString(),instrument:settings.instrument,exercise:exerciseId,elapsed:snap.elapsed,hits:snap.hits,npm:snap.npm,accuracy:snap.accuracy,bestStreak:snap.bestStreak,a4:settings.a4,tolerance:settings.tolerance,holdMs:settings.holdMs,results:snap.results});history=history.slice(-200);persist();}refreshPractice();}
function updateLive(){
  const note=visiblePlayedNote(),cents=note?.cents??0;
  document.querySelectorAll('.live-note').forEach(e=>e.textContent=note?noteName(note.midi):'--');
  document.querySelectorAll('.live-hz').forEach(e=>e.textContent=note?`${note.frequency.toFixed(1)} Hz`:audio.isPlayingTone?'Reference tone':audio.isRunning?'Listening…':demo?'Simulated input':'waiting for sound');
  document.querySelectorAll('.meter-needle').forEach(e=>{e.style.left=`${50+clamp(cents,-50,50)}%`;e.style.opacity=note?'1':'.25';e.style.background=feedbackPalette[Math.abs(cents)<=settings.tolerance?'pitch-good':'pitch-adjust'];});
  let message=view==='practice'?'Press Start practice when you’re ready':'Enable your microphone to begin';
  let onTarget=false;
  if(audio.isPlayingTone)message='Listening resumes after the reference tone';
  else if(note&&view==='practice'){
    const difference=(note.midi-currentTarget())*100+cents;
    onTarget=Math.abs(difference)<=settings.tolerance;
    message=onTarget?'That’s it. Hold your note.':`${difference>0?'↓ Lower your pitch':'↑ Raise your pitch'} · aim for ${noteName(currentTarget())}`;
    if(settings.details)message+=` · ${Math.round(Math.abs(difference))} cents ${difference>=0?'high':'low'}`;
  }else if(note){
    message=Math.abs(cents)<=settings.tolerance?`In tune · ${Math.round(cents)>0?'+':''}${Math.round(cents)} cents`:`${cents<0?'A little flat':'A little sharp'} · ${Math.round(cents)>0?'+':''}${Math.round(cents)} cents`;
  }else if(audio.isRunning||demo)message=lastRms>settings.threshold?'Find one clear, steady note':'Play a note to see it on the staff';
  document.querySelectorAll('.pitch-message').forEach(e=>e.textContent=message);
  document.querySelector('.staff-feedback')?.classList.toggle('on-target',onTarget);
  document.querySelector('#target-panel')?.classList.toggle('match',onTarget);
  if(detectedBoardMidi!==(note?.midi??null)){detectedBoardMidi=note?.midi??null;updateBoard(note);}
  updateStaff(note);
  drawWaveforms(note);
}
function drawWaveforms(note){document.querySelectorAll('.waveform').forEach(canvas=>{const box=canvas.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,2);const w=Math.round(box.width*ratio),h=Math.round(box.height*ratio);if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,w,h);ctx.strokeStyle=feedbackPalette[note?'wave-active':'wave-idle'];ctx.lineWidth=ratio;ctx.beginPath();const wave=lastWaveform;for(let x=0;x<=w;x+=2){const v=wave&&performance.now()-lastFrameAt<400?wave[Math.floor(x/w*Math.min(wave.length-1,1024))]||0:0;const y=h/2+clamp(v*2.5,-1,1)*h*.4;if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();});}
function processFrame(frame){lastFrameAt=performance.now();lastRms=frame.rms||0;lastWaveform=frame.waveform;lastNote=frame.frequency&&!audio.isPlayingTone?frequencyToNote(frame.frequency,settings.a4):null;if(session?.state==='running'){const snap=session.update(lastNote&&!audio.isPlayingTone?{...lastNote,confidence:frame.confidence}:{midi:null,cents:null},lastFrameAt);if(snap.hit)updateTarget();if(snap.finished&&!finishShown)finishSession(snap);}updateLive();updateStats();}
function microphoneError(err){const messages={NotAllowedError:'Microphone access was blocked. Allow microphone access in your browser’s site settings, then try again.',PermissionDeniedError:'Microphone access was blocked. Allow it in your browser’s site settings and retry.',NotFoundError:'No microphone was found. Connect one, then try again.',DevicesNotFoundError:'No microphone was found. Connect one, then try again.',NotReadableError:'The microphone is busy or unavailable. Check your system microphone permission and close other apps using it.',OverconstrainedError:'That microphone is unavailable. Select the default input in Settings.',SecurityError:'Microphone access needs HTTPS or localhost. Open the app on a secure address.'};return messages[err?.name]||err?.message||'Could not start the microphone. Check your input device and browser permission.';}
async function connectMic(){if(audio.isRunning)return true;if(micBusy)return false;if(!navigator.mediaDevices?.getUserMedia){error='Microphone access needs HTTPS or localhost and a browser that supports audio input.';render();return false;}demo=false;const generation=++micGeneration;micBusy=true;error='';render();try{await audio.start({deviceId:settings.deviceId||undefined,onFrame:processFrame,onError:err=>{++micGeneration;micBusy=false;if(session?.state==='running')session.pause(performance.now());audio.stop();metronome=false;error=microphoneError(err);render();}});if(generation!==micGeneration)return false;try{devices=await audio.listDevices();}catch{devices=[];}return generation===micGeneration&&audio.isRunning;}catch(err){if(generation===micGeneration)error=microphoneError(err);return false;}finally{if(generation===micGeneration){micBusy=false;render();}}}
function disconnectMic(){++micGeneration;micBusy=false;if(session?.state==='running')session.pause(performance.now());audio.stop();metronome=false;lastNote=null;lastWaveform=null;lastRms=0;render();}
async function startPractice(){if(session?.state==='running'){session.pause(performance.now());silenceMetronome();render();return;}if(!demo&&!await connectMic())return;if(view!=='practice'||document.hidden||modal)return;if(session?.state==='paused'){session.resume(performance.now());}else{session=new PracticeSession({sequence:sequence(),duration:settings.duration,tolerance:settings.tolerance,holdMs:settings.holdMs});session.start(performance.now());sessionSaved=false;finishShown=false;}if(settings.beatEnabled&&!metronome)await toggleMetronome();render();}
function stopPractice(){if(!activeSession())return;const snap=session.stop(performance.now());finishSession(snap);}
function navigate(next){if(!['practice','tuner','library','progress'].includes(next))return;if(next!==view){silenceMetronome();}if(next!==view&&session?.state==='running'){session.pause(performance.now());silenceMetronome();}if(next!=='practice'&&demo)exitDemo(false);view=next;error='';render();window.scrollTo({top:0,behavior:'instant'});}
function resetPractice(){session=null;finishShown=false;sessionSaved=false;lastNote=null;render();}
async function hearNote(midi=currentTarget()){if(session?.state==='running'){session.pause(performance.now());silenceMetronome();render();toast('Practice paused for the reference tone. Resume when you’re ready.');}try{await audio.playTone(midiToFrequency(midi,settings.a4),1.3);}catch{toast('Audio playback is unavailable. Check browser audio settings.');}}
function startDemo(){if(activeSession())stopPractice();disconnectMic();demo=true;session=null;finishShown=false;error='';view='practice';render();toast('Demo enabled. Choose a pitch and press Show pitch to see it on the staff.');}
function exitDemo(redraw=true){clearInterval(demoTimer);demoTimer=null;demoUntil=0;demo=false;session=null;finishShown=false;lastNote=null;lastWaveform=null;if(redraw)render();}
function playDemo(){
  if(!demo)return;
  clearInterval(demoTimer);
  const target=currentTarget()+demoOffset;
  const releaseUntil=performance.now()+250;
  demoUntil=releaseUntil+(demoOffset===0&&session?.state==='running'?settings.holdMs+160:6000);
  demoTimer=setInterval(()=>{
    const now=performance.now();
    if(!demo||now>=demoUntil){clearInterval(demoTimer);demoTimer=null;lastNote=null;lastRms=0;updateLive();return;}
    const playing=now>=releaseUntil,wave=new Float32Array(1024);
    if(playing)for(let i=0;i<wave.length;i++)wave[i]=Math.sin(i*.06)*.1;
    processFrame({frequency:playing?midiToFrequency(target,settings.a4):null,confidence:1,rms:playing?.08:0,waveform:wave});
  },33);
}
async function toggleMetronome(){const generation=micGeneration,request=++metronomeRequest;try{if(metronome){silenceMetronome();}else{await audio.startMetronome(settings.bpm);if(generation!==micGeneration||request!==metronomeRequest){audio.stopMetronome();return;}metronome=true;toast('Use headphones so the microphone hears your instrument clearly.');}render();}catch{toast('Could not start the metronome. Check audio permissions.');}}
function showModal(type){modalOrigin=document.activeElement;modal=type;if(session?.state==='running'){session.pause(performance.now());silenceMetronome();render();}else renderModal();setTimeout(()=>document.querySelector('.modal button, .modal select')?.focus(),0);}
function closeModal(){modal=null;document.querySelector('#modal-root').innerHTML='';document.querySelector('.shell').inert=false;if(modalOrigin?.isConnected)modalOrigin.focus();else document.querySelector('[data-action="start"], [data-action="settings"]')?.focus();}
function settingsForm(){
  const options=(items,current)=>items.map(([value,label])=>`<option value="${value}" ${current===value?'selected':''}>${label}</option>`).join('');
  const row=(id,label,help,control)=>`<div class="form-row"><div><label for="setting-${id}">${label}</label><p>${help}</p></div>${control}</div>`;
  const select=(id,items,current)=>`<select id="setting-${id}">${options(items,current)}</select>`;
  const toggle=(id,checked)=>`<input class="setting-toggle" id="setting-${id}" type="checkbox" ${checked?'checked':''}>`;
  return `<p class="settings-intro">The defaults are ready for your first note. Adjust these whenever you like.</p>
    <section class="settings-section"><h3>Your practice</h3>
      ${row('instrument','Instrument','Choose the instrument you’re playing.',select('instrument',Object.entries(INSTRUMENTS).map(([id,i])=>[id,i.name]),settings.instrument))}
      ${row('duration','Session length','A short session is a good place to start.',select('duration',[[60,'1 minute'],[120,'2 minutes'],[300,'5 minutes']],settings.duration))}
      ${row('theme','Appearance','Use a light, dark, or device-matched theme.',select('theme',[['system','Use device setting'],['light','Light'],['dark','Dark']],getTheme()))}
      ${row('labels','Finger labels','Show suggested finger positions on the guide.',toggle('labels',settings.labels))}
    </section>
    <section class="settings-section"><h3>A steady beat</h3>
      ${row('metronome','Metronome','Play a gentle click during practice. Headphones help.',toggle('metronome',settings.beatEnabled))}
      ${row('bpm','Tempo','Beats per minute. Try 60 to begin.',`<input id="setting-bpm" type="number" min="30" max="180" value="${settings.bpm}">`)}
    </section>
    <details class="settings-advanced"><summary>Fine-tune listening <span>Optional</span></summary>
      ${row('tolerance','How close is close enough?','A relaxed range gives you more room while learning.',select('tolerance',[[40,'Relaxed · ±40¢'],[25,'Balanced · ±25¢'],[15,'Precise · ±15¢']],settings.tolerance))}
      ${row('hold','How long to hold a note','Keep the pitch steady for this long to move on.',select('hold',[[250,'Quick · 0.25s'],[350,'Normal · 0.35s'],[600,'Steady · 0.6s']],settings.holdMs))}
      ${row('threshold','Ignore background noise','Raise this if room noise registers as notes. Lower it for a quiet microphone.',`<input id="setting-threshold" type="range" min="2" max="40" step="1" value="${Math.round(settings.threshold*1000)}">`)}
      ${row('a4','Reference pitch (Hz)','Standard tuning is A4 = 440 Hz.',`<input id="setting-a4" type="number" min="430" max="450" step="1" value="${settings.a4}">`)}
      ${row('device','Microphone input','Connect the microphone to see available inputs.',`<select id="setting-device"><option value="">System default</option>${devices.filter(d=>d.kind==='audioinput'&&d.deviceId!=='default').map((d,i)=>`<option value="${esc(d.deviceId)}" ${settings.deviceId===d.deviceId?'selected':''}>${esc(d.label||`Microphone ${i+1}`)}</option>`).join('')}${settings.deviceId&&!devices.some(d=>d.deviceId===settings.deviceId)?`<option value="${esc(settings.deviceId)}" selected>Saved microphone</option>`:''}</select>`)}
      ${row('details','Detailed feedback','Show frequency, pitch difference in cents, and your streak.',toggle('details',settings.details))}
    </details>
    <p class="settings-footnote">Changing instrument, session length, or note matching starts a new session. Completed practice stays saved.</p><div class="modal-footer"><button class="primary" data-action="save-settings">Save settings ${icon('check')}</button></div>`;
}
function renderModal(){const root=document.querySelector('#modal-root');if(!root)return;document.querySelector('.shell').inert=true;let body='',title='';if(modal==='settings'){title='Make it yours.';body=settingsForm();}else if(modal==='help'){title='Meet your practice partner.';body=`<div class="help-step"><b>1</b><div><h3>Get in tune</h3><p>Visit the Tuner and allow microphone access. Play each open string with a slow, steady bow.</p></div></div><div class="help-step"><b>2</b><div><h3>Pick a small challenge</h3><p>Start with open strings, then try a scale. The amber staff note is your target. A faded note shows what you are playing, with ledger lines for higher and lower notes. The fingerboard suggests where to find the target.</p></div></div><div class="help-step"><b>3</b><div><h3>Play, hold, and move on</h3><p>Press Start practice. Match the highlighted note and hold it steadily. The next note appears automatically. For repeated notes, lift the bow for a brief silence.</p></div></div><div class="help-note">This is a pitch practice tool. It does not score rhythm, bowing, posture, or finger choice. Notation shows note order with equal note values. Suggested positions are guides, not physical frets. Audio is analyzed locally and never recorded or uploaded.</div><div class="modal-footer"><button class="primary" data-action="close-modal">Let’s play ${icon('arrow')}</button></div>`;}else if(modal==='clear-history'){title='Clear practice history?';body=`<p class="dialog-copy">This removes all saved sessions for every instrument from this browser. Export them first if you’d like to keep a copy.</p><div class="modal-footer" style="gap:9px"><button class="secondary" data-action="close-modal">Keep history</button><button class="primary" data-action="confirm-clear">Clear history</button></div>`;}root.innerHTML=`<div class="modal-backdrop" data-action="backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-heading"><h2 id="modal-title">${title}</h2><button class="icon-button" data-action="close-modal" aria-label="Close dialog">${icon('close')}</button></div>${body}</section></div>`;}
async function saveSettings(){
  const old={...settings};
  const value=id=>document.getElementById(`setting-${id}`).value;
  const a4=Number(value('a4')),bpm=Number(value('bpm'));
  if(!Number.isFinite(a4)||a4<430||a4>450){document.querySelector('.settings-advanced').open=true;document.querySelector('#setting-a4').focus();toast('Choose a reference pitch between 430 and 450 Hz.');return;}
  if(!Number.isFinite(bpm)||bpm<30||bpm>180){document.querySelector('#setting-bpm').focus();toast('Choose a tempo between 30 and 180 beats per minute.');return;}
  const next={a4,bpm,instrument:value('instrument'),duration:Number(value('duration')),tolerance:Number(value('tolerance')),holdMs:Number(value('hold')),threshold:Number(value('threshold'))/1000,deviceId:value('device'),labels:document.querySelector('#setting-labels').checked,details:document.querySelector('#setting-details').checked,beatEnabled:document.querySelector('#setting-metronome').checked};
  const changed=['a4','tolerance','holdMs','instrument','duration'].some(key=>old[key]!==next[key]);
  const reconnect=old.deviceId!==next.deviceId&&(audio.isRunning||micBusy);
  const theme=value('theme');
  closeModal();
  if(changed){if(activeSession())stopPractice();session=null;finishShown=false;}
  if(reconnect)disconnectMic();
  Object.assign(settings,next);
  if(old.instrument!==next.instrument){customMidi=instrument().strings[2].midi;selectedString=null;}
  setTheme(theme);audio.setThreshold(settings.threshold);persist();
  if(reconnect)await connectMic();
  render();toast('Settings saved.');
}
function exportHistory(){const blob=new Blob([JSON.stringify({app:'Arco',version:1,exportedAt:new Date().toISOString(),sessions:history},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`arco-practice-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

app.addEventListener('click',async event=>{const button=event.target.closest('button,a');if(!button||button.disabled)return;if(button.dataset.view){event.preventDefault();navigate(button.dataset.view);return;}if(button.dataset.exercise){if(activeSession())stopPractice();exerciseId=button.dataset.exercise;session=null;finishShown=false;view='practice';render();return;}if(button.dataset.midi){customMidi=Number(button.dataset.midi);resetPractice();return;}if(button.dataset.string){selectedString=Number(button.dataset.string);render();await hearNote(instrument().strings[selectedString].midi);return;}const action=button.dataset.action;if(!action)return;switch(action){case 'start':await startPractice();break;case 'stop':stopPractice();break;case 'mic':if(audio.isRunning||micBusy)disconnectMic();else{if(demo)exitDemo(false);await connectMic();}break;case 'hear':await hearNote();break;case 'metronome':await toggleMetronome();break;case 'theme':setTheme(resolvedTheme()==='dark'?'light':'dark');break;case 'settings':showModal('settings');break;case 'help':showModal('help');break;case 'close-modal':closeModal();break;case 'save-settings':await saveSettings();break;case 'dismiss-error':error='';render();break;case 'new-session':resetPractice();break;case 'demo':startDemo();break;case 'exit-demo':exitDemo();break;case 'demo-note':playDemo();break;case 'export':exportHistory();break;case 'clear-history':showModal('clear-history');break;case 'confirm-clear':history=[];persist();closeModal();render();toast('Practice history cleared.');break;}});
app.addEventListener('click',event=>{if(event.target.classList.contains('modal-backdrop'))closeModal();});
app.addEventListener('change',async event=>{const el=event.target;switch(el.id){case 'demo-pitch':demoOffset=Number(el.value);if(demoTimer)playDemo();break;case 'instrument-select':if(activeSession())stopPractice();settings.instrument=el.value;customMidi=instrument().strings[2].midi;selectedString=null;session=null;finishShown=false;persist();render();break;case 'exercise-select':exerciseId=el.value;session=null;finishShown=false;render();break;case 'duration-select':settings.duration=Number(el.value);persist();resetPractice();break;case 'difficulty-select':settings.tolerance=Number(el.value);persist();resetPractice();break;case 'labels-toggle':settings.labels=el.checked;persist();updateBoard();break;case 'bpm':settings.bpm=clamp(Number(el.value)||60,30,180);el.value=settings.bpm;persist();if(metronome)await audio.startMetronome(settings.bpm);break;}});
document.addEventListener('keydown',event=>{if(modal){if(event.key==='Escape'){closeModal();return;}if(event.key==='Tab'){const elements=[...document.querySelectorAll('.modal button,.modal input,.modal select,.modal summary')].filter(e=>!e.disabled&&e.getClientRects().length);const first=elements[0],last=elements.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}return;}if(['INPUT','SELECT','TEXTAREA','BUTTON','A','SUMMARY'].includes(event.target.tagName))return;if(event.code==='Space'&&view==='practice'){event.preventDefault();startPractice();}if(event.key.toLowerCase()==='h'&&view==='practice'){event.preventDefault();hearNote();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(session?.state==='running')session.pause(performance.now());silenceMetronome();render();}});
window.addEventListener('pagehide',()=>{audio.stop();clearInterval(demoTimer);});
window.addEventListener('resize',()=>{updateStaff(visiblePlayedNote(),true);drawWaveforms(lastNote);});
window.addEventListener('arco-theme-change',()=>{refreshFeedbackPalette();const button=document.querySelector('.theme-toggle');if(!button)return;const dark=resolvedTheme()==='dark',label=`Switch to ${dark?'light':'dark'} mode`;button.setAttribute('aria-label',label);button.title=label;button.innerHTML=icon(dark?'sun':'moon');});
window.addEventListener('hashchange',()=>{if(location.hash==='#practice')navigate('practice');});
setInterval(()=>{updateStats();if(performance.now()-lastFrameAt>400)updateLive();},100);
render();

import {INSTRUMENTS,getFingering,noteName} from './music.js';
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderFingerboard({instrument='violin',targetMidi=69,detectedMidi=null,showLabels=true,preferredString=null}={}){
 const info=INSTRUMENTS[instrument]||INSTRUMENTS.violin,target=getFingering(targetMidi,instrument,preferredString),detected=getFingering(detectedMidi,instrument,target?.stringIndex);
 const nut=185,end=850,scale=1270;
 const xFor=s=>nut+scale*(1-2**(-s/12));
 const ys=[190,148,106,64];
 const title=`${info.name} fingerboard. ${target?`${noteName(targetMidi)}, ${target.stringName} string, ${target.position}`:'Select a note'}. Finger positions are a guide; listen for accurate pitch.`;
 const dots=[];
 for(let s=1;s<=7;s++){if(instrument==='cello'&&s>6)continue;dots.push(`<circle cx="${xFor(s)}" cy="222" r="2" fill="#b8b9af"/>${showLabels?`<text x="${xFor(s)}" y="244" text-anchor="middle" fill="#72776e" font-size="14">${s===7?'4':instrument==='cello'?['','low 1','1','2','3','4','ext. 4'][s]:['','low 1','1','low 2','2','3','high 3','4'][s]}</text>`:''}`);}
 const strings=info.strings.map((s,i)=>{
  const y=ys[i],isTarget=target?.stringIndex===i;
  const isDetected=detected?.stringIndex===i;
  const targetX=target?.semitone===0?158:xFor(target?.semitone||0);
  return `<g><text x="18" y="${y+5}" font-size="15" fill="${isTarget?'#ab7028':'#5b645b'}" font-family="system-ui" font-weight="${isTarget?700:500}">${s.name}<tspan font-size="10" dy="3">${Math.floor(s.midi/12)-1}</tspan></text><circle cx="61" cy="${y}" r="${isTarget?15:12}" fill="${isTarget?'#f0dcb5':'#e6e6dc'}"/><text x="61" y="${y+4}" text-anchor="middle" font-size="10" font-family="system-ui" fill="#536054">${4-i}</text><path d="M115 ${y} L858 ${y}" stroke="#000" opacity=".45" stroke-width="${5-i*.65}" transform="translate(0 2)"/><path d="M115 ${y} L858 ${y}" stroke="#b9b8aa" stroke-width="${3.2-i*.6}"/>${isTarget?`<path d="M185 ${y} L850 ${y}" stroke="#e4b664" stroke-width="1.8" opacity=".8"/><circle cx="${targetX}" cy="${y}" r="22" fill="#d99a43" opacity=".16"/><circle cx="${targetX}" cy="${y}" r="15" fill="#e6b15f" stroke="#fae6bd" stroke-width="2"/><text x="${targetX}" y="${y+5}" font-family="system-ui" font-size="13" font-weight="700" text-anchor="middle" fill="#342618">${target.finger}</text>`:''}${isDetected&&detectedMidi!==targetMidi?`<circle cx="${detected.semitone===0?158:xFor(detected.semitone)}" cy="${y}" r="12" fill="#69aa96" stroke="#b6d8cb" stroke-width="2"/><text x="${detected.semitone===0?158:xFor(detected.semitone)}" y="${y+4}" text-anchor="middle" fill="#132d26" font-size="14">${detected.finger}</text>`:''}</g>`;
 }).join('');
 return `<svg class="fingerboard-svg" viewBox="0 0 900 264" role="img" aria-label="${safe(title)}" xmlns="http://www.w3.org/2000/svg"><title>${safe(title)}</title><defs><linearGradient id="arco-wood" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#ac7845"/><stop offset=".18" stop-color="#754723"/><stop offset=".48" stop-color="#ba8352"/><stop offset=".82" stop-color="#79502f"/><stop offset="1" stop-color="#51331c"/></linearGradient><linearGradient id="arco-ebony" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#41413a"/><stop offset=".16" stop-color="#242823"/><stop offset=".55" stop-color="#171b18"/><stop offset=".9" stop-color="#292d26"/><stop offset="1" stop-color="#414337"/></linearGradient><linearGradient id="arco-metal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e1dcc6"/><stop offset=".45" stop-color="#b3b5aa"/><stop offset=".55" stop-color="#fff7df"/><stop offset="1" stop-color="#82877b"/></linearGradient><filter id="arco-shadow" x="-10%" y="-20%" width="120%" height="150%"><feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#3c3e30" flood-opacity=".2"/></filter></defs><g filter="url(#arco-shadow)"><path d="M100 51 Q93 127 100 204 L856 224 Q880 125 856 29 Z" fill="url(#arco-wood)"/><path d="M102 61 Q107 127 102 194 L853 212" fill="none" stroke="#c79b66" opacity=".42" stroke-width="2"/><path d="M185 51 L853 34 Q866 127 853 219 L185 204 Z" fill="url(#arco-ebony)" stroke="#484a3f" stroke-width="1.3"/><path d="M196 59 L850 43 M194 197 L850 210" fill="none" stroke="#777c69" opacity=".2"/><path d="M182 50 L190 51 L190 205 L182 204 Z" fill="#c4bb9b"/><path d="M183 51 L186 51 L186 204 L183 204 Z" fill="#eee2ba"/><path d="M113 62 L171 60 L171 195 L113 192 Z" fill="#372a1c" stroke="#b28a5c" stroke-width="2"/><path d="M120 67 L162 65 L162 190 L120 188 Z" fill="#1c211b"/><path d="M115 86 H170 M115 166 H170" stroke="#746e58" stroke-width="5"/><ellipse cx="133" cy="39" rx="21" ry="9" fill="#383a2f"/><ellipse cx="157" cy="215" rx="21" ry="9" fill="#383a2f"/><path d="M132 42 V77 M157 180 V211" stroke="#4b4b3b" stroke-width="8"/></g>${strings}${dots.join('')}<text x="158" y="244" text-anchor="middle" fill="#72776e" font-family="system-ui" font-size="14">open</text></svg>`;
}
function diatonic(midi) {
  const name = noteName(midi), letter = name[0], octave = Math.floor(midi / 12) - 1;
  return octave * 7 + 'CDEFGAB'.indexOf(letter);
}

function ledgerLines(x, y, top, bottom, color, live = false) {
  const positions = [];
  for (let line = top - 14; line >= y; line -= 14) positions.push(line);
  for (let line = bottom + 14; line <= y; line += 14) positions.push(line);
  return positions.map(line => `<line ${live ? 'data-live-ledger' : 'data-ledger'} x1="${x - 16}" x2="${x + 16}" y1="${line}" y2="${line}" stroke="${color}" stroke-width="${live ? 1.5 : 1.2}"/>`).join('');
}

/**
 * The played pitch shares the active target's time position. Its true octave is
 * preserved, even outside the staff. Cents add a small continuous vertical offset
 * within a written note; accidentals continue to use normal diatonic placement.
 */
export function renderStaff({
  notes = [], activeIndex = 0, instrument = 'violin', completed = [],
  compact = false, detectedNote = null, tolerance = 25,
} = {}) {
  const info = INSTRUMENTS[instrument] || INSTRUMENTS.violin;
  const width = compact ? 460 : 820, top = 48, lineGap = 14, bottom = 104;
  const base = info.clef === 'bass' ? diatonic(43) : info.clef === 'alto' ? diatonic(53) : diatonic(64);
  const clef = info.clef === 'bass' ? '𝄢' : info.clef === 'alto' ? '𝄡' : '𝄞';
  const take = compact ? 3 : 6;
  const start = Math.max(0, Math.min(Math.max(0, activeIndex - 1), Math.max(0, notes.length - take)));
  const visible = notes.slice(start, start + take);
  const gap = compact ? 110 : 112, offset = compact ? 94 : 110;
  const xFor = index => offset + index * gap;
  const yFor = midi => bottom - (diatonic(midi) - base) * 7;
  const activeLocal = activeIndex - start;
  const targetMidi = notes[activeIndex];
  const hasTarget = Number.isInteger(targetMidi) && activeLocal >= 0 && activeLocal < visible.length;
  const targetX = xFor(activeLocal), targetY = hasTarget ? yFor(targetMidi) : null;
  const hasLive = hasTarget && Number.isInteger(detectedNote?.midi) && detectedNote.midi >= 0 && detectedNote.midi <= 127;
  const cents = hasLive && Number.isFinite(detectedNote.cents) ? Math.max(-50, Math.min(50, detectedNote.cents)) : 0;
  const liveMidi = hasLive ? detectedNote.midi : null;
  const delta = hasLive ? (liveMidi - targetMidi) * 100 + cents : 0;
  const inTune = hasLive && liveMidi === targetMidi && Math.abs(cents) <= tolerance;
  const liveX = targetX + (inTune ? 0 : 42);
  const liveWrittenY = hasLive ? yFor(liveMidi) : null;
  const liveY = hasLive ? liveWrittenY - cents * .055 : null;
  const liveDirection = inTune ? 'match' : delta > 0 ? 'lower' : 'raise';

  // Expand in staff-line increments so a tiny pitch fluctuation cannot resize
  // the view. Reserve space for stems and labels at both extreme registers.
  const pitches = visible.map(yFor);
  if (hasLive) pitches.push(liveWrittenY);
  const high = Math.min(top - 20, ...pitches.map(y => y >= top + 28 ? y - 38 : y - 14));
  const low = Math.max(bottom + 22, ...pitches.map(y => y >= top + 28 ? y + 14 : y + 38));
  const viewTop = Math.min(0, Math.floor((high - 14) / lineGap) * lineGap);
  const labelY = Math.max(160, Math.ceil((low + 20) / lineGap) * lineGap);
  const height = labelY + 20 - viewTop;
  const ribbon = hasTarget ? `<rect x="${targetX - 25}" y="${viewTop + 12}" width="87" height="${labelY - viewTop - 27}" rx="15" fill="#f5e9d2"/>` : '';
  const staff = Array.from({length: 5}, (_, i) => `<line x1="20" x2="${width - 22}" y1="${top + i * lineGap}" y2="${top + i * lineGap}" stroke="#c6cbbf" stroke-width="1"/>`).join('');
  const glyphs = visible.map((midi, j) => {
    const i = start + j, x = xFor(j), y = yFor(midi);
    const done = completed[i] === true || completed.includes(i) || i < activeIndex;
    const active = i === activeIndex;
    const color = active ? '#ac772f' : done ? '#729881' : '#3b483b';
    const up = y >= top + 28;
    return `<g aria-label="${safe(noteName(midi))}">${ledgerLines(x, y, top, bottom, color)}${noteName(midi).includes('♯') ? `<text x="${x - 26}" y="${y + 7}" fill="${color}" font-size="23" font-family="serif">♯</text>` : ''}<ellipse ${active ? 'data-target-head' : ''} cx="${x}" cy="${y}" rx="8.5" ry="5.8" fill="${color}" transform="rotate(-20 ${x} ${y})"/><line x1="${x + (up ? 7 : -7)}" x2="${x + (up ? 7 : -7)}" y1="${y}" y2="${y + (up ? -34 : 34)}" stroke="${color}" stroke-width="1.7"/><text x="${x}" y="${labelY}" text-anchor="middle" fill="${active ? '#99671f' : '#7c8578'}" font-size="14" font-family="system-ui" font-weight="${active ? '700' : '400'}">${safe(noteName(midi))}</text>${done ? `<circle cx="${x}" cy="${viewTop + 7}" r="3" fill="#729881"/>` : ''}</g>`;
  }).join('');

  let live = '<g data-live-note aria-hidden="true"></g>';
  let liveDescription = '';
  if (hasLive) {
    const directionText = inTune ? 'In tune with the target' : delta > 0 ? 'Lower your pitch' : 'Raise your pitch';
    liveDescription = ` Playing ${noteName(liveMidi)}, ${Math.abs(Math.round(delta))} cents ${delta >= 0 ? 'above' : 'below'} the target. ${directionText}.`;
    const color = '#397f76';
    const up = liveWrittenY >= top + 28;
    // A written natural explicitly distinguishes, for example, F from target F♯.
    const accidental = noteName(liveMidi).includes('♯') ? '♯' : noteName(targetMidi).includes('♯') && diatonic(liveMidi) === diatonic(targetMidi) ? '♮' : '';
    const accidentalX = liveX - 24;
    const arrowX = liveX + 23;
    const arrowStart = liveY + (liveDirection === 'lower' ? -7 : 7);
    const arrowEnd = liveY + (liveDirection === 'lower' ? 12 : -12);
    const arrowTip = liveDirection === 'lower' ? -4 : 4;
    const guide = !inTune ? `<path data-live-direction d="M${arrowX} ${arrowStart} V${arrowEnd} m-3 ${arrowTip} 3 ${-arrowTip} 3 ${arrowTip}" fill="none" stroke="${color}" stroke-width="1.4" opacity=".75"/>` : '';
    live = `<g data-live-note data-midi="${liveMidi}" data-delta-cents="${delta.toFixed(1)}" data-direction="${liveDirection}" role="img" aria-label="${safe(liveDescription.trim())}"><title>${safe(directionText)}</title><g opacity=".45">${ledgerLines(liveX, liveWrittenY, top, bottom, color, true)}</g>${!inTune ? `<line x1="${liveX + (up ? 9 : -9)}" x2="${liveX + (up ? 9 : -9)}" y1="${liveY}" y2="${liveY + (up ? -34 : 34)}" stroke="${color}" stroke-width="1.8" opacity=".55"/>` : ''}<ellipse data-live-head cx="${liveX}" cy="${liveY}" rx="${inTune ? 12 : 10}" ry="${inTune ? 8.5 : 7}" fill="${inTune ? 'none' : color}" fill-opacity=".23" stroke="${color}" stroke-opacity="${inTune ? '.8' : '.65'}" stroke-width="2" transform="rotate(-20 ${liveX} ${liveY})"/>${accidental && !inTune ? `<text data-live-accidental x="${accidentalX}" y="${liveY + 7}" fill="${color}" fill-opacity=".7" font-size="22" font-family="serif">${accidental}</text>` : ''}${guide}</g>`;
  }

  const clefY = info.clef === 'treble' ? 102 : info.clef === 'bass' ? 91 : 99;
  const description = `${info.clef} clef. ${visible.map(noteName).join(', ')}. Current note ${hasTarget ? noteName(targetMidi) : 'none'}.${liveDescription}`;
  return `<svg class="staff-svg" viewBox="0 ${viewTop} ${width} ${height}" role="img" aria-label="${safe(description)}" xmlns="http://www.w3.org/2000/svg">${ribbon}${staff}<text x="29" y="${clefY}" fill="#344135" font-family="Bravura, Noto Music, Apple Symbols, Symbola, serif" font-size="${info.clef === 'treble' ? 77 : 59}">${clef}</text><line x1="${width - 22}" x2="${width - 22}" y1="${top}" y2="${bottom}" stroke="#a6afa0" stroke-width="1.5"/>${glyphs}${live}</svg>`;
}

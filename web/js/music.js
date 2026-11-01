const NAMES = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
export const INSTRUMENTS = {
  violin: {id:'violin',name:'Violin',clef:'treble',strings:[{name:'G',midi:55},{name:'D',midi:62},{name:'A',midi:69},{name:'E',midi:76}]},
  viola: {id:'viola',name:'Viola',clef:'alto',strings:[{name:'C',midi:48},{name:'G',midi:55},{name:'D',midi:62},{name:'A',midi:69}]},
  cello: {id:'cello',name:'Cello',clef:'bass',strings:[{name:'C',midi:36},{name:'G',midi:43},{name:'D',midi:50},{name:'A',midi:57}]}
};
export function midiToFrequency(midi,a4=440){return a4 * 2 ** ((midi-69)/12);}
export function noteName(midi){return NAMES[((Math.round(midi)%12)+12)%12]+(Math.floor(Math.round(midi)/12)-1);}
export function frequencyToNote(frequency,a4=440){
  if(!Number.isFinite(frequency)||frequency<=0)return null;
  const exact=69+12*Math.log2(frequency/a4),midi=Math.round(exact);
  return {midi,name:NAMES[((midi%12)+12)%12],octave:Math.floor(midi/12)-1,label:noteName(midi),cents:(exact-midi)*100,frequency};
}
export function getFingering(midi,instrument='violin',preferredString=null){
  const info=INSTRUMENTS[instrument]||INSTRUMENTS.violin;
  const max=instrument==='cello'?6:7;
  const valid=info.strings.map((s,stringIndex)=>({...s,stringIndex,semitone:midi-s.midi})).filter(s=>s.semitone>=0&&s.semitone<=max);
  const chosen=valid.find(s=>s.stringIndex===preferredString||s.name===preferredString)||valid.at(-1);
  if(!chosen)return null;
  const map=instrument==='cello'?[0,1,1,2,3,4,4]:[0,1,1,2,2,3,3,4];
  const finger=map[chosen.semitone];
  const position=chosen.semitone===0?'Open string':instrument==='cello'&&[1,6].includes(chosen.semitone)?`Extended finger ${finger}`:instrument!=='cello'&&[1,3].includes(chosen.semitone)?`Low finger ${finger}`:instrument!=='cello'&&chosen.semitone===6?`High finger ${finger}`:`Finger ${finger}`;
  return {stringIndex:chosen.stringIndex,stringName:chosen.name,finger,semitone:chosen.semitone,midi,position};
}
export const EXERCISES=[
  {id:'open-strings',title:'Open strings',description:'Find your bow. Four strings, clear and steady.',level:'Beginner',type:'foundations'},
  {id:'d-major',title:'D major scale',description:'A one-octave journey up and back.',level:'Beginner',type:'scales'},
  {id:'a-major',title:'A major scale',description:'Build a confident high second finger.',level:'Beginner',type:'scales'},
  {id:'g-major',title:'G major scale',description:'Explore the warm side of your instrument.',level:'Beginner',type:'scales'},
  {id:'string-crossings',title:'String crossings',description:'Keep your fingers ready as your bow changes strings.',level:'Intermediate',type:'technique'},
  {id:'ode-to-joy',title:'Ode to Joy',description:'A familiar melody, one beautiful note at a time.',level:'Beginner',type:'melodies'},
  {id:'twinkle',title:'Twinkle, Twinkle',description:'Practice the opening phrase and repeated notes.',level:'Beginner',type:'melodies'},
  {id:'custom',title:'One-note focus',description:'Choose a note and make it feel like home.',level:'All levels',type:'focus'}
];
export function getSequence(exerciseId,instrument='violin',customMidi=69){
 const info=INSTRUMENTS[instrument]||INSTRUMENTS.violin;
 if(exerciseId==='custom')return Array(8).fill(Number(customMidi));
 if(exerciseId==='open-strings'){const values=info.strings.map(s=>s.midi);return [...values,...values.slice().reverse()];}
 let sequence;
 const scales={'d-major':62,'a-major':69,'g-major':55};
 if(scales[exerciseId]){let tonic=scales[exerciseId];if(instrument==='viola'&&exerciseId==='a-major')tonic-=12;if(instrument==='cello')tonic-=exerciseId==='a-major'?24:12;const up=[0,2,4,5,7,9,11,12].map(n=>n+tonic);return [...up,...up.slice(0,-1).reverse()];}
 if(exerciseId==='ode-to-joy')sequence=[66,66,67,69,69,67,66,64,62,62,64,66,66,64,64];
 else if(exerciseId==='twinkle')sequence=[62,62,69,69,71,71,69,67,67,66,66,64,64,62];
 else if(exerciseId==='string-crossings')sequence=[62,69,62,69,64,71,64,71,66,73,66,73,67,74,67,74];
 else return getSequence('d-major',instrument,customMidi);
 if(instrument==='cello')sequence=sequence.map(n=>n-12);
 return sequence;
}

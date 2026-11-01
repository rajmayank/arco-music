import test from 'node:test';
import assert from 'node:assert/strict';
import {renderStaff} from '../web/js/visuals.js';

function attributes(svg, selector) {
  const tag = svg.match(new RegExp(`<[^>]*\\b${selector}[^>]*>`))?.[0];
  assert.ok(tag, `${selector} exists`);
  return Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([,key,value])=>[key,value]));
}
function head(svg, live = true) {
  const value = attributes(svg, live ? 'data-live-head' : 'data-target-head');
  return {x:Number(value.cx),y:Number(value.cy)};
}
function viewBounds(svg) {
  const [,top,,height] = attributes(svg, 'viewBox').viewBox.split(' ').map(Number);
  return {top,bottom:top+height};
}

test('live pitch uses the written octave, with ledger lines above and below the staff', () => {
  for (const instrument of ['violin','viola','cello']) {
    for (const midi of [33,90]) {
      const svg = renderStaff({notes:[62,64,66],instrument,detectedNote:{midi,cents:0}});
      const played = head(svg),target = head(svg,false),bounds = viewBounds(svg);
      assert.equal(attributes(svg,'data-live-note')['data-midi'],String(midi));
      assert.ok(midi < 62 ? played.y > target.y : played.y < target.y);
      assert.ok(played.y - 40 > bounds.top, `${instrument} ${midi}: note and stem fit above`);
      assert.ok(played.y + 40 < bounds.bottom, `${instrument} ${midi}: note and labels fit below`);
      assert.match(svg,/data-live-ledger/);
    }
  }
});

test('an exact matching pitch merges around the target without hiding it', () => {
  const svg=renderStaff({notes:[69],detectedNote:{midi:69,cents:0}});
  assert.deepEqual(head(svg),head(svg,false));
  assert.equal(attributes(svg,'data-live-note')['data-direction'],'match');
  assert.equal(attributes(svg,'data-live-head').fill,'none');
  assert.match(svg,/data-target-head/);
});

test('wrong octaves stay separate even when the pitch class matches', () => {
  const svg=renderStaff({notes:[69],detectedNote:{midi:81,cents:0}});
  assert.equal(head(svg).y,head(svg,false).y-49);
  assert.equal(attributes(svg,'data-live-note')['data-direction'],'lower');
  assert.equal(attributes(svg,'data-live-note')['data-delta-cents'],'1200.0');
});

test('cents move the live note continuously and direction uses total distance to target', () => {
  const sharp=renderStaff({notes:[69],detectedNote:{midi:69,cents:40},tolerance:25});
  const flat=renderStaff({notes:[69],detectedNote:{midi:69,cents:-40},tolerance:25});
  assert.ok(head(sharp).y < head(sharp,false).y);
  assert.ok(head(flat).y > head(flat,false).y);
  assert.equal(attributes(sharp,'data-live-note')['data-direction'],'lower');
  assert.equal(attributes(flat,'data-live-note')['data-direction'],'raise');
  const higherNoteButFlat=renderStaff({notes:[69],detectedNote:{midi:70,cents:-40}});
  assert.equal(attributes(higherNoteButFlat,'data-live-note')['data-direction'],'lower');
});

test('sharp and natural pitches remain distinguishable on the same staff position', () => {
  const sharp=renderStaff({notes:[65],detectedNote:{midi:66,cents:0}});
  const natural=renderStaff({notes:[66],detectedNote:{midi:65,cents:0}});
  assert.equal(head(sharp).y,head(sharp,false).y);
  assert.equal(head(natural).y,head(natural,false).y);
  assert.match(sharp,/data-live-accidental[^>]*>♯/);
  assert.match(natural,/data-live-accidental[^>]*>♮/);
  assert.equal(attributes(sharp,'data-live-note')['data-direction'],'lower');
  assert.equal(attributes(natural,'data-live-note')['data-direction'],'raise');
});

test('silence and invalid pitches do not create a ghost note', () => {
  for (const detectedNote of [null,{midi:NaN},{midi:Infinity},{midi:200},{midi:-1}]) {
    const svg=renderStaff({notes:[69],detectedNote});
    assert.doesNotMatch(svg,/data-live-head/);
    assert.match(svg,/data-live-note aria-hidden="true"/);
  }
});

test('compact staff preserves readable spacing and fits the final live note', () => {
  const svg=renderStaff({notes:[62,64,66,67,69],activeIndex:4,compact:true,detectedNote:{midi:90,cents:25}});
  assert.equal(attributes(svg,'viewBox').viewBox.split(' ')[2],'460');
  assert.ok(head(svg).x+40<460);
  assert.equal((svg.match(/data-target-head/g)||[]).length,1);
  assert.match(svg,/Current note A4/);
});

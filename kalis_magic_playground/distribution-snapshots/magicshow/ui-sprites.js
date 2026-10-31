'use strict';
  function stageSprite(source, path, reference) {
    const metrics = STAGE_AUDIENCE_METRICS[reference];
    if (!metrics) return opaqueSprite(source, path);
    opaqueSprite(source, path);
    const cached = opaqueSprites.get(path), key = 'stage:' + reference;
    if (!cached.bounds) return path;
    if (!cached[key]) {
      const [,,width,height] = metrics, b = cached.bounds, canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(source,b.left,b.top,b.width,b.height,(width-b.width)/2,height-b.height,b.width,b.height);
      cached[key] = canvas.toDataURL();
    }
    return cached[key];
  }
  // fixP 7: faces that ship only a base and a -happy face (assets-manifest.json, 10-28). Their -s2..-s5 names were asked for and 404'd before the
  // chain fell back; skipping them keeps the same fallback order (so the same face shows) without the requests.
  const NO_STAGE_FACES = new Set(['aud-a1','aud-a108','aud-a2','aud-a3','aud-blackcat','aud-future-kali-true','aud-mingiri-dark','aud-s1-classmate','aud-s1-teacher','aud-tutorial-mingiri']);
  function audienceStagePaths(base, stage) {
    const stem = audienceArtPath(base).replace(/\.(?:png|webp)$/, ''), only = NO_STAGE_FACES.has(stem.replace(/^assets\//, ''));
    return [1,2,3,4,5,6].sort((a,b)=>Math.abs(a-stage)-Math.abs(b-stage)||a-b).filter(n=>!only||n===1||n===6)
      .map(n=>stem+(n===1?'':n===6?'-happy':'-s'+n)+'.png');
  }
  // A doubt-stage change (about four per fight). Not the first face, and not the win face.
  function audienceStagePop(host) {
    if (!host || reduced) return;
    // s5a: grow from the top edge (down and out), like the s4j finale pop, so the figure never reaches up into the speech bubble.
    animate(host, [{ transform: 'scale(1)', transformOrigin: '50% 0', filter: 'brightness(1)' }, { transform: 'scale(1.06)', transformOrigin: '50% 0', filter: 'brightness(1.15)', offset: .4 }, { transform: 'scale(1)', transformOrigin: '50% 0', filter: 'brightness(1)' }], 150);
    sound('rise');
  }
  function stageAudienceFace(host, base, stage) {
    if (!base) return;
    base = audienceArtPath(base);
    host.dataset.reference = base;
    const mood = 'stage-' + stage;
    const prev = host.dataset.mood;
    const shift = host.dataset.faceBase === base && /^stage-[1-5]$/.test(prev || '') && /^stage-[1-5]$/.test(mood) && prev !== mood;
    if (host.dataset.mood !== mood || host.dataset.faceBase !== base) {
      host.dataset.faceBase = base;
      moodSprite(host, base, mood, audienceStagePaths(base, stage));
      if (shift) audienceStagePop(host);
    }
  }
  function audienceDoubtStage() {
    const dv = typeof shownDoubt === 'function' ? shownDoubt() : { hp: state.audHp, max: state.audHpMax }; // s5b: each theater phase is its own bar, so 앞줄 관객 and 밍기리 each show all their stage faces
    return 1 + Math.min(4, Math.floor(5 * (1 - Math.max(0, Math.min(1, dv.hp / Math.max(1e-9, dv.max)))) + 1e-9));
  }
  // v4 U46 A8: head framing inside the dialog portrait frame (rewritten in s5f, see below).
  // s5f (owner 10-24: the dialog faces were far too big and the heads were cut): every dialog portrait shows the whole head (hair or hat
  // top with a small margin) plus the neck and the top of the shoulders, and the head is the same size for every character.
  // PORTRAIT_HEADS is measured from the pixels (.runs-v5/s5f/heads: the same alpha crop as opaqueSprite, alpha > 16, first frame of a strip):
  // name: [crop width, crop height, head top, chin, head centre x] in crop pixels. Head top = first row at least 45% as wide as the head
  // (antennas and sparkles do not count); chin = bottom of the face skin, else the silhouette neck; 14 sprites were checked by hand.
  // Frame: the head (top to chin) is HEAD_SPAN of the frame height, its top HEAD_TOP below the frame top; the head centre is the frame centre.
  const PORTRAIT_HEADS = {"aud-a1-happy":[123,196,7,121,61.5],"aud-a1-serious":[124,195,8,116,62],"aud-a1-surprised":[124,195,6,115,62],"aud-a1":[124,196,6,116,62],"aud-a10-happy":[162,210,12,126,82.3],"aud-a10":[164,210,9,123,83.3],"aud-a100-happy":[140,198,0,109,68.6],"aud-a100":[138,198,0,109,69],"aud-a101-happy":[162,198,0,111,78.7],"aud-a101":[153,198,0,120,68.5],"aud-a102-happy":[141,198,2,127,70.5],"aud-a102":[138,198,4,111,69.3],"aud-a106-happy":[175,233,13,140,84.4],"aud-a106":[176,233,14,138,88.2],"aud-a107-happy":[139,218,8,127,69.5],"aud-a107":[137,218,9,130,68.5],"aud-a108-happy":[181,203,15,117,87],"aud-a108":[174,203,12,117,84],"aud-a109-happy":[181,212,15,132,90.5],"aud-a109":[170,212,15,128,80.8],"aud-a11-happy":[138,204,7,123,70.5],"aud-a11":[124,204,7,118,58.5],"aud-a110-happy":[176,250,8,160,89.5],"aud-a110":[172,250,8,144,85.5],"aud-a111-happy":[149,216,8,125,67.1],"aud-a111":[147,216,10,126,67],"aud-a12-happy":[138,222,8,135,68.5],"aud-a12":[141,222,8,134,73.5],"aud-a13-happy":[148,232,9,146,74],"aud-a13":[153,232,8,144,77.4],"aud-a14-happy":[106,201,10,129,54.3],"aud-a14":[102,201,10,127,51],"aud-a15-happy":[139,232,9,138,71],"aud-a15":[138,232,8,136,71],"aud-a16-happy":[124,204,8,102,59.6],"aud-a16-surprised":[124,204,10,102,62],"aud-a16":[124,204,8,102,58.2],"aud-a17-happy":[107,207,13,146,53.5],"aud-a17":[106,207,17,149,53],"aud-a18-happy":[111,213,11,138,55.5],"aud-a18":[112,213,15,135,56],"aud-a19-happy":[126,211,6,109,65.6],"aud-a19":[131,211,7,119,63.9],"aud-a2-happy":[127,204,4,112,66.9],"aud-a2-serious":[122,201,7,114,61],"aud-a2-surprised":[122,204,7,118,60.7],"aud-a2":[122,204,4,116,61],"aud-a20-happy":[116,228,4,144,57.8],"aud-a20":[110,228,4,141,55.3],"aud-a21-happy":[103,198,8,122,51.5],"aud-a21":[110,198,8,125,55],"aud-a22-happy":[120,232,0,137,59.6],"aud-a22":[121,232,0,135,60.5],"aud-a23-happy":[132,232,6,111,68],"aud-a23":[131,232,4,111,66],"aud-a24-happy":[109,232,21,132,54.4],"aud-a24":[119,232,21,133,59.5],"aud-a25-happy":[102,232,6,138,46.8],"aud-a25":[102,232,3,138,47.1],"aud-a26-happy":[138,232,8,131,69],"aud-a26":[138,232,8,128,68.5],"aud-a27-happy":[124,232,10,141,63],"aud-a27":[124,232,10,140,61.2],"aud-a28-happy":[132,207,8,120,66],"aud-a28":[143,207,8,102,71.5],"aud-a29-happy":[139,231,4,126,62.5],"aud-a29":[138,231,4,125,65],"aud-a3-happy":[123,216,14,128,61.5],"aud-a3-serious":[123,214,15,126,61.3],"aud-a3-surprised":[123,210,14,124,61.4],"aud-a3":[123,216,15,127,61.2],"aud-a30-happy":[142,231,4,124,78],"aud-a30":[145,231,4,127,67],"aud-a31-happy":[114,232,38,157,57],"aud-a31":[114,232,57,157,57],"aud-a32-happy":[112,232,66,167,56.2],"aud-a32":[111,232,64,134,57.1],"aud-a33-happy":[104,232,56,158,52],"aud-a33":[105,232,58,159,50.5],"aud-a34-happy":[164,232,0,144,82],"aud-a34":[168,232,0,144,84],"aud-a35-happy":[163,221,0,148,81.5],"aud-a35":[161,221,0,147,80.5],"aud-a36-happy":[163,223,0,134,81.5],"aud-a36":[167,223,0,137,83.5],"aud-a37-happy":[172,208,12,125,84.5],"aud-a37":[156,208,8,130,72.9],"aud-a38-happy":[146,220,10,132,75.5],"aud-a38":[146,220,10,132,74.5],"aud-a39-happy":[188,221,12,148,90.5],"aud-a39":[172,221,10,133,81.2],"aud-a4-happy":[141,216,10,125,68.5],"aud-a4":[143,216,12,125,67],"aud-a46-happy":[129,198,15,125,61.2],"aud-a46":[120,198,18,122,61.5],"aud-a5-happy":[151,222,28,128,76.3],"aud-a5":[127,222,13,128,63.5],"aud-a50-happy":[177,198,6,114,88.5],"aud-a50":[144,198,9,114,72],"aud-a54-happy":[156,198,18,119,69],"aud-a54":[120,198,9,134,60],"aud-a55-happy":[141,198,18,131,69.8],"aud-a55":[126,198,12,122,63],"aud-a59-happy":[159,198,21,125,69],"aud-a59":[117,198,18,125,58.5],"aud-a6-happy":[136,216,4,121,66],"aud-a6":[134,216,8,126,64.9],"aud-a60-happy":[129,198,12,122,66],"aud-a60":[114,198,21,122,57],"aud-a64-happy":[147,198,6,128,72],"aud-a64":[114,198,6,125,57],"aud-a65-happy":[135,198,12,125,61.5],"aud-a65":[117,198,15,128,58.5],"aud-a66-happy":[144,198,9,116,72],"aud-a66":[135,198,6,113,67.5],"aud-a7-happy":[129,214,9,126,64.5],"aud-a7":[131,214,10,126,65.5],"aud-a70-happy":[138,198,12,131,69],"aud-a70":[111,198,9,125,57],"aud-a71-happy":[150,198,0,128,67.5],"aud-a71":[129,198,3,125,61.5],"aud-a72-happy":[168,198,12,138,90],"aud-a72":[129,198,6,125,64.5],"aud-a76-happy":[159,198,6,113,79.5],"aud-a76":[114,198,6,113,57],"aud-a77-happy":[153,198,12,116,70.5],"aud-a77":[123,198,6,113,61.5],"aud-a78-happy":[147,198,6,128,70.5],"aud-a78":[105,198,3,119,52.1],"aud-a79-happy":[165,198,6,122,84],"aud-a79":[120,198,6,110,60],"aud-a8-happy":[132,213,7,128,66],"aud-a8":[133,213,8,128,66.5],"aud-a83-happy":[162,198,12,119,85.5],"aud-a83":[126,198,6,119,63.8],"aud-a84-happy":[180,198,6,119,90],"aud-a84":[138,198,9,104,69],"aud-a85-happy":[180,198,12,122,96],"aud-a85":[126,198,6,119,63],"aud-a86-happy":[171,198,6,125,85.5],"aud-a86":[126,198,9,119,63],"aud-a9-happy":[160,232,4,138,80],"aud-a9":[163,232,4,140,81.5],"aud-a90-happy":[141,198,36,134,70.5],"aud-a90":[123,198,36,128,61],"aud-a91-happy":[162,198,30,149,84.5],"aud-a91":[129,198,21,143,64.5],"aud-a92-happy":[135,198,18,150,60],"aud-a92":[120,198,27,137,60],"aud-a93-happy":[150,198,30,114,78],"aud-a93":[123,198,24,134,61.5],"aud-a94-happy":[138,198,39,123,61.5],"aud-a94":[111,198,42,134,55.5],"aud-a98-happy":[146,198,0,123,65.3],"aud-a98":[141,198,2,122,65.5],"aud-a99-happy":[140,198,0,131,68.5],"aud-a99":[139,198,4,126,69.5],"aud-blackcat-happy":[142,190,13,128,67],"aud-blackcat":[142,190,15,129,67],"aud-f-brother-happy":[126,170,11,108,63.8],"aud-f-brother":[125,170,10,108,63.1],"aud-f-mom-happy":[133,184,6,117,66.4],"aud-f-mom":[133,184,7,118,66.5],"aud-f-sister-happy":[203,181,5,116,103.1],"aud-f-sister":[202,181,5,117,102.3],"aud-future-kali-happy":[186,216,11,133,89.4],"aud-future-kali-serious":[175,214,12,139,80],"aud-future-kali-surprised":[175,214,11,139,82.5],"aud-future-kali":[175,216,10,140,78.8],"aud-lecturenote-hecate-happy":[161,196,9,128,70.9],"aud-lecturenote-hecate-serious":[160,197,11,110,74],"aud-lecturenote-hecate-surprised":[159,198,10,128,70.9],"aud-lecturenote-hecate":[161,196,10,108,71.8],"aud-lecturenote-jung-happy":[139,198,8,121,69.5],"aud-lecturenote-jung-serious":[140,198,8,121,70.3],"aud-lecturenote-jung-surprised":[141,197,7,123,70.5],"aud-lecturenote-jung":[139,197,8,121,69.5],"aud-lecturenote-serona-happy":[168,197,11,124,84],"aud-lecturenote-serona-serious":[169,197,11,124,84.5],"aud-lecturenote-serona-surprised":[166,196,10,123,83],"aud-lecturenote-serona":[168,198,11,124,84],"aud-meetup-busan-happy":[140,190,9,124,68.3],"aud-meetup-busan":[139,189,8,125,67.2],"aud-meetup-changwon-happy":[155,189,11,125,76.3],"aud-meetup-changwon":[154,190,10,126,76.8],"aud-meetup-cheonan-happy":[148,198,7,127,74.1],"aud-meetup-cheonan":[146,198,7,128,73.5],"aud-meetup-daegu-happy":[156,197,6,148,78],"aud-meetup-daegu":[154,197,13,128,77],"aud-meetup-geoje-happy":[151,197,9,131,75.5],"aud-meetup-geoje":[150,197,3,130,75.5],"aud-meetup-incheon-happy":[137,189,8,123,68.2],"aud-meetup-incheon":[136,189,10,121,67.5],"aud-meetup-suwon-happy":[137,189,7,111,62.7],"aud-meetup-suwon":[137,189,7,110,64.4],"aud-mingiri-dark-happy":[204,248,16,103,98],"aud-mingiri-dark":[248,232,24,134,124],"aud-past-kali-happy":[129,171,8,111,64.5],"aud-past-kali-serious":[128,171,8,110,64],"aud-past-kali-surprised":[156,171,11,110,78.1],"aud-past-kali":[127,171,7,110,63.5],"aud-perfect-kali-happy":[218,212,12,142,106.1],"aud-perfect-kali-serious":[217,212,12,143,106.2],"aud-perfect-kali-surprised":[218,213,13,141,105.4],"aud-perfect-kali":[217,212,12,140,104.8],"aud-s1-classmate-happy":[151,186,8,125,75.5],"aud-s1-classmate":[146,185,7,124,72.9],"aud-s1-teacher-happy":[150,192,4,120,75],"aud-s1-teacher":[149,194,6,122,74.7],"aud-tutorial-mingiri-happy":[142,171,21,115,69.4],"aud-tutorial-mingiri-serious":[145,169,29,113,76.9],"aud-tutorial-mingiri-surprised":[145,171,25,115,76.2],"aud-tutorial-mingiri":[145,171,25,115,76.2],"aud-tutorial-ndd-happy":[144,198,10,115,72],"aud-tutorial-ndd-serious":[132,198,8,115,65.7],"aud-tutorial-ndd-surprised":[132,194,10,115,65],"aud-tutorial-ndd":[132,198,10,117,65.6],"aud-tv1-happy":[189,198,17,104,82.1],"aud-tv1":[189,198,18,104,83],"aud-tv2-happy":[149,197,15,141,74.4],"aud-tv2":[146,197,15,142,72.5],"aud-tv3-happy":[233,196,24,119,114.2],"aud-tv3":[231,197,24,133,114.5],"aud-tv4-happy":[193,197,6,114,96.5],"aud-tv4":[191,197,6,128,95.5],"aud-tv5-happy":[209,198,21,129,97.8],"aud-tv5":[203,197,19,128,94.8],"aud-tv6-happy":[207,198,20,122,106.4],"aud-tv6":[207,198,20,122,107],"aud-young-kali-happy":[209,216,17,125,104.7],"aud-young-kali-serious":[209,216,18,125,104.3],"aud-young-kali-surprised":[210,215,10,101,106.5],"aud-young-kali":[209,216,18,125,103.8],"headliner-card1412-happy":[134,210,16,134,66.9],"headliner-card1412-surprised":[134,210,12,115,66.8],"headliner-card1412-talk-happy":[134,210,10,118,67.7],"headliner-card1412-talk":[134,210,8,121,67.6],"headliner-card1412":[134,210,14,117,67.3],"headliner-h1-happy":[147,210,12,129,73.5],"headliner-h1-serious":[148,210,10,127,74],"headliner-h1-surprised":[148,209,11,126,74],"headliner-h1":[148,210,11,129,74],"headliner-h10-happy":[143,220,8,96,76.5],"headliner-h10":[134,220,8,95,67],"headliner-h11-happy":[142,232,12,116,72.5],"headliner-h11":[149,232,11,116,74.5],"headliner-h12-happy":[134,232,6,120,64.4],"headliner-h12":[125,232,8,108,59],"headliner-h13-happy":[154,232,0,148,77],"headliner-h13":[145,232,1,127,72],"headliner-h2-happy":[169,226,11,163,83.1],"headliner-h2":[160,226,10,136,82.7],"headliner-h3-happy":[167,202,17,117,71],"headliner-h3":[130,202,18,120,59],"headliner-h4-happy":[135,222,9,142,66],"headliner-h4":[131,222,7,125,66],"headliner-h5-happy":[161,212,13,117,68.5],"headliner-h5":[163,212,14,118,69.5],"headliner-h6-happy":[131,214,7,125,65.5],"headliner-h6":[128,214,8,124,64],"headliner-h7-happy":[175,220,10,123,87.8],"headliner-h7":[164,220,7,122,82.2],"headliner-h8-happy":[157,228,3,124,82.4],"headliner-h8":[158,228,3,125,78.8],"headliner-h9-happy":[149,230,12,117,74.3],"headliner-h9":[144,230,11,113,72.4],"headliner-lecturenote-kim-happy":[182,215,16,134,90.5],"headliner-lecturenote-kim-serious":[183,215,16,134,91.2],"headliner-lecturenote-kim-surprised":[204,215,16,133,102.1],"headliner-lecturenote-kim":[182,216,16,134,91],"headliner-meetup-seoul-happy":[150,190,9,120,72.4],"headliner-meetup-seoul":[151,190,10,121,71],"headliner-tv-happy":[173,216,17,122,67.8],"headliner-tv":[134,216,12,118,66.5],"kali-outfit-1":[127,204,7,129,64],"kali-outfit-2":[137,204,5,114,68.9],"kali-outfit-3":[183,204,7,104,90.1],"kali-skin-brownknit":[136,204,8,123,70],"kali-skin-camera":[143,204,7,108,71.8],"kali-skin-denim":[135,205,7,111,69.3],"kali-skin-flame":[134,206,8,129,67.2],"kali-skin-guitar":[166,205,10,112,77.3],"kali-skin-hanbok":[166,206,9,136,71.4],"kali-skin-reader":[133,206,8,135,66.9],"kali-skin-redtee":[128,199,8,126,63.9],"kali-skin-wave":[131,207,9,114,65.5],"serona-hooded":[208,240,24,139,103.7],"serona-reveal":[196,200,8,91,98],"serona":[248,244,14,122,122.8],"aud-hotel-neighbor":[131,208,11,119,64.6],"aud-hotel-neighbor-s2":[131,208,11,119,64.5],"aud-hotel-neighbor-s3":[131,208,11,119,67.0],"aud-hotel-neighbor-s4":[133,211,10,122,65.7],"aud-hotel-neighbor-s5":[131,211,10,133,67.2],"aud-hotel-neighbor-happy":[131,211,10,133,65.1],"headliner-hotel":[135,198,7,116,64.0],"headliner-hotel-s2":[136,200,7,118,64.5],"headliner-hotel-s3":[135,200,8,117,63.5],"headliner-hotel-s4":[137,201,9,117,64.6],"headliner-hotel-s5":[136,202,7,118,64.5],"headliner-hotel-happy":[136,201,7,118,63.0],"aud-audition-fd":[135,207,8,116,68.5],"aud-audition-fd-s2":[135,207,7,116,68.0],"aud-audition-fd-s3":[136,207,7,116,69.0],"aud-audition-fd-s4":[135,210,7,117,67.8],"aud-audition-fd-s5":[136,211,7,118,68.5],"aud-audition-fd-happy":[137,211,7,120,69.2],"aud-audition-waiting":[162,210,7,119,78.5],"aud-audition-waiting-s2":[163,210,7,118,78.5],"aud-audition-waiting-s3":[162,210,7,119,78.5],"aud-audition-waiting-s4":[167,210,8,122,80.8],"aud-audition-waiting-s5":[164,211,8,122,78.8],"aud-audition-waiting-happy":[165,211,8,123,79.1],"aud-future-student":[134,210,8,123,63.0],"aud-future-student-s2":[134,210,8,123,63.0],"aud-future-student-s3":[134,210,8,123,63.0],"aud-future-student-s4":[138,210,7,123,69.9],"aud-future-student-s5":[134,210,7,123,63.0],"aud-future-student-happy":[134,210,7,123,63.0],"aud-future-beginner":[150,209,13,125,72.5],"aud-future-beginner-s2":[150,209,13,125,73.0],"aud-future-beginner-s3":[150,210,15,126,73.0],"aud-future-beginner-s4":[154,210,14,120,72.0],"aud-future-beginner-s5":[150,210,14,125,73.0],"aud-future-beginner-happy":[150,210,15,125,72.5]};
  const HEAD_TOP = .07, HEAD_SPAN = .56;
  function portraitFocus(path) {
    const name = String(path).replace(/^assets\//, '').replace(/\.(?:png|webp)$/, '');
    let m = PORTRAIT_HEADS[name] || PORTRAIT_HEADS[name.replace(/-(?:happy|serious|surprised|sad)$/, '')];
    if (!m) { const b = typeof opaqueSprites !== 'undefined' && opaqueSprites.get(path)?.bounds; m = b ? [b.width, b.height, 0, Math.round(b.height * .58), b.width / 2] : [1, 1, 0, .58, .5]; }
    const [w, h, top, chin, cx] = m, k = HEAD_SPAN / Math.max(1, chin - top);
    const pct = v => `${Math.round(v * 1000) / 10}%`;
    return { h: pct(h * k), t: pct(HEAD_TOP - top * k), x: `translateX(-${pct(cx / w)})`, measured: !!PORTRAIT_HEADS[name] };
  }
  function figureSize(path) {
    if(/mingiri|past-kali|kali-past|aud-a108(?:-|\.)/.test(path))return 'small';
    return /headliner-|future-kali/.test(path)?'large':'regular';
  }
  // U32: on tablets the audience sprite is drawn at a whole-number multiple of its pixel size (no uneven pixel columns).
  function snapAudience(image) {
    const host = $('audience'), img = image || host.querySelector(':scope > .asset-sprite');
    if (!img) return;
    if (host.dataset.reference) { img.style.height = ''; delete img.dataset.snap; return; }
    if (!document.body.classList.contains('tablet')) { img.style.height = ''; delete img.dataset.snap; return; }
    const apply = () => {
      const nat = img.naturalHeight, factor = host.dataset.figureSize === 'large' ? .95 : host.dataset.figureSize === 'small' ? Math.min(1,.72*Number(host.dataset.storyScale||1)) : .84;
      if (!nat || !host.clientHeight) return;
      let k = Math.max(1, Math.round(host.clientHeight * factor / nat));
      if (k > 1 && nat * k > host.clientHeight * 1.06) k--;
      img.style.height = `${nat * k}px`; img.dataset.snap = String(k);
    };
    if (img.complete && img.naturalHeight) apply(); else img.addEventListener('load', apply, { once: true });
  }
  // v4 U49 3: while an image is still loading the host is .asset-pending and shows nothing (style.css hides its emoji text and fallback children);
  // the emoji only shows once the image really failed (.asset-failed: error event, or complete with naturalWidth 0).
  // v4 U49b 2: every picture request on a host gets a new generation (host._artGen); a load or error callback of an older request (an earlier
  // audience with the same face, an earlier mood) is ignored, so it can neither show its picture nor end the new picture's pending state.
  // v4 U49b 3: the emoji glyph written straight into a host is wrapped in its own span (.sprite-glyph), so hiding it never depends on the text colour.
  const nextArt = host => (host._artGen = (host._artGen || 0) + 1);
  function wrapGlyph(host) { for (const n of [...host.childNodes]) if (n.nodeType === 3 && n.nodeValue.trim()) { const s = document.createElement('span'); s.className = 'sprite-glyph'; n.replaceWith(s); s.append(n); } }
  function pendingArt(host, source) { wrapGlyph(host); host.classList.remove('asset-failed'); host.classList.toggle('asset-pending', !(source.complete && source.naturalWidth)); }
  function failedArt(host) { host.classList.remove('asset-pending'); host.classList.add('asset-failed'); }
  function sprite(host, path) {
    if (path) path = audienceArtPath(path);
    host.querySelectorAll(':scope > .asset-sprite').forEach(img => img.remove());
    host.classList.remove('asset-ready'); host.dataset.asset = path;
    if (host.id === 'audience' && !host.dataset.reference) host.dataset.reference = path.replace(/-(?:s[2-6]|happy|serious|surprised|sad)(?=\.(?:png|webp)$)/, '');
    if (!path) { nextArt(host); host.classList.remove('asset-pending'); return; }
    const source = assetImage(path), gen = nextArt(host);
    pendingArt(host, source);
    const fail = () => { if (host._artGen === gen && host.dataset.asset === path && !source.naturalWidth) failedArt(host); };
    const show = () => {
      if (host._artGen !== gen || host.dataset.asset !== path) return;
      if (!source.naturalWidth) { fail(); return; }
      host.classList.remove('asset-pending');
      host.querySelectorAll(':scope > .asset-sprite').forEach(img => img.remove());
      const image = source.cloneNode(); image.className = 'asset-sprite'; image.alt = '';
      if (/assets\/(?:aud-|headliner-)/.test(path)||host.classList.contains('story-portrait')&&/^assets\/kali-/.test(path)) {
        host.classList.add('normalized-figure');host.dataset.figureSize=figureSize(path);
        try { image.src=host.id === 'audience' ? stageSprite(source,path,host.dataset.reference || path) : opaqueSprite(source,path,host.classList.contains('dialogue-emoji')); } // v4 U46 A8: the dialog portrait frames the head of the full sprite (portraitFocus)
        catch(error) { /* Keep the source if a cross-origin canvas is unavailable. */ }
      }
      if(/^assets\/(?:box-|case-)/.test(path)){try{image.src=/assets\/case-(?:closed|open)\.png$/.test(path) ? stageSprite(source,path,'assets/case-closed.png') : opaqueSprite(source,path);}catch(error){ /* Keep fallback geometry if alpha access fails. */ }}
      if (host.classList.contains('story-portrait')) { const f = portraitFocus(path); image.style.height = f.h; image.style.top = f.t; image.style.transform = f.x; } // v4 U46 A8: the dialog frame shows the head at its focus point
      host.append(image); host.classList.add('asset-ready');
      if (host.id === 'audience') {
        const refit = () => { if (host._artGen === gen) { invalidateStageAudience(); syncFlags(); } };
        snapAudience(image);
        if (image.complete && image.naturalWidth) refit(); else image.addEventListener('load', refit, { once: true });
      }
    };
    if (source.complete) show(); else { source.addEventListener('load', show, { once: true }); source.addEventListener('error', fail, { once: true }); }
  }
  const venueAsset = v => `assets/${v.venueAsset}`;
  const audienceAsset = (v, a) => a.id === 'a-lecturenote-serona' ? 'assets/serona.png' : a.id === 'a1' ? 'assets/aud-f-sister.png' : a.portraitAsset ? `assets/${a.portraitAsset}` : a === v.headliner ? `assets/headliner-${a.id}.png` : `assets/aud-${a.id}.png`;
  // School-chain and NDD fights keep a family audience id (a1). Mood files must stay on the tutorial sprite, not that id's portrait.
  // s5t (read-through bug 4): the school tutorial fights (같은 반 여학생, 수학 선생님) and the NDD fight heckle with their own existing lines,
  // not the family living room audience's (the tutorial runs on venue 1). null outside the tutorial.
  function tutorialSpeakerLines() {
    const base = tutorialStageBase(); if (!base) return null;
    const T = D.storyV15.tutorial, ch = T.schoolChain || {};
    const pick = (name, ...packs) => [...new Set(packs.flat().filter(l => l && l.speaker === name && l.text).map(l => l.text))];
    // v6 script (Q22): the girl fight shows her own line and her new heckles; the teacher fight her coach line and her new heckles.
    const lines = base.includes('ndd') ? pick('NDD', T.intro || [], T.coaching || []) : base.includes('teacher') ? pick('수학 선생님', ch.teacherDuring || [], ch.teacherHeckles || []) : pick('같은 반 여학생', ch.girlIntro || [], ch.girlHeckles || []);
    return lines.length ? lines : null;
  }
  // v6 script: the regretful line of the tutorial audience on a lost tutorial fight ('' outside the tutorial).
  function tutorialMissLine() {
    const base = tutorialStageBase(); if (!base) return '';
    const T = D.storyV15.tutorial, ch = T.schoolChain || {};
    return (base.includes('ndd') ? T.missLine : base.includes('teacher') ? ch.teacherMissLine : ch.girlMissLine) || '';
  }
  function tutorialStageBase() {
    if (!state || !state.u15 || !state.u15.tutorial || state.u15.tutorial.done) return '';
    if (state.u15.tutorial.active) return 'assets/aud-tutorial-ndd.png';
    const mark = chainMark();
    if (!mark) return '';
    if (mark.step.startsWith('teacher') || mark.step.startsWith('upgrade')) return 'assets/aud-s1-teacher.png';
    if (mark.step.startsWith('girl')) return 'assets/aud-s1-classmate.png';
    return '';
  }
  const stageAudienceAsset = (v, a) => tutorialStageBase() || audienceAsset(v, a);
  // s5b (owner 10-24): the 소극장 headliner slot in two phases (C.theaterPhase). The stage shows 앞줄 관객 (D.theaterPhases.face: a14 art, name,
  // lines) in phase 1, through its win beat (state._theaterBeat) and through the subway memory until 밍기리 grows on growLine; then 밍기리.
  // The phase-1 win beat lives on the state object as a transient (never saved, like _colMs): {until, text}.
  function beatOn() { return !!(state._theaterBeat && clock < state._theaterBeat.until); }
  function theaterShownPhase() {
    const p = C.theaterPhase(state); if (p !== 2) return p;
    if (beatOn()) return 1;
    const sc = state.u15.scene, cfg = D.theaterPhases;
    if (sc && sc.slug === cfg.slug && sc.kind === 'beforeHeadliner' && sc.line >= cfg.sceneLine && sc.line < cfg.growLine) return 1;
    return C.theaterSceneDue(state) ? 1 : 2;
  }
  // The doubt bar as shown: 앞줄 관객's emptied bar stays up through its win beat and the memory, then 밍기리's own bar (C.doubtView).
  function shownDoubt() {
    if (C.theaterPhase(state) === 2 && theaterShownPhase() === 1) return { hp: 0, max: Math.max(1e-9, state.audHpMax * D.theaterPhases.phase1) };
    return C.doubtView(state);
  }
  function fightAudience(v, j) {
    const a = C.audienceAt(v, j);
    if (a !== v.headliner || v !== D.venues[state.venue - 1] || j !== state.j || theaterShownPhase() !== 1) return a;
    return v.audiences.find(x => x.id === D.theaterPhases.face) || a;
  }
  // The memory part of the theater beforeHeadliner (live or replayed) dims the stage behind the lines; from growLine the stage is back (밍기리).
  function storyShade() {
    const sc = state.u15.scene, cfg = D.theaterPhases;
    if (!sc || !cfg || sc.slug !== cfg.slug || sc.kind !== 'beforeHeadliner' || sc.line < cfg.sceneLine || $('storyDialog').hidden) return '';
    // Script edits can insert memory lines before Mingiri's return (currently line 20).
    const lines=D.storyV15.venues[cfg.slug].beforeHeadliner;
    const present=lines.findIndex((line,i)=>i>=cfg.sceneLine && line.speaker==='밍기리');
    return sc.line < (present<0 ? cfg.growLine : present) ? 'memory' : 'present';
  }
  // 밍기리 grows on "인간... 실패... 크다!" (and at phase 2 when the memory was already seen): a short scale-up from the floor, like the 4e-1 entrance.
  function mingiriGrowth() {
    sound('rise');
    if (reduced) return;
    animate($('audience'), [{ transform: 'scale(.62)', transformOrigin: '50% 100%', filter: 'brightness(.6)' }, { transform: 'scale(1.08)', transformOrigin: '50% 100%', filter: 'brightness(1.15)', offset: .7 }, { transform: 'scale(1)', transformOrigin: '50% 100%', filter: 'brightness(1)' }], 650);
  }
  // Optional expressions are requested only when the current art shipment contains them.
  const shippedExpressionArt = new Set(["assets/aud-a1-serious.png", "assets/aud-a1-surprised.png", "assets/aud-a2-serious.png", "assets/aud-a2-surprised.png", "assets/aud-a3-serious.png", "assets/aud-a3-surprised.png", "assets/aud-a16-surprised.png", "assets/aud-future-kali-serious.png", "assets/aud-future-kali-surprised.png", "assets/aud-lecturenote-hecate-serious.png", "assets/aud-lecturenote-hecate-surprised.png", "assets/aud-lecturenote-jung-serious.png", "assets/aud-lecturenote-jung-surprised.png", "assets/aud-lecturenote-serona-serious.png", "assets/aud-lecturenote-serona-surprised.png", "assets/aud-past-kali-serious.png", "assets/aud-past-kali-surprised.png", "assets/aud-perfect-kali-serious.png", "assets/aud-perfect-kali-surprised.png", "assets/aud-tutorial-ndd-serious.png", "assets/aud-tutorial-ndd-surprised.png", "assets/aud-tutorial-mingiri-serious.png", "assets/aud-tutorial-mingiri-surprised.png", "assets/aud-young-kali-serious.png", "assets/aud-young-kali-surprised.png", "assets/headliner-card1412-surprised.png", "assets/headliner-h1-serious.png", "assets/headliner-h1-surprised.png", "assets/headliner-lecturenote-kim-serious.png", "assets/headliner-lecturenote-kim-surprised.png", "assets/kali-react-sad.png", "assets/kali-react-surprised.png"]);
  // v5 4b: 칼리 reacts in the equipped outfit once that skin's reaction art ships (add the skin id here with the art); others keep the default.
  const skinReactionArt = new Set(['brownknit','camera','denim','flame','guitar','hanbok','reader','redtee','wave']);
  // v5 4g: outfit cut-in strips exist for all 13 routines.
  const outfitRoutineArt = new Set(['bottles','cards','coins','coloringbook','cube','cupsballs','eggbag','rings','rope','rubberband','silk','thumbtie','wand']);
  function kaliReact(kind){const id=state.u18&&state.u18.equipped&&state.u18.equipped.kali;return id&&skinReactionArt.has(id)?`assets/kali-react-${kind}-${id}.png`:`assets/kali-react-${kind}.png`;}
  function moodSprite(host,path,mood='doubt',preferredPaths=null){
    if(!path){host.dataset.mood=mood;return;}
    path = audienceArtPath(path);
    if (preferredPaths) preferredPaths = preferredPaths.map(audienceArtPath);
    const emotes={happy:'😊',serious:'💭',surprised:'❗',sad:'💧',smug:'😏'};
    // These optional serious portraits were never shipped; use the base with its mood emote.
    const sisterSurprised = mood === 'surprised' && path === 'assets/aud-f-sister.png';
    const baseSerious = mood === 'serious' && ['assets/serona.png','assets/aud-a19.png'].includes(path);
    const paths=preferredPaths || (baseSerious ? [] : ['happy','serious','surprised','sad'].includes(mood)?[path.replace(/\.png$/,'-'+mood+'.png')]:[path]);
    if(!preferredPaths){if(mood==='surprised')paths.push(path.replace(/\.png$/,'-happy.png'));paths.push(path);}
    // Serona's three single-face portraits have no expression variants.
    if (/^assets\/serona(?:-hooded|-reveal)?\.(?:png|webp)$/.test(path)) paths.splice(0, paths.length, path);
    if(!preferredPaths)for(let i=paths.length-1;i>=0;i--)if(/-(serious|surprised|sad)\.png$/.test(paths[i])&&!shippedExpressionArt.has(paths[i])||/^assets\/kali-(?:outfit|skin)-[^/]+-happy\.png$/.test(paths[i]))paths.splice(i,1); // fixP 7: Kali's outfit and skin sheets ship no -happy face (it only 404'd before the base)
    host.dataset.mood=mood;host.dataset.emote=emotes[mood]||'';
    if(!host.classList.contains('asset-ready')){wrapGlyph(host);host.classList.remove('asset-failed');host.classList.add('asset-pending');} // v4 U49 3: nothing (not the emoji) while the first face loads
    const gen=nextArt(host); // v4 U49b 2: a newer request (another audience with the same mood, or any sprite call) makes this chain stale
    const attempt=i=>{if(host._artGen!==gen||host.dataset.mood!==mood)return;const source=assetImage(paths[i]);
      const ready=()=>{if(host._artGen!==gen||host.dataset.mood!==mood)return;if(source.naturalWidth){sprite(host,paths[i]);host.dataset.emote=i===0&&paths[i]!==path&&mood!=='smug'&&!baseSerious&&!sisterSurprised?'':emotes[mood]||'';}else if(i+1<paths.length)attempt(i+1);else if(!host.classList.contains('asset-ready'))failedArt(host);};
      if(source.complete)ready();else{source.addEventListener('load',ready,{once:true});source.addEventListener('error',ready,{once:true});}
    };attempt(0);
  }
  function happySprite(host, path) {
    sprite(host, path);
    const happy = U5.happyPortraitPath(path);
    if (happy === path) return;
    if (!happyCache.has(happy)) {
      happyCache.set(happy, new Promise(resolve => {
        const image = new Image();
        image.onload = () => { assetCache.set(happy, image); resolve(true); };
        image.onerror = () => resolve(false);
        image.src = happy;
      }));
    }
    happyCache.get(happy).then(ok => { if (ok && host.dataset.asset === path) sprite(host, happy); });
  }
  const endingText = d => {
    const item = D.dimensions[d - 1];
    const ending = item ? item.ending : D.genericEnding;
    return { title: ending.title.replaceAll('{d}', String(d)), body: ending.body.replaceAll('{d}', String(d)) };
  };

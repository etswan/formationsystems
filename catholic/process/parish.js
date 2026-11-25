/* The Parish as Process: an agent-based parish with processual rules. Model developed by Emma T. Swan.
   People are individuals, as on the autopoietic page, and the calibrated rates of baptism, reception, slipping, returning,
   leaving, moving and death carry over from it. What changes is the organization:
   - practice is a continuous degree of participation x in [0, 1] that drifts toward regular or occasional practice;
   - groups are gatherings: places on the sphere where people come together, which grow, fade, dissolve, re-form,
     and arise from the overlap of others (the adjacent possible);
   - each person and each gathering carries a yearly rhythm, pulled toward the liturgical year and toward one another;
   - leadership is carried from within each gathering by its committed members; only the pastor comes from outside.
   One step is one week; the model year is 52 weeks (364 days) beginning at Advent. */
(function (root) {
'use strict';
const K = { decay: .00274, infant: .0074, adult: .0013, inq: 1.4, inqDrop: .010, famShare: .22, joinOcc: .3, parent: .32,
  moveIn: .021, moveOut: .010, leave: .0095, leaveAge: [0, 1.0, 2.2, .8, .35], slip: .13, retR: .018, retC: .026, marry: .05, tauX: 60 };
const R0 = .78;
const band = a => a < 13 ? 0 : a < 20 ? 1 : a < 36 ? 2 : a < 61 ? 3 : 4;
const qDeath = a => a < 13 ? .0002 : a < 20 ? .0005 : a < 36 ? .0012 : a < 61 ? .0045 : a < 76 ? .02 : a < 86 ? .06 : .16;
// kinds of gathering: functions they carry for the parish, joining rates by age band (as on the autopoietic page)
const KINDS = {
  fam: { n: 'Family faith formation', col: '#3f8f62', sun: 0, cal: 1, drift: .35 }, ocia: { n: 'OCIA', col: '#8a6dc2', sun: 0, cal: 1, drift: -.25 },
  choir: { n: 'Choir', col: '#c9962e', sun: .15, cal: .8, drift: .15 }, ya: { n: 'Young adults', col: '#d0679a', sun: 0, cal: 1, drift: .55 },
  bible: { n: 'Bible study', col: '#2f7fb8', sun: .06, cal: .5, drift: -.1 }, service: { n: 'Service ministry', col: '#2f8c94', sun: 0, cal: 1, drift: -.45 },
  sick: { n: 'Ministry to the sick', col: '#b8576d', sun: 0, cal: 1, drift: .2 }, school: { n: 'Parish school', col: '#7a8a2e', sun: 0, cal: 1, drift: .6 },
  rel: { n: 'Religious community', col: '#6b5aa6', sun: 0, cal: 1, drift: 0 } };
const JOIN = [[['fam', 1], ['school', .35]], [['fam', .45], ['choir', .08], ['service', .06]],
  [['ya', .35], ['service', .1], ['choir', .08], ['bible', .06], ['fam', .1]],
  [['fam', .3], ['bible', .15], ['service', .15], ['choir', .07], ['sick', .05]], [['bible', .18], ['sick', .1], ['service', .08], ['choir', .08]]];
const PAIR = { 'fam+bible': 'Family Scripture evenings', 'fam+service': 'Families serving together', 'fam+choir': 'Family choir', 'fam+sick': 'Families visiting the homebound',
  'fam+school': 'School and home catechesis', 'fam+ya': 'Young families group', 'ocia+bible': 'Mystagogy circle', 'ocia+service': 'Converts in service',
  'choir+bible': 'Lectio and chant', 'choir+service': 'Music ministry to the poor', 'choir+sick': 'Music at the bedside', 'choir+ya': 'Young adult schola',
  'ya+bible': 'Young adult Lectio', 'ya+service': 'Young adult service corps', 'ya+sick': 'Young adults with the elderly', 'bible+service': 'Word and works',
  'bible+sick': 'Scripture with the sick', 'service+sick': 'Works of mercy guild' };
const EVENTS = {
  relic: { n: 'Relic tour', r: .55, s: .55, ed: .035, inq: .0012, aud: m => (m.age >= 61 ? 1.3 : 1) * (m.tgt ? .8 : 1.3) },
  papal: { n: 'Papal visit', r: 9, s: .8, ed: .02, inq: .004, aud: () => 1 },
  choir: { n: 'Visiting choir', r: .52, s: .45, ed: .04, inq: .0015, aud: m => m.gs.some(g => g.kinds.includes('choir')) ? 1.4 : 1 },
  wyd: { n: 'World Youth Day', r: 9, s: .85, ed: .025, inq: .002, young: true, aud: m => m.band === 1 || m.band === 2 ? 1 : .12 },
  proc: { n: 'Eucharistic procession', r: .55, s: .5, ed: .035, inq: .001, bond: .04, aud: () => 1 } };
function rng(seed) { let x = seed % 2147483647; if (x <= 0) x += 2147483646; return () => (x = x * 16807 % 2147483647) / 2147483647; }
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
const slerp = (a, b, t) => norm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);

class Parish {
  constructor(opt = {}) {
    this.rnd = rng((opt.seed || 11) * 7919 + 17); this.seed = opt.seed || 11;
    this.day = 83; this.week = 0; this.members = []; this.gs = []; this.ghosts = []; this.log = []; this.hist = []; this.yr = this.newYear();
    this.pastor = true; this.wait = 0; this.p = { pan: 0, scan: 0, closed: 0, cal: 0, short: 0, rhythm: 0 }; this.rec = 0;
    this.bap = 1; this.rev = 0; this.digital = 1; this.climate = 1; this.inq = []; this.pend = []; this.R = 1; this.F = 1; this.Ed = .03; this.arisen = 0; this.nextId = 1;
    this.init(opt.N || 600);
  }
  newYear() { return { infant: 0, adult: 0, deaths: 0, left: 0, movedIn: 0, movedOut: 0, marriages: 0, slipped: 0, returned: 0, arose: 0, dissolved: 0 }; }
  on(k) { return this.p[k] > 0; }
  note(t) { this.log.unshift({ t, day: this.day }); if (this.log.length > 14) this.log.length = 14; }
  live() { return this.members; }

  /* ---------------------------------------------------------------- gatherings */
  addGathering(kinds, pos, name, opt = {}) {
    const g = { id: this.nextId++, kinds, n: name || KINDS[kinds[0]].n, pos: norm(pos), L: opt.L || .8, phase: opt.phase || (this.rnd() - .5) * .3, members: 0,
      drift: kinds.reduce((t, k) => t + KINDS[k].drift, 0) / kinds.length, born: this.day, base: !!opt.base, low: 0, dormant: 0, removed: false, col: kinds.length > 1 ? '#2f8c94' : KINDS[kinds[0]].col, coh: 1 };
    this.gs.push(g); return g;
  }
  state(g) { return g.removed ? 'removed' : g.L < .22 ? 'dormant' : this.on('pan') && !g.kinds.includes('rel') ? (g.kinds.length === 1 && g.kinds[0] === 'choir' ? 'paused' : 'online') : 'meeting'; }
  active(g) { const s = this.state(g); return s === 'meeting' || s === 'online'; }
  kindLevel(k) { let t = 0; for (const g of this.gs) if (!g.removed && g.kinds.includes(k)) { const s = this.state(g); t = Math.max(t, (s === 'meeting' ? 1 : s === 'online' ? .6 : 0) / (g.kinds.length > 1 ? 1.6 : 1)); } return t; }
  kindState(k) { let best = 'none'; for (const g of this.gs) if (!g.removed && g.kinds.includes(k)) { const s = this.state(g); if (s === 'meeting') return 'meeting'; if (s === 'online') best = 'online'; else if (best === 'none') best = s; } return best; }
  /* draw a person's gatherings, as assignGroups does: offered kinds in order, joined at the band's rates, up to two; among gatherings
     of a kind the nearest is likelier */
  assign(m) {
    m.gs = [];
    if (m.rel) { const r = this.gs.find(g => g.kinds.includes('rel') && !g.removed); if (r) m.gs = [r]; return; }
    const offers = JOIN[m.band].slice();
    for (const g of this.gs) if (!g.base && !g.removed && g.kinds.length > 1) { const q = g.kinds.map(k => (offers.find(o => o[0] === k) || [0, 0])[1]); if (q[0] && q[1]) offers.push([g, .25 * (q[0] + q[1])]); }
    for (const [k, q] of offers) {
      if (m.gs.length >= 2) break;
      if (k === 'fam' && m.band >= 2 && (m.age < 24 || m.age > 52)) continue;
      const qq = q * (m.kid || m.band < 2 ? 1 : m.tgt ? 1 : K.joinOcc);
      if (this.rnd() >= qq) continue;
      let cand = typeof k === 'string' ? this.gs.filter(g => !g.removed && g.kinds.length === 1 && g.kinds[0] === k) : [k];
      cand = cand.filter(g => !m.gs.includes(g)); if (!cand.length) continue;
      let best = cand[0], bw = -1; for (const g of cand) { const w = Math.exp(-ang(g.pos, m.pos) / .6) * (this.active(g) ? 1 : .3) + 1e-6 * this.rnd(); if (w > bw) { bw = w; best = g; } }
      m.gs.push(best); m.since = m.since || {}; m.since[best.id] = this.day;
    }
  }
  /* ---------------------------------------------------------------- people */
  person(o) {
    const m = Object.assign({ id: this.nextId++, age: 30, b: .5, x: .3, tgt: 0, convert: false, kid: false, rel: false, parent: null, fd: 0, cd: 0, married: false,
      e: 0, ed: .03, gs: [], since: {}, recv: -1e9, aR: .5 + this.rnd() * .3, aO: .02 + this.rnd() * .1, ph: (this.rnd() - .5) * .6, drift: (this.rnd() - .5) * .8,
      pos: norm([this.rnd() - .5, this.rnd() - .5, this.rnd() - .5]), off: [this.rnd() - .5, this.rnd() - .5, this.rnd() - .5], born: this.day, glow: 0 }, o);
    m.band = band(m.age); if (m.age < 20 && o.kid === undefined && !m.rel) m.kid = true;
    m.c = this.rnd() < (m.tgt ? (m.convert ? .88 : .8) : (m.convert ? .3 : .08));
    this.members.push(m); return m;
  }
  practise(m, conv, pr) { m.tgt = this.rnd() < (pr !== undefined ? pr : conv ? .45 : .30) ? 1 : 0; m.x = m.tgt ? .75 + .2 * this.rnd() : .1 + .15 * this.rnd(); m.c = this.rnd() < (m.tgt ? (m.convert ? .88 : .8) : (m.convert ? .3 : .08)); }
  flip(m, t) { m.tgt = t; m.c = this.rnd() < (t ? (m.convert ? .88 : .8) : (m.convert ? .3 : .08)); if (!m.kid && !m.rel) this.assign(m); }
  attendP(m) { if (m.kid) return m.parent && m.parent.alive !== false && this.members.includes(m.parent) ? Math.max(.1, .95 * (m.parent.aO + (m.parent.aR - m.parent.aO) * m.parent.x)) : .25; return m.rel ? 1 : m.aO + (m.aR - m.aO) * m.x; }

  init(N) {
    const fib = (i, n) => { const y = 1 - 2 * (i + .5) / n, r = Math.sqrt(1 - y * y), t = i * 2.399963; return [r * Math.cos(t), y, r * Math.sin(t)]; };
    ['fam', 'ocia', 'choir', 'ya', 'bible', 'service', 'sick', 'school', 'rel'].forEach((k, i) => this.addGathering([k], fib(i, 9), null, { base: true }));
    const sampleAge = () => { const u = this.rnd(); if (u < .15) return this.rnd() * 13; if (u < .22) return 13 + this.rnd() * 5; const v = this.rnd() * 98;
      return v < 14 ? 18 + this.rnd() * 12 : v < 41 ? 30 + this.rnd() * 20 : v < 70 ? 50 + this.rnd() * 15 : 65 + Math.pow(this.rnd(), 1.6) * 30; };
    for (let i = 0; i < N; i++) {
      const conv = this.rnd() < .08, age = sampleAge(), m = this.person({ age, convert: conv, married: age > 35 });
      if (m.kid) { m.c = age > 9 && this.rnd() < .5; m.cd = age * 364; } else this.practise(m, conv);
      this.assign(m);
      if (m.kid) m.fd = m.cd * (m.gs.some(g => g.kinds.includes('fam') || g.kinds.includes('school')) ? .85 : .3);
      m.b = Math.min(1, .1 + .85 * (m.kid ? .25 : this.attendP(m)) + .15 * m.gs.length + this.rnd() * .1);
      if (m.gs.length) m.pos = slerp(m.gs[0].pos, m.pos, .35 + .3 * this.rnd());
      for (const g of m.gs) m.since[g.id] = this.day - this.rnd() * Math.min(15, Math.max(0, age - 18)) * 364;
    }
    const adults = this.members.filter(m => !m.kid);
    for (const k of this.members) if (k.kid) { const c = adults.filter(p => p.age >= k.age + 20 && p.age <= k.age + 45); k.parent = c[Math.floor(this.rnd() * c.length)] || null; if (k.parent) k.pos = slerp(k.parent.pos, k.pos, .15); }
    const rg = this.gs.find(g => g.kinds[0] === 'rel');
    for (let i = 0; i < 4; i++) { const m = this.person({ rel: true, age: 40 + this.rnd() * 40, x: 1, tgt: 1, b: .9, pos: slerp(rg.pos, [this.rnd() - .5, this.rnd() - .5, this.rnd() - .5], .12) }); m.c = true; m.gs = [rg]; }
    for (let i = 0; i < Math.round(N * .004); i++) this.inq.push({ cat: true, age: 22 + this.rnd() * 20, wait: 60, b: .4 });
    for (let i = 0; i < 3; i++) this.inq.push({ cat: false, age: 20 + this.rnd() * 25, wait: 0, b: .25 });
    this.counts();
  }
  counts() { for (const g of this.gs) g.members = 0; for (const m of this.members) for (const g of m.gs) g.members++; for (const g of this.gs) if (g.kinds.includes('ocia')) g.members += this.inq.filter(q => q.cat).length; }

  /* ---------------------------------------------------------------- one week */
  step() {
    this.day += 7; this.week++;
    const d0 = (this.day - 6) % 364, ds = []; for (let i = 0; i < 7; i++) ds.push((this.day - 6 + i) % 364);
    const has = d => ds.includes(d), pan = this.on('pan'), scan = this.on('scan'), closed = this.on('closed'), calOff = this.on('cal');
    const recov = pan ? .6 : this.rec > 0 ? .6 + .4 * (1 - this.rec / 364) : 1; this.rec = Math.max(0, this.rec - 7);
    const L = this.members, N = L.length;
    // leadership carried from within: committed, well-bonded members formed in the gathering for two years or more
    const carriers = new Map(); for (const g of this.gs) carriers.set(g, 0);
    for (const m of L) if (!m.kid && m.tgt && m.b > .6) for (const g of m.gs) if (this.day - (m.since[g.id] || this.day) >= 728) carriers.set(g, carriers.get(g) + 1);
    for (const g of this.gs) {
      if (g.removed) continue;
      g.L = Math.max(0, g.L - .042);
      if (g.kinds.includes('rel')) { if (this.rels() >= 2) g.L = Math.min(1, g.L + 7 * (closed ? .0052 : .02)); continue; }
      const lc = Math.min(1, .25 + .75 * Math.min(1, carriers.get(g) / 2) + (this.pastor ? .15 : 0));
      const s = this.state(g);
      if (s === 'dormant') { if (!closed) g.L += .05 * lc; }
      else if (s === 'meeting' || s === 'online') g.L = Math.min(1, g.L + (s === 'meeting' ? 1 : .5) * .12 * (closed ? .22 + .028 * Math.min(8, this.gs.indexOf(g)) : 1) * lc);
      g.carriers = carriers.get(g);
    }
    this.rhythm(calOff);
    const rf = (.7 + .3 * this.R) / (.7 + .3 * R0), Rr = Math.min(1.05, this.R / R0);   // 1 at the baseline coherence R0
    // liturgy, spiritual accompaniment (carried by young adult and religious gatherings), pressures
    let lit = 1; for (const k of ['choir', 'bible']) if (this.kindLevel(k) < .5) lit -= KINDS[k].sun; lit *= (calOff ? .9 : 1) * (1 + .15 * this.rev);
    const sd = (Math.min(1, this.kindLevel('ya')) + Math.min(1, this.kindLevel('rel')) * (this.rels() >= 2 ? 1 : 0)) / 2; const F = Math.max(0, Math.min(1, sd / .8)); this.F = F;
    const pf = this.pastor ? 1 : .6, fdec = Math.pow(1 - K.decay, 7);
    const feast = !calOff && (has(28) || has(133)), lent = !calOff && ds.some(d => d >= 91 && d < 133 && d % 7 === 3);
    const weak = k => { const s = this.kindState(k); return s === 'meeting' ? 1 : s === 'online' ? 1.2 : 1.6; };
    const famW = weak('fam'), yaW = weak('ya'), oS = this.kindState('ocia'), ociaW = oS === 'meeting' ? .7 : oS === 'online' ? 1 : 1.3;
    const base = (scan ? 1.5 : 1) * (pan ? 1.3 : 1) * (closed ? 1.2 : 1) * (this.pastor ? 1 : 1.2);
    let mb = 0; for (const m of L) mb += m.b; mb /= N || 1;
    const parents = new Set(); for (const m of L) if (m.kid && m.parent) parents.add(m.parent);
    const sick = this.kindLevel('sick'), active = new Map(this.gs.map(g => [g, this.state(g)]));
    let att = 0, el = 0;
    for (const m of L) {
      m.age += 7 / 364;
      if (m.e > 0) { m.e *= Math.pow(1 - m.ed, 7); if (m.e < .005) m.e = 0; }
      m.b *= fdec;
      // Sunday
      const p = Math.min(.97, this.attendP(m) * recov * (scan ? .85 : 1) * (m.age >= 85 ? .35 : 1) * (1 + 1.5 * m.e));
      el++;
      if (this.rnd() < p) { att++; m.lastAt = this.day; m.b = Math.min(1, m.b + ((m.c && !m.kid) || (m.kid && m.age > 13 && m.c) ? .012 : .008) * pf * lit * rf + .004 * m.e); m.beat = 1; }
      else if (pan && this.attendP(m) > .3) m.b = Math.min(1, m.b + .003);
      if (feast && this.rnd() < Math.min(.95, (.25 + this.attendP(m) * 2.5) * recov)) { m.b = Math.min(1, m.b + .03 * Rr); if (!m.kid && !m.tgt && this.rnd() < .02) { this.flip(m, 1); this.yr.returned++; } }
      for (const g of m.gs) { const s = active.get(g); if (s === 'meeting' || s === 'online') { m.b = Math.min(1, m.b + (s === 'meeting' ? .008 : .004) * (calOff && g.kinds.length === 1 ? KINDS[g.kinds[0]].cal : 1) * rf + (s === 'meeting' ? .01 : .005) * m.e); m.lastAt = this.day; } }
      if (m.age >= 80 && sick) m.b = Math.min(1, m.b + .008 * sick);
      if (m.rel && this.rels() >= 2) m.b = Math.min(1, m.b + .0105);
      if ((lent || scan) && this.pastor && this.attendP(m) > .3 && m.b < .5) m.b += .01;
      // childhood formation and coming of age
      if (m.kid) {
        m.cd += 7; const fg = m.gs.find(g => g.kinds.includes('fam') || g.kinds.includes('school')); const s = fg ? active.get(fg) : null; if (s === 'meeting') m.fd += 7; else if (s === 'online') m.fd += 4.2;
        if (m.age >= 20) { const f = m.cd ? m.fd / m.cd : .5, pr = m.parent && this.members.includes(m.parent) && m.parent.tgt ? 1 : 0; m.kid = false; this.practise(m, false, .04 + .22 * f + K.parent * pr); this.assign(m); }
      }
      const nb = band(m.age); if (nb !== m.band) { m.band = nb; if (nb === 1 && m.kid) m.c = this.rnd() < .5; if (!m.rel) this.assign(m); }
      // practice: the target flips at the calibrated hazards; participation x moves toward it continuously
      if (!m.kid && !m.rel) {
        if (m.tgt) {
          let s = K.slip * (1 - .6 * m.e * (m.gs.length ? 1 : .4)) * base * (1.35 - .35 * F) * Math.min(2.5, Math.max(.4, (1 - m.b) / .5));
          if (m.convert) { s *= (1 - .35 * this.rev) * (1.3 - .3 * F); if (this.day - m.recv < 1092) s *= ociaW; } else { s *= 1 - .1 * this.rev; if (parents.has(m)) s *= famW; }
          if (m.band === 2) s *= yaW;
          if (this.rnd() < s / 52) { this.flip(m, 0); this.yr.slipped++; }
        } else {
          const held = m.gs.some(g => active.get(g) === 'meeting') ? 1 : .3;
          const r = (1 + 8 * m.e * held * (closed ? .4 : 1)) * (m.convert ? K.retC * (1 + .35 * this.rev) : K.retR * (1 + .1 * this.rev)) * (.7 + .3 * F) * Math.min(1.5, Math.max(.5, mb / .5)) * (scan ? .7 : 1);
          if (this.rnd() < r / 52) { this.flip(m, 1); this.yr.returned++; }
        }
        m.x += (m.tgt - m.x) * (1 - Math.exp(-7 / K.tauX));
        if (m.e > .2 && m.gs.length < 2 && this.rnd() < .05 * .6 * m.e * (closed ? .25 : 1)) {
          const opts = this.gs.filter(g => !g.removed && active.get(g) === 'meeting' && g.L > .4 && !m.gs.includes(g) && !g.kinds.includes('fam') && !g.kinds.includes('rel') && !g.kinds.includes('school') && !g.kinds.includes('ocia'));
          if (opts.length) { opts.sort((a, b) => ang(a.pos, m.pos) - ang(b.pos, m.pos)); const g = opts[Math.floor(this.rnd() * Math.min(3, opts.length))]; m.gs.push(g); m.since[g.id] = this.day; }
        }
      }
      // people drift on the sphere toward the gatherings they take part in, children near their parents
      const tgts = m.gs.filter(g => active.get(g) !== 'removed');
      if (tgts.length) { const c0 = tgts.reduce((t, g) => [t[0] + g.pos[0], t[1] + g.pos[1], t[2] + g.pos[2]], [0, 0, 0]), l = Math.hypot(...c0) || 1, sp = .28 + .08 * tgts.length;
        const c = norm([c0[0] / l + m.off[0] * sp, c0[1] / l + m.off[1] * sp, c0[2] / l + m.off[2] * sp]); m.pos = slerp(m.pos, c, .06 * (.3 + m.x)); }
      else if (m.kid && m.parent) m.pos = slerp(m.pos, m.parent.pos, .05);
      else m.pos = norm([m.pos[0] + (this.rnd() - .5) * .02, m.pos[1] + (this.rnd() - .5) * .02, m.pos[2] + (this.rnd() - .5) * .02]);
    }
    this.att = el ? att / el : 0; this.attW = (this.attW || []); this.attW.push(this.att); if (this.attW.length > 52) this.attW.shift();
    // gatherings drift toward their members; they repel each other a little so that they stay distinct
    const sums = new Map(this.gs.map(g => [g, [0, 0, 0]]));
    for (const m of L) for (const g of m.gs) { const s = sums.get(g); s[0] += m.pos[0]; s[1] += m.pos[1]; s[2] += m.pos[2]; }
    for (const g of this.gs) { if (g.removed) continue; const s = sums.get(g); if (Math.hypot(...s) > 0) g.pos = slerp(g.pos, norm(s), .02);
      for (const h of this.gs) if (h !== g && !h.removed) { const a = ang(g.pos, h.pos); if (a < .45) g.pos = norm([g.pos[0] + (g.pos[0] - h.pos[0]) * .02, g.pos[1] + (g.pos[1] - h.pos[1]) * .02, g.pos[2] + (g.pos[2] - h.pos[2]) * .02]); } }
    this.marriages(pan); this.vigil(has(133) && !calOff); this.inquirers(N, mb, scan, pan, closed); this.births(pan); this.moves(N); this.exits(scan);
    // the pastor
    if (this.pastor && this.rnd() < 7 / (364 * 14)) { this.pastor = false; this.wait = this.on('short') ? 365 : 120; this.note('The pastor retires. The parish waits for a priest to be assigned.'); }
    if (!this.pastor && (this.wait -= 7) <= 0) { this.pastor = true; this.note('A new pastor is assigned.'); }
    for (const k in this.p) if (this.p[k] > 0 && this.p[k] !== Infinity) { this.p[k] = Math.max(0, this.p[k] - 7); if (this.p[k] === 0) { if (k === 'pan') this.rec = 364; if (k === 'closed') for (const g of this.gs) g.L = Math.max(g.L, .3); } }
    this.counts(); this.lifecycle(); this.possibles();
    if (ds.includes(0)) { this.yr.att = this.attW.reduce((t, x) => t + x, 0) / this.attW.length; Object.assign(this.yr, this.metrics()); this.hist.unshift(this.yr); if (this.hist.length > 60) this.hist.length = 60; this.yr = this.newYear(); this.bap = 1; if (this.rels() < 4 && !this.on('short')) { const rg = this.gs.find(g => g.kinds[0] === 'rel' && !g.removed); if (rg) { const m = this.person({ rel: true, age: 30, x: 1, tgt: 1, b: .8, pos: rg.pos }); m.c = true; m.gs = [rg]; } } }
    if (this.week % 2 === 0) this.track();
  }
  rels() { let n = 0; for (const m of this.members) if (m.rel) n++; return n; }

  /* rhythm (hypothesis): each gathering and each person has a yearly cycle, pulled toward the liturgical year by the shared calendar
     and Sunday practice, toward one's gatherings, and gatherings toward each other through shared members */
  rhythm(calOff) {
    const dt = 7 / 364, kick = this.on('rhythm');
    const Kc = (calOff ? 0 : 2.4) * (kick ? .25 : 1) * (this.pastor ? 1 : .7);
    for (const g of this.gs) {
      if (g.removed || this.state(g) === 'dormant') continue;
      const act = this.state(g) === 'meeting' ? 1 : .6;
      g.phase += dt * (g.drift - Kc * act * Math.sin(g.phase) + (this.rnd() - .5) * (kick ? 3 : .6)); g.phase = Math.atan2(Math.sin(g.phase), Math.cos(g.phase));
      g.cx = 0; g.cy = 0; g.cn = 0;
    }
    let cx = 0, n = 0;
    for (const m of this.members) {
      let pull = -(calOff ? 0 : 1.6) * (kick ? .25 : 1) * m.x * Math.sin(m.ph);
      for (const g of m.gs) if (!g.removed && this.state(g) !== 'dormant') pull += 2.0 * Math.sin(g.phase - m.ph);
      m.ph += dt * (m.drift + pull + (this.rnd() - .5) * (kick ? 4 : .8)); m.ph = Math.atan2(Math.sin(m.ph), Math.cos(m.ph));
      for (const g of m.gs) if (g.cn !== undefined) { g.cx += Math.cos(m.ph - g.phase); g.cy += Math.sin(m.ph - g.phase); g.cn++; }
      if (!m.kid) { cx += Math.cos(m.ph) * (.3 + m.x); n += .3 + m.x; }
    }
    for (const g of this.gs) g.coh = g.cn ? Math.hypot(g.cx, g.cy) / g.cn : 0;
    this.R = n ? Math.max(0, cx / n) : 0;
  }
  /* the adjacent possible: pairs of gatherings whose committed members overlap; a possible gathering brightens with the overlap and may arise */
  possibles() {
    const pairs = new Map();
    for (const m of this.members) if (m.gs.length === 2 && m.tgt && m.b > .6 && !m.kid) {
      const [a, b] = m.gs; if (a.removed || b.removed || a.kinds.includes('rel') || b.kinds.includes('rel') || a.kinds.includes('ocia') || b.kinds.includes('ocia')) continue;
      const key = Math.min(a.id, b.id) + '-' + Math.max(a.id, b.id); pairs.set(key, (pairs.get(key) || { a, b, n: 0 })); pairs.get(key).n++;
    }
    const live = this.gs.filter(g => !g.removed && !g.base).length;
    this.ghosts = [...pairs.values()].filter(p => p.n >= 1 && !this.gs.some(g => !g.removed && g.from === p.a.id + '-' + p.b.id) && p.a.kinds.length + p.b.kinds.length === 2)
      .map(p => ({ a: p.a, b: p.b, n: p.n, pos: slerp(p.a.pos, p.b.pos, .5), name: PAIR[p.a.kinds[0] + '+' + p.b.kinds[0]] || PAIR[p.b.kinds[0] + '+' + p.a.kinds[0]] || `A circle from ${p.a.n.toLowerCase()} and ${p.b.n.toLowerCase()}` }))
      .sort((x, y) => y.n - x.n).slice(0, 6);
    if (live >= 4) return;
    for (const gh of this.ghosts) { if (gh.n >= 2 && this.rnd() < .006 * gh.n * 7 / 364 * 2) { this.arise(gh); break; } }
    // a kind that has vanished can form again where enough people would take part in it (only by recombination of the living parish)
    for (const k of ['fam', 'choir', 'ya', 'bible', 'service', 'sick']) {
      if (this.gs.some(g => !g.removed && g.kinds.includes(k))) continue;
      let pot = 0; for (const m of this.members) if (!m.kid && m.tgt && m.b > .6 && JOIN[m.band].some(o => o[0] === k)) pot++;
      if (pot >= 8 && this.rnd() < .15 * 7 / 364 * pot / 8) { const g = this.addGathering([k], [this.rnd() - .5, this.rnd() - .5, this.rnd() - .5], KINDS[k].n, { L: .6 }); g.reformed = true; this.yr.arose++; this.recruit(g, .5); this.note(`${g.n} has formed again among people who wanted it.`); }
    }
  }
  arise(gh, forced) {
    const g = this.addGathering([...new Set([...gh.a.kinds, ...gh.b.kinds])], gh.pos, gh.name, { L: .8, phase: Math.atan2(Math.sin(gh.a.phase) + Math.sin(gh.b.phase), Math.cos(gh.a.phase) + Math.cos(gh.b.phase)) });
    g.from = gh.a.id + '-' + gh.b.id; this.arisen++; this.yr.arose++;
    this.recruit(g, 1);
    this.note(`${forced ? 'A new practice emerges' : 'A new form of gathering has arisen'}: ${g.n}, from members of ${gh.a.n.toLowerCase()} and ${gh.b.n.toLowerCase()}.`);
    return g;
  }
  recruit(g, scale) {
    for (const m of this.members) {
      if (m.kid || m.rel || m.gs.length >= 2 || m.gs.includes(g)) continue;
      const q = g.kinds.map(k => (JOIN[m.band].find(o => o[0] === k) || [0, 0])[1]); if (!q.some(x => x)) continue;
      const shared = m.gs.some(h => g.kinds.some(k => h.kinds.includes(k))) ? 3 : 1;
      if (this.rnd() < scale * .25 * (q[0] + (q[1] || 0)) * shared * (m.tgt ? 1 : K.joinOcc)) { m.gs.push(g); m.since[g.id] = this.day; }
    }
  }
  lifecycle() {
    for (const g of this.gs) {
      if (g.removed || g.kinds.includes('rel')) continue;
      g.dormant = this.state(g) === 'dormant' ? g.dormant + (this.on('pan') ? 0 : 7) : 0;
      g.low = g.members < 3 && !g.kinds.includes('ocia') ? g.low + 7 : 0;
      if (g.dormant > 1092 || g.low > 182) this.dissolve(g, g.dormant > 1092 ? 'it lay dormant for three years' : 'too few were left to carry it');
    }
  }
  dissolve(g, why) {
    g.removed = true; g.L = 0; this.yr.dissolved++;
    for (const m of this.members) if (m.gs.includes(g)) { m.gs = m.gs.filter(h => h !== g); if (this.rnd() < .5 && !m.rel) this.assign(m); }
    if (why) this.note(`${g.n} has dissolved: ${why}.`);
  }
  marriages(pan) {
    const yaOn = this.kindState('ya') === 'meeting';
    for (const m of this.members) if (!m.married && !m.rel && m.age >= 24 && m.age < 36 && this.rnd() < K.marry * (yaOn ? 1.2 : .9) * (pan ? .5 : 1) * 7 / 364) { m.married = true; this.yr.marriages++; if (!m.tgt && this.rnd() < .2) { this.flip(m, 1); this.yr.returned++; } }
  }
  vigil(on) {
    if (!on) return; let n = 0;
    for (const q of this.inq) if (q.cat && q.wait > 40 && this.rnd() < this.bap) {
      q.done = true; const m = this.person({ age: q.age, convert: true, recv: this.day, b: Math.max(q.b, .6) }); this.practise(m, true); m.b = Math.max(q.b, .6); this.assign(m);
      const og = this.gs.find(g => g.kinds.includes('ocia') && !g.removed); if (og) m.pos = slerp(og.pos, m.pos, .3); n++; this.yr.adult++;
    }
    this.inq = this.inq.filter(q => !q.done);
    if (n) this.note(`Easter Vigil: ${n === 1 ? 'one adult' : n + ' adults'} received.`);
  }
  inquirers(N, mb, scan, pan, closed) {
    const oS = this.kindState('ocia'), on = oS === 'meeting' || oS === 'online';
    let ya = 0; for (const m of this.members) if (m.band === 2) ya++;
    const w = .40 * Math.min(2, mb / .45) * (closed ? .5 : 1) + .25 * Math.min(2, ya / N / .15) * (this.kindState('ya') === 'meeting' ? 1.2 : .8) + .25 * this.digital + .10 * (this.kindState('choir') === 'meeting' ? 1 : .5) * (1 + .8 * this.rev);
    const rate = N * K.adult * K.inq * this.climate * w * (scan ? .6 : 1) * (pan ? .6 : 1) * (this.kindState('service') === 'meeting' ? 1 : .85) * 7 / 364;
    let k = rate; while (this.rnd() < k) { this.inq.push({ cat: false, age: 19 + Math.pow(this.rnd(), 1.4) * 40, wait: 0, b: .25 }); k -= 1; }
    for (const q of this.pend) { let n = q.left * Math.min(1, 7 / Math.max(7, q.days)); while (n > 0) { if (this.rnd() < Math.min(1, n)) { this.inq.push({ cat: false, age: q.young ? 17 + this.rnd() * 15 : 19 + Math.pow(this.rnd(), 1.4) * 45, wait: 0, b: .3 }); q.left--; } n -= 1; } q.days -= 7; }
    this.pend = this.pend.filter(q => q.days > 0 && q.left > .5);
    for (const q of this.inq) {
      q.wait += 7; q.age += 7 / 364;
      if (!q.cat) { const pc = on ? 1 - Math.pow(1 - .015, 7) : 0; if (this.rnd() < pc) { q.cat = true; q.wait = 0; q.b = .4; } else if (q.wait > 250 || this.rnd() < 1 - Math.pow(1 - K.inqDrop, 7)) q.gone = true; }
      else if (!on && this.rnd() < .014) q.gone = true;
    }
    this.inq = this.inq.filter(q => !q.gone);
  }
  births(pan) {
    const fam = this.members.filter(m => m.age >= 22 && m.age <= 42 && !m.rel && !m.kid), n = fam.length;
    const fs = this.kindState('fam'), famF = fs === 'meeting' ? 1 : fs === 'online' ? .8 : .45;
    const rate = n * (K.infant / K.famShare) * famF * this.bap * (pan ? .85 : 1) * (this.kindState('school') === 'meeting' ? 1.05 : 1) * 7 / 364;
    let k = rate; while (n && this.rnd() < k) { k -= 1;
      const par = fam[Math.floor(this.rnd() * n)], m = this.person({ age: 0, b: .5, parent: par, pos: slerp(par.pos, [this.rnd() - .5, this.rnd() - .5, this.rnd() - .5], .05) });
      this.assign(m); this.yr.infant++; if (!par.tgt && this.rnd() < .2) { this.flip(par, 1); this.yr.returned++; } }
  }
  moves(N) {
    let k = N * K.moveIn * 7 / 364;
    while (this.rnd() < k) { k -= 1;
      const ag = 22 + this.rnd() * 36, m = this.person({ age: ag, b: .35, married: this.rnd() < .6 }); this.practise(m, false); this.assign(m); this.yr.movedIn++;
      if (ag > 27 && ag < 46 && this.rnd() < .5) { const ka = this.rnd() * 12, c = this.person({ age: ka, b: .35, parent: m, cd: ka * 364, pos: m.pos }); c.fd = c.cd * .6; this.assign(c); this.yr.movedIn++; } }
  }
  exits(scan) {
    const keep = [];
    for (const m of this.members) {
      if (this.rnd() < qDeath(m.age) * 7 / 364) { this.yr.deaths++; continue; }
      if (m.rel) { keep.push(m); continue; }
      if (this.rnd() < K.moveOut * 7 / 364) { this.yr.movedOut++; continue; }
      if (this.rnd() < K.leave * K.leaveAge[m.band] * Math.min(4, Math.pow((1 - m.b) / .6, 2)) * (scan ? 1.8 : 1) * 7 / 364) { this.yr.left++; continue; }
      keep.push(m);
    }
    this.members = keep;
  }

  /* ---------------------------------------------------------------- what visitors and perturbations do */
  /* an event lands at a point on the sphere; its reach is an angle (papal visits and World Youth Day reach everyone) */
  event(key, at) {
    const E = EVENTS[key]; at = at ? norm(at) : this.members.length ? this.members[0].pos : [0, 1, 0]; let reached = 0;
    for (const m of this.members) {
      if (m.rel) continue; const a = ang(m.pos, at); if (a > E.r) continue;
      const amt = E.s * E.aud(m) * (E.r > 3 ? 1 - .45 * a / Math.PI : 1 - .4 * a / E.r);
      m.e = Math.min(1, m.e + amt); m.ed = E.ed; m.glow = 1; if (E.bond) m.b = Math.min(1, m.b + E.bond * amt); if (!m.kid && amt > .15) reached++;
    }
    const ni = this.members.length * E.inq * (this.on('scan') ? .6 : 1) * (.7 + this.rnd() * .6);
    if (ni >= .5) this.pend.push({ left: Math.round(ni), days: 90, young: !!E.young });
    this.note(`${E.n}: enthusiasm reaches ${reached} adult${reached === 1 ? '' : 's'}${ni >= .5 ? ` and will draw about ${Math.round(ni)} newcomer${Math.round(ni) === 1 ? '' : 's'}` : ''}.`);
    return reached;
  }
  /* a stroke across the sphere lends enthusiasm to the people it passes, more for a faster stroke (hypothesis) */
  stroke(points, speed) {
    const s = Math.min(1, speed), touched = new Set();
    for (const m of this.members) { if (m.rel) continue; for (const p of points) if (ang(m.pos, p) < .24) { touched.add(m); break; } }
    for (const m of touched) { m.e = Math.min(1, m.e + .5 * s); m.ed = .035; m.glow = 1; }
    if (touched.size) this.note(`A stroke of strength ${Math.round(s * 100)} lent enthusiasm to ${touched.size} ${touched.size === 1 ? 'person' : 'people'}.`);
    return touched.size;
  }
  startPert(k) {
    const D = { pan: 1092, scan: 728, closed: 1092, cal: 364, short: 1820, rhythm: 364 }; this.p[k] = D[k];
    if (k === 'scan') { for (const g of this.gs) g.L *= .5; this.pastor = false; this.wait = this.on('short') ? 365 : 120; let n = 0; this.members = this.members.filter(m => { if (!m.rel && m.b < .3 && this.rnd() < .04) { n++; this.yr.left++; return false; } return true; }); }
    if (k === 'rhythm') { for (const g of this.gs) g.phase += (this.rnd() - .5) * Math.PI * 1.6; for (const m of this.members) m.ph += (this.rnd() - .5) * Math.PI * 1.6; }
    this.note({ pan: 'A pandemic: Mass attendance falls to 60%, gatherings move online and the choir pauses.', scan: 'A scandal: leadership is shaken, the pastor is removed, and some weakly bonded members leave.', closed: 'Leadership closes: meetings barely renew those who carry them, and gatherings begin to go dormant.', cal: 'The shared calendar is dropped: no common Lent, Christmas, Easter or Vigil this year, and nothing pulls the parish\'s rhythms together.', short: 'A vocations shortage: a pastor\'s vacancy lasts a year.', rhythm: 'The rhythm breaks: people and gatherings are knocked out of step with the liturgical year and with each other.' }[k]);
  }
  emerge() { const gh = this.ghosts[0]; if (!gh || this.gs.filter(g => !g.removed && !g.base).length >= 4) { this.note('No new form of gathering can arise just now: there are already four, or no two gatherings share committed members.'); return null; } return this.arise(gh, true); }
  removeGathering(g) { this.dissolve(g); this.note(`${g.n} removed: its members lose that tie, and half of them look for another gathering. It may form again if people want it.`); }

  /* ---------------------------------------------------------------- measures and the five states */
  metrics() {
    const L = this.members; let cr = 0, crR = 0, cv = 0, cvR = 0, ad = 0, ing = 0, b = 0, carriers = 0, inside = 0;
    for (const m of L) { b += m.b; if (m.kid || m.rel) continue; ad++; if (m.gs.length) ing++; if (m.convert) { cv++; if (m.x > .5) cvR++; } else { cr++; if (m.x > .5) crR++; } if (m.b > .3 && this.day - (m.lastAt || -1e9) <= 56) inside++; }
    for (const g of this.gs) if (!g.removed) carriers += g.carriers || 0;
    return { N: L.length, regCr: cr ? crR / cr : 0, regCv: cv ? cvR / cv : 0, meanB: L.length ? b / L.length : 0, inGroup: ad ? ing / ad : 0, R: this.R, carriers, bnd: ad ? inside / ad : 0,
      gatherings: this.gs.filter(g => !g.removed).length, arisen: this.arisen, pastor: this.pastor };
  }
  features() {
    const m = this.metrics(), att = this.attW && this.attW.length ? this.attW.slice(-4).reduce((t, x) => t + x, 0) / Math.min(4, this.attW.length) : .24;
    const level = .5 * (att / .245) + .3 * (m.meanB / .385) + .2 * (m.bnd / .44);
    this.lev = this.lev || []; this.lev.push(level); if (this.lev.length > 27) this.lev.shift();
    const trend = this.lev.length > 4 ? (this.lev[this.lev.length - 1] - this.lev[0]) / (this.lev.length - 1) * 26 : 0;
    let E = 0; for (const p of this.members) E += p.e; E = E / (this.members.length || 1) * 3;
    const d = this.day % 364, fe = (d >= 28 && d < 42) || (d >= 133 && d < 154) ? .5 : 0;
    return { level, trend, festal: Math.min(1, E * 1.6 + fe) };
  }
  beacons(f) {
    f = f || this.features();
    const P = [[1.0, 0, 0], [.55, 0, 0], [1.05, 0, .85], [.85, -.12, 0], [.85, .12, 0]], sc = [.18, .18, .3];
    const d2 = P.map(c => Math.pow((f.level - c[0]) / sc[0], 2) + Math.pow((f.trend - c[1]) / .06, 2) + Math.pow((f.festal - c[2]) / sc[2], 2));
    const mn = Math.min(...d2), w = d2.map(x => Math.exp(-(x - mn) / 2)), s = w.reduce((t, x) => t + x, 0); return w.map(x => x / s);
  }
  track() { const w = this.beacons(); if (this.week > 30) { this.trail = this.trail || []; this.trail.push(w); if (this.trail.length > 120) this.trail.shift(); } this.bw = w; }
  year() { for (let i = 0; i < 52; i++) this.step(); return this.hist[0]; }
  toAdvent() { while (this.day % 364 !== 363) this.step(); }
}
const API = { Parish, EVENTS, KINDS, band };
if (typeof module !== 'undefined') module.exports = API; else root.PP = API;
})(this);

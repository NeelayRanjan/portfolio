//#region src/engine/constants.ts
var e = Math.PI / 180, t = 1.352, n = 5.3, r = 1 / 120, i = .1, a = 3.85, o = 1.75, s = 2.5, c = 1.25, l = 1.35, u = 1.3;
u * 875 * t;
var d = -.35, f = .1, p = 1.8, m = 1.2, h = 1600, g = -.85, _ = .05, v = .3, y = .015, b = .8, x = .6, S = .6, C = 2 * Math.PI * (l / 2) ** 2, w = 2e6, ee = .005, te = 1.6, ne = [
	.3,
	1,
	2,
	4
], re = [
	.1,
	.3,
	.5,
	1
], T = .3, ie = .5, ae = 1.5, E = [.5, 1.5], oe = 1.5, se = .8, D = 10 * e, ce = 10 * e, le = 15 * e, O = 4e3, k = 2001, A = O / 4, ue = 30 * e, de = [
	-6,
	-2,
	2,
	6
], fe = .1 * w, pe = .55, me = .6, he = 35 * e, ge = 2.5, _e = .12, ve = .05;
35 * e, 6 * e, 2 * e;
var ye = 8 * e, be = 1.2;
//#endregion
//#region src/engine/rng.ts
function xe(e, t) {
	let n = (Math.imul(e >>> 0, 2654435761) ^ Math.imul((t >>> 0) + 2135587861, 2246822519)) >>> 0;
	return n ^= n >>> 16, n = Math.imul(n, 2146121005), n ^= n >>> 15, n = Math.imul(n, 2221713035), n ^= n >>> 16, n >>> 0;
}
function j(e) {
	let t = e >>> 0, n = t, r = () => {
		n = n + 1831565813 >>> 0;
		let e = n;
		return e = Math.imul(e ^ e >>> 15, e | 1), e ^= e + Math.imul(e ^ e >>> 7, e | 61), ((e ^ e >>> 14) >>> 0) / 4294967296;
	};
	return {
		next: r,
		normal() {
			let e = 1 - r(), t = r();
			return Math.sqrt(-2 * Math.log(e)) * Math.cos(2 * Math.PI * t);
		},
		int(e) {
			return Math.floor(r() * e);
		},
		fork(e) {
			return j(xe(t, e));
		}
	};
}
//#endregion
//#region src/engine/knobs.ts
var Se = {
	tMaxFrac: u,
	mixKp: pe,
	inertiaPerKg: p,
	kOmega: h
};
function Ce() {
	return Se.tMaxFrac * 875 * t;
}
function we() {
	return Se.mixKp;
}
function Te() {
	return 875 * Se.inertiaPerKg;
}
function Ee() {
	return Se.kOmega;
}
//#endregion
//#region src/engine/rotor.ts
function De(e) {
	let t = Number.isFinite(e) ? Math.min(1, Math.max(0, e)) : 0, n = Math.round(1 / _);
	return Math.round(t * n) / n;
}
function M(e) {
	return {
		front: De(e.front),
		rear: De(e.rear)
	};
}
function Oe() {
	return {
		weak: [!1, !1],
		gustFrontUntil: -1,
		gustFrontDu: 0,
		lidarUntil: -1
	};
}
function ke(e, t) {
	let n = 0;
	return e.weak[0] && (n |= 1), e.weak[1] && (n |= 2), t < e.gustFrontUntil && (n |= 4), t < e.lidarUntil && (n |= 8), n;
}
function Ae(e, t) {
	return {
		weak: [!!(e & 1), !!(e & 2)],
		gustFrontUntil: e & 4 ? t + 1 : -1,
		gustFrontDu: 0,
		lidarUntil: e & 8 ? t + 1 : -1
	};
}
function N(e, t) {
	return e.weak[t] ? Ce() * x : Ce();
}
var je = 1 - Math.exp(-r / v);
function Me(e, t) {
	return e + (t - e) * je;
}
var Ne = Math.exp(-i / b), Pe = y * Math.sqrt(1 - Ne * Ne);
function Fe(e, t) {
	return e * Ne + Pe * t;
}
//#endregion
//#region src/terrain/profile.ts
function P(e, t) {
	if (!(t > 0)) return e.heights[0];
	if (t >= 4e3) return e.heights[k - 1];
	let n = t / 2, r = Math.floor(n), i = n - r;
	return e.heights[r] * (1 - i) + e.heights[r + 1] * i;
}
function Ie(e, t) {
	return (P(e, t + 1) - P(e, t - 1)) / 2;
}
function Le(e, t, n) {
	let r = Math.min(t, n), i = Math.max(t, n);
	return i - r < .01 ? Math.atan(Math.abs(Ie(e, r))) : Math.atan(Math.abs(P(e, i) - P(e, r)) / (i - r));
}
function F(e) {
	return Math.floor(e / 4);
}
function Re(e) {
	return (e + .5) * 4;
}
function ze(e, t) {
	return t.y - P(e, t.x);
}
//#endregion
//#region src/engine/energy.ts
var Be = 1 / (Math.sqrt(2 * n * C) * S);
function Ve(e) {
	return e > 0 ? e ** 1.5 * Be : 0;
}
function He(e = Oe()) {
	let n = De(875 * t / (N(e, 0) + N(e, 1)));
	return {
		front: n,
		rear: n
	};
}
function Ue(e = Oe()) {
	let n = c - d, r = c + d, i = 875 * t, a = i * r / (n + r), o = i - a;
	return [a / N(e, 0), o / N(e, 1)];
}
//#endregion
//#region src/engine/sim.ts
var We = c - d, Ge = -c - d, Ke = .5 * n * 2, qe = .5 * n * m;
function I(e) {
	let t = e - 2 * Math.PI * Math.floor((e + Math.PI) / (2 * Math.PI));
	return t === -Math.PI ? Math.PI : t;
}
function Je(e, t = {}) {
	let n = t.energy ?? 2e6, [r, i] = t.s ?? [0, 0];
	return {
		x: e.x,
		y: e.y,
		vx: e.vx,
		vy: e.vy,
		theta: I(e.theta),
		omega: e.omega,
		sF: r,
		sR: i,
		epsF: 0,
		epsR: 0,
		energy: n,
		energyEst: n,
		t: 0
	};
}
function Ye(e, t) {
	if (!(e > 0)) return 0;
	let r = Math.sqrt(e / (2 * n * C));
	return -n * C * r * t;
}
function Xe(e, n, r, i) {
	let a = Math.sin(e.theta), o = Math.cos(e.theta), s = e.vx - i[0], c = e.vy - i[1], l = -Ke * Math.abs(s) * s, u = -qe * Math.abs(c) * c, p = n + r, m = s * o + c * a + e.omega * f, h = Ye(n, m) + Ye(r, m), g = -d * o + f * a, _ = -d * a - f * o, v = We * n + Ge * r + f * h + (g * u - _ * l) - Ee() * e.omega;
	return {
		ax: (-p * a + h * o + l) / 875,
		ay: (p * o + h * a + u) / 875 - t,
		alpha: v / Te()
	};
}
function Ze(e, t, n) {
	let i = Me(e.sF, n ? 0 : t.uF), a = Me(e.sR, n ? 0 : t.uR), o = Math.max(0, i * (1 + t.epsF) * t.tmF), s = Math.max(0, a * (1 + t.epsR) * t.tmR), c = Ve(o) + Ve(s), l = n ? 0 : Ve(t.uF * t.tmF) + Ve(t.uR * t.tmR);
	return {
		sF: i,
		sR: a,
		tF: o,
		tR: s,
		energy: Math.max(0, e.energy - c * r),
		energyEst: Math.max(0, e.energyEst - l * r)
	};
}
function Qe(e, t, n) {
	let i = Ze(e, t, n.energyLocked || e.energy <= 0), a = Xe(e, i.tF, i.tR, n.windAt(e.x, e.y)), o = e.vx + a.ax * r, s = e.vy + a.ay * r, c = e.omega + a.alpha * r;
	return {
		x: e.x + o * r,
		y: e.y + s * r,
		vx: o,
		vy: s,
		theta: I(e.theta + c * r),
		omega: c,
		sF: i.sF,
		sR: i.sR,
		epsF: t.epsF,
		epsR: t.epsR,
		energy: i.energy,
		energyEst: i.energyEst,
		t: e.t + r
	};
}
function $e(e, t, n, r) {
	let i = M(t), a = Fe(e.epsF, r.normal()), o = Fe(e.epsR, r.normal());
	return {
		uF: i.front,
		uR: i.rear,
		tmF: N(n.faults, 0),
		tmR: N(n.faults, 1),
		epsF: a,
		epsR: o
	};
}
function et(e, t, n, r) {
	let i = $e(e, t, n, r), a = [], o = e;
	for (let e = 0; e < 12; e++) o = Qe(o, i, n), a.push(o);
	return a;
}
function tt(e, t, n, i) {
	let a = $e(e, t, n, i), o = [], s = {
		...e,
		vx: 0,
		vy: 0,
		omega: 0
	}, c = -1;
	for (let e = 0; e < 12; e++) {
		if (c < 0) {
			let t = n.energyLocked || s.energy <= 0, i = Ze(s, a, t);
			(i.tF + i.tR) * Math.cos(s.theta) > 1183 ? (c = e, s = Qe(s, a, n)) : s = {
				...s,
				sF: i.sF,
				sR: i.sR,
				epsF: a.epsF,
				epsR: a.epsR,
				energy: i.energy,
				energyEst: i.energyEst,
				t: s.t + r
			};
		} else s = Qe(s, a, n);
		o.push(s);
	}
	return {
		states: o,
		liftOff: c
	};
}
//#endregion
//#region src/engine/touchdown.ts
var nt = [-1 - d, g - f], rt = [1 - d, g - f], it = [[-s / 2 - d, 1 / 2 - f], [s / 2 - d, 1 / 2 - f]];
function at(e, t) {
	let n = Math.cos(e.theta), r = Math.sin(e.theta);
	return [e.x + t[0] * n - t[1] * r, e.y + t[0] * r + t[1] * n];
}
function ot(e) {
	return [at(e, nt), at(e, rt)];
}
function L(e, t) {
	let [n, r] = ot(e);
	return Math.min(n[1] - P(t, n[0]), r[1] - P(t, r[0]));
}
function R(e, t) {
	let n = L(e, t);
	for (let r of it) {
		let [i, a] = at(e, r);
		n = Math.min(n, a - P(t, i));
	}
	return n;
}
function st(e, t) {
	let n = ft(t, e.x);
	return Math.abs(I(e.theta - n.theta)) <= D && Math.abs(e.vx) <= .8 && Math.abs(e.vy) <= 1.5 && Math.abs(e.omega) <= ce;
}
function ct(e, t, n) {
	let [r, i] = ot(e), a = Math.min(r[0], i[0]), o = Math.max(r[0], i[0]), s = a < 0 || o > 4e3, c = s, l = Math.max(0, F(a)), u = Math.min(A - 1, F(o));
	for (let e = l; e <= u && !c; e++) n(e) && (c = !0);
	let d = I(e.theta), f = {
		vy: oe - Math.abs(e.vy),
		vx: se - Math.abs(e.vx),
		theta: D - Math.abs(d),
		omega: ce - Math.abs(e.omega),
		slope: le - Le(t, a, o),
		hazard: c,
		offProfile: s
	};
	return {
		safe: f.vy >= 0 && f.vx >= 0 && f.theta >= 0 && f.omega >= 0 && f.slope >= 0 && !c && !s,
		pose: {
			x: e.x,
			y: e.y,
			vx: e.vx,
			vy: e.vy,
			theta: d,
			omega: e.omega
		},
		margins: f
	};
}
function lt(e, t, n) {
	let r = (e, t) => e + (t - e) * n;
	return {
		x: r(e.x, t.x),
		y: r(e.y, t.y),
		vx: r(e.vx, t.vx),
		vy: r(e.vy, t.vy),
		theta: I(e.theta + I(t.theta - e.theta) * n),
		omega: r(e.omega, t.omega)
	};
}
function ut(e, t) {
	return e <= 0 ? 0 : Math.min(1, Math.max(0, e / (e - t)));
}
function dt(e, t, n) {
	if (e.length < 2) return null;
	let r = R(e[0], t);
	for (let i = 1; i < e.length; i++) {
		let a = R(e[i], t);
		if (a < 0) {
			let o = ut(r, a), s = lt(e[i - 1], e[i], o);
			return {
				index: i,
				alpha: o,
				contact: ct(s, t, n)
			};
		}
		r = a;
	}
	return null;
}
function ft(e, t) {
	let n = 0;
	for (let r = 0; r < 3; r++) {
		let [r, i] = ot({
			x: t,
			y: 0,
			vx: 0,
			vy: 0,
			theta: n,
			omega: 0
		});
		n = Math.atan2(P(e, i[0]) - P(e, r[0]), i[0] - r[0]);
	}
	let r = {
		x: t,
		y: 0,
		vx: 0,
		vy: 0,
		theta: n,
		omega: 0
	};
	return {
		...r,
		y: -L(r, e)
	};
}
//#endregion
//#region src/engine/wind.ts
function pt(e) {
	return e > .005 ? Math.min(te, Math.max(0, Math.log(e / ee) / Math.log(10 / ee))) : 0;
}
function mt(e, t) {
	let n = e.fSite;
	if (!(t > 0)) return n[0];
	if (t >= 4e3) return n[k - 1];
	let r = t / 2, i = Math.floor(r), a = r - i;
	return n[i] * (1 - a) + n[i + 1] * a;
}
function ht(e, t, n, r) {
	let i = r - P(e, n), a = e.windDir * ne[t] * mt(e, n) * pt(i);
	return [a, a * Ie(e, n) * Math.exp(-Math.max(i, 0) / 30)];
}
var gt = class {
	rng;
	u;
	w;
	sigma;
	constructor(e, t) {
		this.rng = t, this.sigma = re[e], this.u = this.sigma * t.normal(), this.w = T * this.sigma * t.normal();
	}
	step(e) {
		let t = Math.exp(-e / 4), n = Math.sqrt(1 - t * t);
		this.u = this.u * t + this.sigma * n * this.rng.normal(), this.w = this.w * t + T * this.sigma * n * this.rng.normal();
	}
}, _t = class {
	steps;
	log = [];
	held = {
		front: 0,
		rear: 0
	};
	from = 0;
	constructor(e = 10) {
		if (!Number.isInteger(e) || e < 0) throw Error(`DelayLink: steps must be a non-negative integer, got ${e}`);
		this.steps = e;
	}
	reset(e, t) {
		this.log = [], this.held = M(e), this.from = t;
	}
	send(e, t) {
		if (t < this.from) throw Error(`DelayLink: send at step ${t} before the reset at ${this.from}`);
		let n = this.log[this.log.length - 1];
		if (n && t < n.step) throw Error(`DelayLink: send at step ${t} after step ${n.step}`);
		let r = M(e);
		for (n && t === n.step ? n.cmd = r : this.log.push({
			step: t,
			cmd: r
		}); this.log.length > 1 && this.log[1].step <= t - 3 * this.steps;) this.log.shift();
	}
	arriving(e) {
		let t = e - this.steps, n = 0, r = this.log.length - 1, i = -1;
		for (; n <= r;) {
			let e = n + r >> 1;
			this.log[e].step <= t ? (i = e, n = e + 1) : r = e - 1;
		}
		return i >= 0 ? this.log[i].cmd : this.held;
	}
	inFlight(e) {
		let t = this.downlinkStep(e);
		return Array.from({ length: 2 * this.steps }, (e, n) => this.arriving(t + n));
	}
	downlinkStep(e) {
		return Math.max(0, e - this.steps);
	}
}, vt = {
	next: () => .5,
	normal: () => 0,
	int: () => 0,
	fork: () => vt
};
function yt(e, t, n, r, i) {
	let a = {
		...t.state,
		epsF: 0,
		epsR: 0,
		energy: t.state.energyEst
	}, o = t.onGround, s = t.contact ?? !1, c = [];
	return i.forEach((t, i) => {
		if (s) {
			c.push({
				state: a,
				onGround: o,
				contact: s
			});
			return;
		}
		let l = {
			faults: Ae(n, r + i),
			windAt: () => [0, 0],
			energyLocked: a.energy <= 0
		};
		if (o) {
			let e = tt(a, t, l, vt);
			a = e.states[e.states.length - 1], e.liftOff >= 0 && (o = !1);
		} else {
			let n = et(a, t, l, vt), r = a, i = R(r, e);
			a = n[n.length - 1];
			for (let t of n) {
				let n = R(t, e);
				if (n < 0 && t.vy <= 0) {
					let c = {
						...t,
						...lt(r, t, ut(i, n))
					};
					st(c, e) ? (a = {
						...a,
						...ft(e, t.x)
					}, o = !0) : (a = c, s = !0);
					break;
				}
				r = t, i = n;
			}
		}
		c.push(s ? {
			state: a,
			onGround: o,
			contact: s
		} : {
			state: a,
			onGround: o
		});
	}), c;
}
//#endregion
//#region src/control/vector.ts
var bt = {
	tx: 0,
	ty: 0
};
function xt(e) {
	let t = Math.hypot(e.tx, e.ty);
	if (!(t > 1e-9) || !(e.ty > 0)) return {
		tx: 0,
		ty: 0
	};
	let n = Math.max(-he, Math.min(he, Math.atan2(e.tx, e.ty))), r = Math.min(1, t);
	return {
		tx: r * Math.sin(n),
		ty: r * Math.cos(n)
	};
}
function St(e, t, n) {
	let r = +!!t.right - !!t.left, i = +!!t.up - !!t.down;
	return r === 0 && i === 0 ? e : xt({
		tx: e.tx + r * me * n,
		ty: e.ty + i * me * n
	});
}
function Ct(e) {
	return e.tx === 0 && e.ty === 0 ? 0 : -Math.atan2(e.tx, e.ty);
}
function wt(e) {
	return Math.hypot(e.tx, e.ty);
}
//#endregion
//#region src/control/mixer.ts
function Tt(e, t) {
	let n = wt(e), r = I(Ct(e) - t), i = we() * r;
	return {
		front: De(n + i),
		rear: De(n - i)
	};
}
//#endregion
//#region src/terrain/fog.ts
var Et = Math.cos(ue);
function Dt(e, t) {
	let n = Math.sin(e.theta), r = -Math.cos(e.theta), i = Math.max(0, F(e.x - 250)), a = Math.min(A - 1, F(e.x + 250)), o = [];
	for (let s = i; s <= a; s++) {
		let i = Re(s), a = i - e.x, c = P(t, i) - e.y, l = Math.hypot(a, c);
		l > 250 || l < 1e-9 || (a * n + c * r) / l >= Et && o.push(s);
	}
	return o;
}
function Ot(e, t, n) {
	let r = new Uint8Array(A);
	for (let i = 0; i < A; i++) {
		let a = e[i];
		if (a < 0 || a > n) continue;
		let o = t[i];
		r[i] = o >= 0 && o <= n ? 2 : 1;
	}
	return r;
}
//#endregion
//#region src/terrain/hazards.ts
var kt = [
	.02,
	.03,
	.04,
	.07,
	.05
], At = 25 * e;
function jt(e, t) {
	let n = e * 4, r = n + 4;
	return t.some((e) => r > e.from && n < e.to);
}
function Mt(e, t, n, r, i) {
	let a = new Uint8Array(A);
	for (let t = 0; t < A; t++) {
		let n = t * 4;
		Math.atan(Math.abs(P(e, n + 4) - P(e, n)) / 4) > At && (a[t] = 1);
	}
	let o = Math.round(kt[t - 1] * A), s = 0, c = (e) => {
		let t = 1 + i.int(3);
		for (let n = 0; n < t; n++) {
			let t = e + i.int(11) - 5, n = 1 + i.int(3);
			for (let e = t; e < t + n; e++) e < 0 || e >= 1e3 || a[e] || (a[e] = 1, s++);
		}
	};
	for (let e = 0; s < o && e < 1e4; e++) c(i.int(A));
	if (t === 4) for (let e of r) for (let t of [-1, 1]) c(F((t < 0 ? e.from : e.to) + t * (8 + 32 * i.next())));
	for (let e = 0; e < A; e++) a[e] && jt(e, n) && (a[e] = 0);
	return a;
}
function Nt(e, t, n) {
	let r = 16 + 24 * n.next(), i = t + (n.next() - .5) * 8;
	return {
		from: F(i - r / 2),
		to: F(i + r / 2)
	};
}
//#endregion
//#region src/terrain/labels.ts
var Pt = "illustrative, generated from Cassini-observed dune and crater statistics", Ft = [
	"interdune organics",
	"dune sand sampling",
	"water-ice bedrock exposure",
	"prebiotic chemistry site",
	"Selk rim ejecta",
	"impact melt deposit",
	"crater floor sediments",
	"channel outwash deposit"
];
function It(e, t) {
	let n = t === 3 ? Ft.slice(4) : Ft.slice(0, 4);
	return n[e.int(n.length)];
}
//#endregion
//#region src/terrain/mapgen.ts
var Lt = 937, Rt = [
	40,
	25,
	20,
	14,
	10
], zt = 21, Bt = 31 * e, Vt = 33 * e, Ht = [
	[40, 60],
	[40, 70],
	[40, 60],
	[50, 80],
	[60, 100]
], Ut = [
	[120, 260],
	[80, 200],
	[80, 200],
	[50, 140],
	[40, 120]
], Wt = (e) => e * e * (3 - 2 * e);
function Gt(e, t) {
	if (t <= e.a || t >= e.b) return 0;
	let n = t < e.crest ? (t - e.a) / (e.crest - e.a) : (e.b - t) / (e.b - e.crest);
	return e.h * Wt(n);
}
var Kt = (e, t) => 1.5 * e / Math.tan(t);
function z(e, t, n) {
	return t + (n - t) * e.next();
}
function qt(e, t, n, r, i, a, o, s = .4) {
	let c = r + i, l = Math.min(1, (t - e) / c);
	if (l < s) return null;
	let u = r * l, d = i * l, f = o === "lo" ? e : t - (u + d), p = f + u + d;
	return {
		a: f,
		b: p,
		crest: a > 0 ? p - u : f + u,
		h: n * l
	};
}
var Jt = [20, 100], Yt = .1;
function Xt(e, t, n) {
	let r = Rt[n - 1], i = t + 100, a = t + 300, o = 2 * r + 40 + (n === 5 ? 65 : 0), s = Math.max(0, a - i - o - Jt[0]), c = 2 + e.int(2), l = n === 3 || n === 5 ? i + s - z(e, 0, Math.min(20, s)) : i + z(e, 0, Math.min(40, s)), u = [l];
	for (; u.length < c;) {
		if (l += o + z(e, Jt[0], Jt[1]), l > a) {
			if (u.length >= 2) break;
			l = a;
		}
		u.push(l);
	}
	return u.map((e) => Math.round(e / 2) * 2);
}
function Zt(e, t) {
	let n = Math.round(t / 2) * 2, r = P(e, n), i = new Float32Array(zt);
	for (let t = 0; t < zt; t++) i[t] = P(e, n - 20 + t * 2) - r;
	return i;
}
function Qt(e) {
	let { seed: t, tier: n } = e;
	if (e.startPatch && e.startPatch.length !== zt) throw Error(`generateMap: startPatch needs ${zt} samples`);
	let r = j(t).fork(Lt), i = r.fork(1), a = r.fork(2), o = r.fork(3), s = r.fork(4), c = r.fork(5), l = i.next() < .5 ? 1 : -1, u = Rt[n - 1], d = Xt(i, 400, n), f = d.map((e) => ({
		x: e,
		halfWidth: u,
		label: It(c, n)
	})), p = z(i, 0, 2 * Math.PI), m = z(i, 0, 2 * Math.PI), h = z(i, 0, 2 * Math.PI), g = (e) => 6 * Math.sin(2 * Math.PI * e / 3e3 + p), _ = (e) => .3 * Math.sin(2 * Math.PI * e / 37 + m) + .1 * Math.sin(2 * Math.PI * e / 13 + h), v = {
		from: 380,
		to: 420
	}, y = d.map((e) => ({
		from: e - u,
		to: e + u
	})), b = [{
		from: 368,
		to: 432
	}, ...y.map((e, t) => {
		let r = n === 5 && t === 0 ? 4 : 12;
		return {
			from: e.from - r,
			to: e.to + r
		};
	})], x = [], [S, C] = Ht[n - 1];
	if (n === 3) {
		let e = b[0].to, t = b[1].from, n = z(a, 60, 90), r = Kt(n, Vt), i = qt(e, t, n, r, r * z(a, 1.2, 1.6), 1, "hi", Yt);
		i && (x.push(i), b.push({
			from: i.a,
			to: i.b
		}));
	}
	if (n === 5) {
		let e = b[1];
		for (let t of [-1, 1]) {
			let n = z(a, S, C), r = Kt(n, Bt), i = qt(t < 0 ? Math.max(...b.filter((t) => t.to <= e.from).map((e) => e.to), -200) : e.to, t < 0 ? e.from : Math.min(...b.filter((t) => t.from >= e.to).map((e) => e.from), O + 200), n, r, r * z(a, 1, 1.2), t < 0 ? 1 : -1, t < 0 ? "hi" : "lo", Yt);
			i && (x.push(i), b.push({
				from: i.a,
				to: i.b
			}));
		}
	}
	let [w, ee] = Ut[n - 1], te = y[y.length - 1].from, ne = [...b].sort((e, t) => e.from - t.from), re = [], T = -100;
	for (let e of ne) e.from > T && re.push({
		from: T,
		to: e.from
	}), T = Math.max(T, e.to);
	re.push({
		from: T,
		to: O + 100
	});
	for (let e of re) {
		let t = e.from >= 400 && e.to <= te, n = e.from;
		for (let r = 0; r < 50; r++) {
			let i = e.to, o = z(a, S, C), s = Kt(o, Bt), c = t && r === 0, u = qt(n, i, o, s, s * z(a, 1.4, 2.2), l, "lo", c ? 0 : .4);
			if (!u || (c ? u.h < 4 : u.h < .45 * o)) break;
			x.push(u), n = u.b + z(a, w, ee);
		}
	}
	let E = new Float64Array(k);
	for (let e = 0; e < k; e++) {
		let t = e * 2, n = g(t) + _(t);
		for (let e of x) n += Gt(e, t);
		E[e] = n;
	}
	let oe = (e, t) => {
		for (let n = 0; n < k; n++) {
			let r = n * 2, i = Math.max(e.from - r, r - e.to, 0);
			if (i >= 10) continue;
			let a = i <= 0 ? 1 : .5 * (1 + Math.cos(Math.PI * i / 10));
			E[n] = E[n] * (1 - a) + t(r) * a;
		}
	};
	for (let e of y) {
		let t = g((e.from + e.to) / 2);
		oe(e, (e) => t + .1 * _(e));
	}
	let se = g(400);
	if (e.startPatch) {
		let t = e.startPatch;
		oe({
			from: 380,
			to: 420
		}, (e) => {
			let n = Math.min(zt - 1, Math.max(0, Math.round((e - 380) / 2)));
			return se + t[n];
		});
	} else oe(v, (e) => se + .1 * _(e));
	let D = Float32Array.from(E), ce = z(o, 300, 800), le = z(o, 300, 800), A = z(o, 0, 2 * Math.PI), ue = z(o, 0, 2 * Math.PI), de = new Float64Array(k);
	for (let e = 0; e < k; e++) de[e] = Math.min(1.2, Math.max(0, (D[e] - g(e * 2)) / 100));
	let fe = new Float32Array(k);
	for (let e = 0; e < k; e++) {
		let t = 0, n = 0;
		for (let r = Math.max(0, e - 15); r <= Math.min(k - 1, e + 15); r++) t += de[r], n++;
		let r = e * 2, i = 1 + .18 * Math.sin(2 * Math.PI * r / ce + A) + .1 * Math.sin(2 * Math.PI * r / le + ue) + .35 * (t / n - .2);
		fe[e] = Math.min(ae, Math.max(ie, i));
	}
	let pe = [{
		from: v.from - 4,
		to: v.to + 4
	}, ...y];
	return {
		seed: t,
		tier: n,
		heights: D,
		fSite: fe,
		windDir: l,
		baseHazards: Mt({ heights: D }, n, pe, y, s),
		startX: 400,
		targets: f
	};
}
var $t = [
	"calm",
	"breezy",
	"strong",
	"beyond predicted"
];
function en(e, t) {
	return Math.min(3, e + Math.max(0, t - 1));
}
function tn(e, t, n) {
	if (!Number.isInteger(n) || n < 1 || n > 5) throw Error(`hopPlan: hop must be 1..5, got ${n}`);
	return {
		hop: n,
		level: en(t, n),
		tier: n,
		mapSeed: xe(e, n),
		midHopEvent: n >= 4
	};
}
function nn(e, t = 1) {
	return {
		seed: e >>> 0,
		baseLevel: t,
		results: Array.from({ length: 5 }, () => null)
	};
}
var rn = {
	1: "wide interdune target",
	2: "narrower interdune",
	3: "crater-rim relief",
	4: "narrow corridor, more ice blocks",
	5: "slipface-flanked target"
};
function an(e) {
	return e === 3 ? `${$t[3]} (beyond Titan's predicted near-surface winds)` : $t[e];
}
function on(e, t) {
	return xe(e, 1e3 + t);
}
function sn(e, t) {
	if (!tn(e, 0, t).midHopEvent) return null;
	let n = j(xe(e, 2e3 + t)), r = Math.round((20 + n.next() * 35) / i), a = n.int(4), o = n.int(2);
	return {
		step: r,
		event: a === 0 ? {
			kind: "weakRotor",
			station: o
		} : a === 1 ? { kind: "gustFront" } : a === 2 ? { kind: "lidarDropout" } : { kind: "hazard" }
	};
}
function cn(e, t, n, r) {
	let i = t.hop ?? n ?? 1, a = n === null || i === 1 && t.seed === void 0 || t.seed !== void 0 && t.seed >>> 0 !== e.seed, o = t.level !== void 0, s = o && (i === 1 || a) ? Math.max(0, t.level - (i - 1)) : e.baseLevel, c = a ? nn(t.seed ?? r(), s) : s === e.baseLevel ? e : {
		...e,
		baseLevel: s
	}, l = a && o ? {
		...tn(c.seed, c.baseLevel, i),
		level: t.level
	} : tn(c.seed, c.baseLevel, i), u = sn(c.seed, i);
	return {
		chain: c,
		plan: l,
		worldSeed: on(c.seed, i),
		events: u ? [u] : []
	};
}
function ln(e) {
	return e.results.filter((e) => e?.safe).length;
}
//#endregion
//#region src/world/start.ts
function B(e, t, n) {
	return t + (n - t) * e.next();
}
function un(e, t, n) {
	let r = -Infinity;
	for (let i = Math.min(t, n); i <= Math.max(t, n); i += 4) r = Math.max(r, P(e, i));
	return r;
}
function dn(e, t = e.targets[0].x) {
	return {
		kind: "ground",
		start: ft(e, e.startX),
		onGround: !0,
		targetX: t,
		energy: w,
		s: [0, 0]
	};
}
function fn(t, n, r, i) {
	let a = i - t.startX, o = (e) => Math.max(0, Math.min(e, a - 30)), s, c, l, u, d;
	r === "transit" ? (s = t.startX + B(n, 30, Math.max(40, a - 60)), c = B(n, 15, 50), l = B(n, 0, 5), u = B(n, -1, 1), d = B(n, .4, .95) * w) : r === "scout" ? (s = i + B(n, -o(120), 60), c = B(n, 15, 60), l = B(n, -1.5, 3), u = B(n, -1, 1), d = B(n, .3, .8) * w) : (s = i + B(n, -o(25), 25), c = B(n, 4, 40), l = B(n, -1, 1), u = B(n, -2, .5), d = B(n, .2, .7) * w);
	let f = un(t, s - 50, s + 50);
	return {
		kind: r,
		start: {
			x: s,
			y: f + c,
			vx: l,
			vy: u,
			theta: B(n, -8, 8) * e,
			omega: B(n, -3, 3) * e
		},
		onGround: !1,
		targetX: i,
		energy: d,
		s: Ue()
	};
}
//#endregion
//#region src/world/targets.ts
function pn(e, t = 0) {
	return [F(e - d - 1 - t), F(e - d + 1 + t)];
}
function mn(e, t) {
	let [n, r] = pn(e);
	for (let e = n; e <= r; e++) if (e >= 0 && e < 1e3 && t[e] === 2) return !0;
	return !1;
}
function hn(e, t, n) {
	let [r, i] = pn(e, 4);
	if (r < 0 || i >= 1e3) return !1;
	for (let e = r; e <= i; e++) if (t[e] !== 1) return !1;
	return Le(n, e - d - 1, e - d + 1) <= ye;
}
function gn(e, t) {
	let n = null;
	for (let r of e.targets) {
		if (mn(r.x, t)) continue;
		let i = Math.abs(r.x - e.startX);
		(!n || r.halfWidth > n.w || r.halfWidth === n.w && i < n.d) && (n = {
			x: r.x,
			w: r.halfWidth,
			d: i
		});
	}
	return n ? n.x : e.targets[0].x;
}
function _n(e, t, n, r) {
	return r ? void 0 : {
		x: t.x,
		clearance: L(t, e),
		energyEst: n
	};
}
function vn(e, n, r) {
	return fe + be * 2 * Ve(875 * t / 2) * (Math.abs(r - e) / 6 + Math.max(0, n - 10) / 3 + 10);
}
function yn(e, t, n) {
	let r = Math.round(n / 4) * 4;
	for (let n = 0; n <= 250; n += 4) {
		if (hn(r - n, t, e)) return r - n;
		if (n > 0 && hn(r + n, t, e)) return r + n;
	}
	return null;
}
function bn(e, t, n, r) {
	if (r && r.energyEst < vn(r.x, r.clearance, n)) {
		let n = yn(e, t, r.x);
		if (n !== null) return n;
	}
	if (!mn(n, t)) return n;
	for (let r = 4; r <= 60; r += 4) {
		if (hn(n - r, t, e)) return n - r;
		if (hn(n + r, t, e)) return n + r;
	}
	let i = e.targets.filter((e) => Math.abs(e.x - n) > 60 && !mn(e.x, t)).sort((e, t) => Math.abs(e.x - n) - Math.abs(t.x - n));
	return i.length > 0 ? i[0].x : n;
}
function xn(e, t) {
	for (let n = e.length - 1; n >= 0; n--) {
		let r = e[n];
		if (r.event.kind !== "hazard") continue;
		let a = 20 - (t - r.step) * i;
		return a > 0 ? { remainingS: a } : null;
	}
	return null;
}
//#endregion
//#region src/world/history.ts
function Sn(e, t) {
	let n = (t) => t < e.records.length ? e.records[Math.max(0, t)].state : e.state, r = Math.max(0, Math.min(Math.floor(t), e.step)), i = Math.min(r + 1, e.step), a = n(r), o = n(i), s = Math.min(1, Math.max(0, t - r)), c = lt(a, o, s), l = (e, t) => e + (t - e) * s;
	return {
		...c,
		sF: l(a.sF, o.sF),
		sR: l(a.sR, o.sR),
		energyEst: l(a.energyEst, o.energyEst)
	};
}
function Cn(e, t, n) {
	let r = t.downlinkStep(n), i = e.records;
	return Array.from({ length: 20 }, (e, a) => {
		let o = r + a;
		return o < n && o < i.length ? i[o].cmd : t.arriving(o);
	});
}
var wn = 1, Tn = 2, En = 3;
function Dn(e, t, n) {
	let r = (e, t) => e + (t - e) * n;
	return {
		x: r(e.x, t.x),
		y: r(e.y, t.y),
		vx: r(e.vx, t.vx),
		vy: r(e.vy, t.vy),
		theta: I(e.theta + I(t.theta - e.theta) * n),
		omega: r(e.omega, t.omega),
		sF: r(e.sF, t.sF),
		sR: r(e.sR, t.sR),
		epsF: r(e.epsF, t.epsF),
		epsR: r(e.epsR, t.epsR),
		energy: r(e.energy, t.energy),
		energyEst: r(e.energyEst, t.energyEst),
		t: r(e.t, t.t)
	};
}
var On = class {
	map;
	level;
	seed;
	stopAtContact;
	step = 0;
	state;
	faults = Oe();
	targetX;
	onGround;
	armed;
	energyLocked = !1;
	hazardFrom;
	revealedAt;
	contact = null;
	contactStep = -1;
	contactAlpha = 0;
	groundless = !1;
	records = [];
	eventLog = [];
	rng;
	eventRng;
	gusts;
	pending;
	constructor(e) {
		if (this.map = e.map, this.level = e.level, this.seed = e.seed, this.stopAtContact = e.stopAtContact ?? !0, this.targetX = e.targetX, this.onGround = e.onGround, e.onGround && Math.abs(L(e.start, e.map)) > .05) throw Error("World: an onGround start must rest on the terrain (use restingPose)");
		let t = e.onGround ? {
			...e.start,
			vx: 0,
			vy: 0,
			omega: 0
		} : e.start;
		this.state = Je(t, {
			energy: e.energy,
			s: e.s
		}), this.armed = !e.onGround && L(t, e.map) >= 1;
		let n = j(e.seed);
		this.rng = n.fork(wn), this.gusts = new gt(e.level, n.fork(Tn)), this.eventRng = n.fork(En), this.pending = [...e.events ?? []].sort((e, t) => e.step - t.step), this.hazardFrom = new Int32Array(A).fill(-1);
		for (let t = 0; t < A; t++) e.map.baseHazards[t] && (this.hazardFrom[t] = 0);
		this.revealedAt = new Int32Array(A).fill(-1), this.scan();
	}
	get done() {
		return this.contact !== null && this.stopAtContact;
	}
	applyDue() {
		for (; this.pending.length > 0 && this.pending[0].step <= this.step;) {
			let e = this.pending.shift();
			e && this.applyEvent(e.event);
		}
	}
	advance(e) {
		if (this.done) return this.state;
		this.applyDue();
		let t = M(e);
		this.records.push({
			state: this.state,
			cmd: t,
			faultBits: ke(this.faults, this.step),
			targetX: this.targetX,
			onGround: this.onGround
		}), this.gusts.step(i);
		let n = {
			faults: this.faults,
			windAt: (e, t) => this.windAt(e, t),
			energyLocked: this.energyLocked
		}, r, a = 0;
		if (this.onGround) {
			let e = tt(this.state, t, n, this.rng);
			r = e.states, e.liftOff >= 0 ? (this.onGround = !1, a = e.liftOff) : a = r.length;
		} else r = et(this.state, t, n, this.rng);
		let o = r[r.length - 1];
		if (!this.onGround && a < r.length) {
			let e = a === 0 ? this.state : r[a - 1], t = R(e, this.map);
			for (let n = a; n < r.length; n++) {
				let i = r[n], a = R(i, this.map);
				if (a < 0 && (this.armed || i.vy <= 0)) {
					let s = ut(t, a), c = Dn(e, i, s);
					if (!this.armed && !st(c, this.map) && (this.armed = !0), this.armed) this.contact === null && !this.groundless && (this.contact = ct(c, this.map, (e) => this.hazardTrue(e)), this.contactStep = this.step, this.contactAlpha = (n + s) / r.length, this.stopAtContact ? o = c : this.groundless = !0);
					else {
						let e = ft(this.map, i.x);
						o = {
							...r[r.length - 1],
							...e
						}, this.onGround = !0;
					}
					break;
				}
				e = i, t = a;
			}
		}
		return !this.armed && !this.onGround && L(o, this.map) >= 1 && (this.armed = !0), o.energy <= 0 && (this.energyLocked = !0), this.state = o, this.step += 1, this.scan(), o;
	}
	applyEvent(e) {
		let t = e;
		if (e.kind === "weakRotor") {
			let t = [this.faults.weak[0], this.faults.weak[1]];
			t[e.station] = !0, this.faults = {
				...this.faults,
				weak: t
			};
		} else if (e.kind === "gustFront") {
			let n = this.eventRng.next() < .5 ? -1 : 1, r = (E[0] + (E[1] - E[0]) * this.eventRng.next()) * Math.max(ne[this.level], 1), i = 5 + 7 * this.eventRng.next(), a = e.du ?? n * r, o = e.steps ?? Math.round(i / .1);
			this.faults = {
				...this.faults,
				gustFrontUntil: this.step + o,
				gustFrontDu: a
			}, t = {
				kind: "gustFront",
				du: a,
				steps: o
			};
		} else if (e.kind === "lidarDropout") this.faults = {
			...this.faults,
			lidarUntil: this.step + Math.round(8 / i)
		};
		else {
			let { from: e, to: t } = Nt(this.map, this.targetX, this.eventRng);
			for (let n = Math.max(0, e); n <= Math.min(A - 1, t); n++) this.hazardFrom[n] < 0 && (this.hazardFrom[n] = this.step);
		}
		this.eventLog.push({
			step: this.step,
			event: t
		});
	}
	knowledge() {
		return Ot(this.revealedAt, this.hazardFrom, this.step);
	}
	hazardTrue(e) {
		if (e < 0 || e >= 1e3) return !0;
		let t = this.hazardFrom[e];
		return t >= 0 && t <= this.step;
	}
	setTarget(e) {
		this.targetX = Math.min(O, Math.max(0, e));
	}
	windAt(e, t) {
		let [n, r] = ht(this.map, this.level, e, t), i = pt(t - P(this.map, e)), a = Math.min(1, i);
		return [n + (this.step < this.faults.gustFrontUntil ? this.faults.gustFrontDu * i : 0) + this.gusts.u * a, r + this.gusts.w * a];
	}
	gust() {
		return {
			u: this.gusts.u,
			w: this.gusts.w
		};
	}
	scan() {
		if (!(this.step < this.faults.lidarUntil)) for (let e of Dt(this.state, this.map)) this.revealedAt[e] < 0 && (this.revealedAt[e] = this.step);
	}
}, kn = [
	"weakRotor",
	"gustFront",
	"lidarDropout",
	"hazard"
];
function An(e, t) {
	if (t !== 0 && t !== 1 && t !== 2 && t !== 3) throw TypeError(`lander: ${e}: level must be 0, 1, 2 or 3, got ${String(t)}`);
	return t;
}
function jn(e, t, n) {
	if (typeof n != "number" || !Number.isFinite(n) || n < -1 || n > 1) throw TypeError(`lander: ${e}: ${t} must be a number in [-1, 1], got ${String(n)}`);
	return n;
}
var Mn = {
	newFlight(e, t) {
		if (t !== void 0 && (typeof t != "object" || !t)) throw TypeError("lander: newFlight: the argument must be an object when given");
		let n = t?.hop ?? 1;
		if (!Number.isInteger(n) || n < 1 || n > 5) throw TypeError(`lander: newFlight: hop must be an integer 1..5, got ${String(n)}`);
		e.newFlight(t?.level === void 0 ? { hop: n } : {
			hop: n,
			level: An("newFlight", t.level)
		});
	},
	setLevel(e, t) {
		e.setLevel(An("setLevel", t));
	},
	setAutopilot(e, t) {
		if (typeof t != "boolean") throw TypeError(`lander: setAutopilot: on must be a boolean, got ${String(t)}`);
		e.setAutopilot(t);
	},
	setInput(e, t) {
		if (typeof t != "object" || !t) throw TypeError("lander: setInput: the argument must be { x, y }");
		e.setInput({
			x: jn("setInput", "x", t.x),
			y: jn("setInput", "y", t.y)
		});
	},
	injectFault(e, t) {
		if (!kn.includes(t)) throw TypeError(`lander: injectFault: kind must be one of ${kn.join(", ")}, got ${String(t)}`);
		e.injectFault(t);
	}
}, Nn = Object.keys(Mn);
function Pn(e, t, ...n) {
	Mn[t](e, ...n);
}
var Fn = .55;
function In(e) {
	return Math.min(400, Math.max(30, ge * Math.max(0, e) + 20));
}
function Ln(e, t) {
	return 1 - Math.exp(-Math.max(0, e) / t);
}
var Rn = .6, zn = .25, Bn = class e {
	zoom;
	cx = 400;
	cy = 0;
	width = 400;
	primed = !1;
	constructor(e = 1) {
		this.zoom = e;
	}
	wantWidth(e, t) {
		let n = In(e), r = Math.max(0, e) / (Fn * t);
		return Math.min(n, Math.max(n / this.zoom, 16, r));
	}
	visibleHeight(e) {
		return this.width * e;
	}
	static target(e, t, n, r, i = 1) {
		let a = n * r, o = t + .4 * a, s = e.y - (i > 1 ? .2 : .35) * a;
		return {
			cx: e.x,
			cy: Math.max(o, s)
		};
	}
	update(t, n, r, i) {
		let a = this.wantWidth(t.y - n, i);
		if (!this.primed) {
			this.width = a;
			let r = e.target(t, n, this.width, i, this.zoom);
			this.cx = r.cx, this.cy = r.cy, this.primed = !0;
			return;
		}
		this.width += (a - this.width) * Ln(r, Rn);
		let o = e.target(t, n, this.width, i, this.zoom), s = Ln(r, zn);
		this.cx += (o.cx - this.cx) * s, this.cy += (o.cy - this.cy) * s;
	}
	reset() {
		this.primed = !1;
	}
	scale(e) {
		return e / this.width;
	}
	toScreen(e, t, n, r) {
		let i = this.scale(n);
		return [(e - this.cx) * i + n / 2, r / 2 - (t - this.cy) * i];
	}
	screenToWorldX(e, t) {
		return this.cx + (e - t / 2) / this.scale(t);
	}
}, Vn = /* @__PURE__ */ new Set([
	"w",
	"W",
	"s",
	"S",
	"a",
	"A",
	"d",
	"D",
	"ArrowUp",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight"
]);
function Hn(e) {
	return Vn.has(e);
}
function Un(e, t) {
	let n = e.createElement("div");
	n.className = "control-toggle", n.setAttribute("role", "group"), n.setAttribute("aria-label", "Control");
	let r = e.createElement("span");
	r.textContent = "Control:";
	let i = e.createElement("button");
	i.type = "button", i.textContent = "Manual";
	let a = e.createElement("button");
	a.type = "button", a.textContent = "Autopilot", n.append(r, i, a);
	let o = "manual", s = () => {
		i.setAttribute("aria-pressed", String(o === "manual")), a.setAttribute("aria-pressed", String(o === "autopilot"));
	};
	return i.addEventListener("click", () => {
		o !== "manual" && (o = "manual", s(), t("manual"));
	}), a.addEventListener("click", () => {
		o === "autopilot" || a.disabled || (o = "autopilot", s(), t("autopilot"));
	}), s(), {
		el: n,
		set(e) {
			e !== o && (o = e, s());
		},
		setAutopilotAvailable(e, t) {
			a.disabled = !e, a.title = e ? "" : t;
		}
	};
}
function Wn(e, t) {
	let n = e.createElement("button");
	return n.type = "button", n.className = "take-controls", n.textContent = "Take the controls", n.addEventListener("click", t), {
		el: n,
		show(e) {
			n.hidden = !e;
		}
	};
}
//#endregion
//#region src/ui/endcard.ts
var Gn = (t) => Number((t / e).toFixed(1));
function Kn(t) {
	let n = t.margins, r = t.pose, i = le - n.slope;
	return [
		{
			label: "Vertical speed",
			value: `${Math.abs(r.vy).toFixed(2)} m/s`,
			limit: `${oe} m/s`,
			ok: n.vy >= 0
		},
		{
			label: "Horizontal speed",
			value: `${Math.abs(r.vx).toFixed(2)} m/s`,
			limit: `${se} m/s`,
			ok: n.vx >= 0
		},
		{
			label: "Tilt",
			value: `${(Math.abs(r.theta) / e).toFixed(1)}°`,
			limit: `${Gn(D)}°`,
			ok: n.theta >= 0
		},
		{
			label: "Spin rate",
			value: `${(Math.abs(r.omega) / e).toFixed(1)}°/s`,
			limit: `${Gn(ce)}°/s`,
			ok: n.omega >= 0
		},
		{
			label: "Ground slope",
			value: `${(i / e).toFixed(1)}°`,
			limit: `${Gn(le)}°`,
			ok: n.slope >= 0
		},
		{
			label: "Hazard under the skids",
			value: n.offProfile ? "off the map" : n.hazard ? "yes" : "no",
			limit: "none",
			ok: !n.hazard && !n.offProfile
		}
	];
}
function qn(e) {
	return `Energy used: ${(e / 1e3).toFixed(0)} kJ, ${Math.round(100 * e / w)}% of the hop budget (game-scaled; Dragonfly recharges from its RTG between flights)`;
}
function Jn(e, t, n) {
	let r = e.ownerDocument;
	e.replaceChildren();
	let i = t.contact, a = r.createElement("h2");
	a.textContent = i.safe ? "Landed safely" : "Crashed", a.className = i.safe ? "ok" : "bad";
	let o = r.createElement("p");
	o.textContent = `Hop ${t.hop} of 5 · ${$t[t.level]}`;
	let s = r.createElement("table");
	for (let e of Kn(i)) {
		let t = r.createElement("tr");
		t.className = e.ok ? "ok" : "bad";
		for (let n of [
			e.label,
			e.value,
			`limit ${e.limit}`,
			e.ok ? "ok" : "over"
		]) {
			let e = r.createElement("td");
			e.textContent = n, t.append(e);
		}
		s.append(t);
	}
	let c = r.createElement("p");
	c.textContent = qn(t.energyUsedJ);
	let l = r.createElement("div");
	l.className = "endcard-buttons";
	let u = (e, t, n = !0) => {
		let i = r.createElement("button");
		return i.type = "button", i.textContent = e, i.disabled = !n, i.addEventListener("click", t), i;
	};
	l.append(u("Fly again", n.again), ...i.safe && t.hop < 5 ? [u("Next hop", n.next)] : []), e.append(a, o, s, c, l), e.hidden = !1;
}
function Yn(e) {
	e.hidden = !0, e.replaceChildren();
}
//#endregion
//#region src/ui/instruments.ts
var Xn = (e, t = 1) => `${e >= 0 ? "+" : ""}${e.toFixed(t)}`;
function Zn(t) {
	let n = t.display;
	return {
		hgt: `${Math.max(0, t.clearance).toFixed(1)} m`,
		vx: `${Xn(n.vx)} m/s`,
		vy: `${Xn(n.vy)} m/s`,
		tilt: `${Xn(n.theta / e)}°`,
		energy: `${Math.round(100 * n.energyEst / w)}% est.`,
		wind: `${Xn(t.meanU)} mean · ${Xn(t.liveU)} live m/s`,
		link: t.source === "onboard" ? "onboard, no delay" : t.age < 0 ? `${t.source}, ${(-t.age).toFixed(1)} s ahead` : `${t.source}, ${t.age.toFixed(1)} s old`,
		time: `${t.t.toFixed(1)} s`
	};
}
var Qn = [
	["hgt", "HGT"],
	["vx", "VX"],
	["vy", "VY"],
	["tilt", "TILT"],
	["energy", "ENERGY"],
	["wind", "WIND"],
	["link", "LINK"],
	["time", "T"]
], $n = class {
	cells = /* @__PURE__ */ new Map();
	constructor(e) {
		let t = e.ownerDocument;
		e.replaceChildren();
		for (let [n, r] of Qn) {
			let i = t.createElement("div");
			i.className = "inst";
			let a = t.createElement("span");
			a.className = "inst-label", a.textContent = r;
			let o = t.createElement("span");
			o.className = "inst-value", o.dataset.inst = n, i.append(a, o), e.append(i), this.cells.set(n, o);
		}
	}
	update(e) {
		for (let [t, n] of this.cells) n.textContent !== e[t] && (n.textContent = e[t]);
	}
}, er = {
	skyTop: "#2b1a0c",
	skyHorizon: "#b86f2c",
	haze: "rgb(196, 128, 62)",
	panel: "rgb(24, 14, 6)"
}, tr = {
	ground: "#4a2f17",
	mapBack: "#2a190b",
	mapGround: "#5a3a1d",
	mapFog: "#6b4a2b"
}, nr = {
	surfaceScanned: "#e0b47a",
	surfaceFog: "#7a5432",
	fog: "rgb(214, 150, 84)",
	edge: "#a2774a",
	insetTerrain: "rgb(214, 160, 96)",
	mapScanned: "#e0b47a"
}, rr = {
	text: "#f3d6ae",
	badgeText: "rgb(255, 228, 190)",
	insetText: "rgb(255, 244, 228)",
	streak: "rgb(255, 236, 200)",
	mapWindow: "rgb(255, 240, 220)"
}, ir = {
	ghost: "rgb(255, 236, 210)",
	ghostSafe: "rgb(95, 211, 138)",
	planRejected: "rgb(255, 236, 210)",
	planElite: "rgb(255, 200, 140)",
	planChosen: "rgb(255, 255, 255)",
	predictedLine: "#2a1c10"
}, ar = { fallbackLine: "#2a1c10" }, or = {
	target: "#9dffb0",
	insetFrame: "rgb(214, 160, 96)"
}, sr = {
	craftBody: "#e9dcc6",
	craftDeck: "#b9a487",
	craftLine: "#2a1c10",
	rotor: "rgb(255, 238, 210)",
	rtg: "#9c7a52",
	com: "#1a120a",
	comFill: "#f5efe4",
	vector: "#7fe3ff",
	insetCraft: "rgb(255, 244, 228)",
	mapCraft: "#ffffff"
}, cr = {
	hazard: "#dff4ff",
	hazardEdge: "#4d7a96",
	ghostCrash: "rgb(255, 90, 79)",
	weak: "rgb(255, 120, 90)",
	mapHazard: "#dff4ff"
}, lr = {
	sky: er,
	ground: tr,
	terrain: nr,
	text: rr,
	model: ir,
	baseline: ar,
	readout: or,
	craft: sr,
	hazard: cr
}, ur = Object.freeze({
	sky: er.skyTop,
	ground: tr.ground,
	terrain: nr.surfaceScanned,
	text: rr.text,
	model: ir.ghost,
	baseline: ar.fallbackLine,
	readout: or.target,
	craft: sr.craftBody,
	hazard: cr.hazard
}), V = Object.freeze({
	terrainCaption: `terrain: ${Pt}`,
	awaitingTouchdown: "Touchdown predicted: awaiting confirmation",
	insetLabel: "Downlink · {s} s old",
	targetLabel: "{label} (illustrative)",
	simplePilot: "Planner too slow on this device: a simple pilot is flying",
	noModel: "Dream model isn't loaded: flying on a simple physics predictor that ignores wind."
}), dr = Object.keys(ur), fr = Object.keys(V);
function pr(e = {}) {
	let t = {};
	for (let n of dr) {
		let r = e[n];
		for (let [e, i] of Object.entries(lr[n])) t[e] = r ?? i;
	}
	return t;
}
var mr = Object.freeze(pr()), hr = Object.freeze({
	palette: mr,
	text: V,
	inset: !0
});
function gr(e = {}, t = V, n = !0) {
	return {
		palette: pr(e),
		text: t,
		inset: n
	};
}
function _r(e, t, n = console.warn) {
	let r = {}, i = [], a = (e, n) => {
		t.fillStyle = n;
		let r = t.fillStyle;
		return t.fillStyle = e, t.fillStyle !== r;
	};
	for (let n of dr) {
		let o = e?.[n];
		if (o === void 0) continue;
		if (!t) {
			r[n] = o;
			continue;
		}
		if (!a(o, "#000000") && !a(o, "#ffffff")) {
			i.push(`theme.${n} (${JSON.stringify(o)})`);
			continue;
		}
		t.clearRect(0, 0, 1, 1), t.fillRect(0, 0, 1, 1);
		let s = t.getImageData(0, 0, 1, 1)?.data;
		if (!s || s.length < 4) {
			r[n] = o;
			continue;
		}
		r[n] = s[3] >= 255 ? `rgb(${s[0]}, ${s[1]}, ${s[2]})` : `rgba(${s[0]}, ${s[1]}, ${s[2]}, ${Math.round(s[3] / 255 * 1e3) / 1e3})`;
	}
	return i.length > 0 && n(`lander: ${i.join(", ")}: not a colour a canvas accepts, so the default is drawn. Pass a resolved CSS colour (a canvas cannot resolve var(--x); read it with getComputedStyle).`), r;
}
function vr(e) {
	try {
		let t = e.createElement("canvas");
		return t.width = 1, t.height = 1, t.getContext("2d", { willReadFrequently: !0 });
	} catch {
		return null;
	}
}
function H(e, t) {
	let n = e.trim(), r = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(n);
	if (r) {
		let e = r[1].length === 3 ? [...r[1]].map((e) => e + e).join("") : r[1].slice(0, 6), n = Number.parseInt(e, 16);
		return `rgba(${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255}, ${t})`;
	}
	let i = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*[\d.]+%?\s*)?\)$/i.exec(n);
	return i ? `rgba(${i[1]}, ${i[2]}, ${i[3]}, ${t})` : `color-mix(in srgb, ${n} ${Math.round(t * 1e3) / 10}%, transparent)`;
}
function yr(e, t) {
	return e.replace(/\{(\w+)\}/g, (e, n) => n in t ? t[n] : e);
}
//#endregion
//#region src/ui/minimap.ts
var br = {
	window: .4,
	targetDim: .4
};
function xr(e, t, n, r, i, a, o, s, c, l = mr) {
	let u = Infinity, d = -Infinity;
	for (let e = 0; e < k; e++) u = Math.min(u, r.heights[e]), d = Math.max(d, r.heights[e]);
	let f = Math.max(d, o.y), p = Math.max(1, f - u), m = (e) => e / O * t, h = (e) => n - 3 - (e - u) / p * (n - 8);
	e.clearRect(0, 0, t, n), e.fillStyle = l.mapBack, e.fillRect(0, 0, t, n), e.beginPath(), e.moveTo(0, n);
	for (let t = 0; t < k; t++) e.lineTo(m(t * 2), h(r.heights[t]));
	e.lineTo(t, n), e.closePath(), e.fillStyle = l.mapGround, e.fill();
	let g = Math.max(1, t / A);
	for (let t = 0; t < A; t++) e.fillStyle = i[t] === 0 ? l.mapFog : i[t] === 2 ? l.mapHazard : l.mapScanned, e.fillRect(m(t * 4), n - 3, g, 3);
	e.strokeStyle = H(l.mapWindow, br.window), e.lineWidth = 1, e.strokeRect(m(s), 1, Math.max(2, m(c) - m(s)), n - 2);
	for (let t of r.targets) e.fillStyle = Math.abs(t.x - a) < 1e-6 ? l.target : H(l.target, br.targetDim), e.fillRect(m(t.x) - 1, 0, 2, n);
	e.fillStyle = l.mapCraft, e.beginPath(), e.arc(Math.min(t - 2, Math.max(2, m(o.x))), Math.max(3, h(o.y)), 3, 0, Math.PI * 2), e.fill();
}
//#endregion
//#region src/ui/rotorBars.ts
var Sr = {
	you: "you: the command your vector makes now (hollow marker)",
	autopilot: "autopilot: its command now (hollow marker)",
	rotor: "rotor: actual thrust at the shown moment (solid; it lags)"
};
function Cr(e, t, n, r) {
	return {
		cmdLabel: n === "autopilot" ? "autopilot" : "you",
		stations: [{
			name: "Front",
			cmd: e.front,
			rotor: t.sF,
			weak: !!(r & 1)
		}, {
			name: "Rear",
			cmd: e.rear,
			rotor: t.sR,
			weak: !!(r & 2)
		}]
	};
}
var wr = (e) => `${(100 * Math.min(1, Math.max(0, e))).toFixed(1)}%`, Tr = class {
	rows = [];
	legend;
	constructor(e) {
		let t = e.ownerDocument;
		e.replaceChildren();
		for (let n of ["Front", "Rear"]) {
			let r = t.createElement("div");
			r.className = "rotor-row";
			let i = t.createElement("span");
			i.className = "rotor-name", i.textContent = n;
			let a = t.createElement("div");
			a.className = "rotor-track";
			let o = t.createElement("div");
			o.className = "rotor-fill", o.dataset.rotor = n.toLowerCase();
			let s = t.createElement("div");
			s.className = "rotor-cmd", s.dataset.cmd = n.toLowerCase(), a.append(o, s);
			let c = t.createElement("span");
			c.className = "rotor-weak", c.textContent = "weak", c.hidden = !0;
			let l = t.createElement("span");
			l.className = "rotor-value", r.append(i, a, c, l), e.append(r), this.rows.push({
				fill: o,
				marker: s,
				weak: c,
				value: l
			});
		}
		this.legend = t.createElement("div"), this.legend.className = "rotor-legend", e.append(this.legend);
	}
	update(e) {
		e.stations.forEach((t, n) => {
			let r = this.rows[n];
			r.fill.style.width = wr(t.rotor), r.marker.style.left = wr(t.cmd), r.weak.hidden = !t.weak;
			let i = `${e.cmdLabel} ${Math.round(100 * t.cmd)}% · rotor ${Math.round(100 * t.rotor)}%`;
			r.value.textContent !== i && (r.value.textContent = i);
		});
		let t = `${Sr[e.cmdLabel]} · ${Sr.rotor}`;
		this.legend.textContent !== t && (this.legend.textContent = t);
	}
}, Er = "\n.lander-app { --bg: #1a1009; --panel: #2a1a0e; --line: #5a3a20; --text: #f3e2c8; --dim: #c09a72; --ok: #9dffb0; --bad: #ff7a5c; --accent: #7fe3ff;\n  color-scheme: dark; background: var(--bg); color: var(--text); font: 14px/1.4 system-ui, sans-serif;\n  display: flex; flex-direction: column; gap: 8px; }\n.lander-app * { box-sizing: border-box; }\n.lander-app [hidden] { display: none !important; }\n.lander-app .topbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }\n.lander-app .topbar select, .lander-app .topbar button, .lander-app .endcard button, .lander-app .fault-bar button {\n  background: var(--panel); color: var(--text); border: 1px solid var(--line); border-radius: 6px; padding: 5px 10px; font: inherit; }\n.lander-app .topbar select { max-width: 100%; }\n.lander-app button:disabled, .lander-app input:disabled + span { opacity: 0.45; }\n.lander-app .no-model { color: var(--dim); font-size: 13px; }\n.lander-app .stage { position: relative; }\n.lander-app .main-canvas { display: block; width: 100%; aspect-ratio: 16 / 9; border: 1px solid var(--line); border-radius: 8px; outline: none; touch-action: none; }\n.lander-app .main-canvas:focus { border-color: #b98a55; }\n.lander-app .minimap { display: block; width: 100%; height: 36px; border: 1px solid var(--line); border-radius: 6px; }\n.lander-app .fault-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }\n.lander-app .rotor-bars { display: grid; gap: 4px; font-family: ui-monospace, monospace; font-size: 13px; }\n.lander-app .rotor-row { display: grid; grid-template-columns: 48px 1fr auto auto; align-items: center; gap: 8px; }\n.lander-app .rotor-track { position: relative; height: 14px; background: var(--panel); border: 1px solid var(--line); border-radius: 4px; }\n.lander-app .rotor-fill { position: absolute; left: 0; top: 0; bottom: 0; background: #e0b47a; border-radius: 3px; }\n.lander-app .rotor-cmd { position: absolute; top: -3px; width: 10px; height: 18px; margin-left: -5px; border: 2px solid var(--accent); border-radius: 3px; background: transparent; }\n.lander-app .rotor-weak { color: var(--bad); }\n.lander-app .rotor-legend { color: var(--dim); font-size: 12px; }\n.lander-app .instruments { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 6px; }\n.lander-app .inst { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 6px 8px; display: flex; justify-content: space-between; gap: 6px; font-family: ui-monospace, monospace; }\n.lander-app .inst-label { color: var(--dim); }\n.lander-app .touch { display: flex; justify-content: center; }\n.lander-app .vector-pad { position: relative; width: 220px; height: 120px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); touch-action: none; }\n.lander-app .vector-pad-dot { position: absolute; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 50%; background: var(--accent); left: 50%; top: 100%; }\n@media (hover: hover) and (pointer: fine) { .lander-app .touch { display: none; } }\n.lander-app .status, .lander-app .help { color: var(--dim); font-size: 13px; }\n.lander-app .endcard { position: absolute; inset: 10% 20%; background: rgba(42, 26, 14, 0.95); border: 1px solid var(--line); border-radius: 10px; padding: 16px 20px; overflow: auto; }\n.lander-app .endcard h2 { margin: 0 0 8px; }\n.lander-app .endcard .ok { color: var(--ok); }\n.lander-app .endcard .bad { color: var(--bad); }\n.lander-app .endcard table { border-collapse: collapse; width: 100%; font-family: ui-monospace, monospace; font-size: 13px; }\n.lander-app .endcard td { padding: 3px 6px; border-bottom: 1px solid var(--line); }\n.lander-app .endcard-buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }\n@media (max-width: 640px) { .lander-app .endcard { inset: 4%; } }\n.lander-app .control-toggle { display: flex; align-items: center; gap: 4px; }\n.lander-app .control-toggle button[aria-pressed=\"true\"] { border-color: var(--accent); background: #3a2a18; color: #fff; }\n.lander-app .display-note { margin: 6px 0 0; font-size: 13px; color: var(--muted, #cdb89a); max-width: 70ch; }\n";
//#endregion
//#region src/ui/vectorPad.ts
function Dr(e, t, n, r) {
	return !(n > 0) || !(r > 0) ? bt : xt({
		tx: (e - n / 2) / (n / 2),
		ty: (r - t) / r
	});
}
function Or(e, t, n) {
	return [t / 2 + e.tx * (t / 2), n - e.ty * n];
}
var kr = class {
	el;
	onVector;
	dot;
	activePointer = null;
	cleanups = [];
	constructor(e, t) {
		this.el = e, this.onVector = t, this.dot = e.ownerDocument.createElement("div"), this.dot.className = "vector-pad-dot", e.append(this.dot), e.setAttribute("role", "slider"), e.setAttribute("aria-label", "Thrust vector: drag up for more thrust, sideways to lean");
		let n = (t, n) => {
			e.addEventListener(t, n), this.cleanups.push(() => e.removeEventListener(t, n));
		}, r = (t) => {
			let n = e.getBoundingClientRect();
			this.onVector(Dr(t.clientX - n.left, t.clientY - n.top, n.width, n.height));
		};
		n("pointerdown", (t) => {
			t.preventDefault(), this.activePointer === null && (this.activePointer = t.pointerId, e.setPointerCapture?.(t.pointerId), r(t));
		}), n("pointermove", (e) => {
			e.pointerId === this.activePointer && r(e);
		});
		for (let e of [
			"pointerup",
			"pointercancel",
			"lostpointercapture"
		]) n(e, (e) => {
			e.pointerId === this.activePointer && (this.activePointer = null);
		});
	}
	show(e) {
		let t = this.el.getBoundingClientRect(), [n, r] = Or(e, t.width, t.height);
		this.dot.style.left = `${n}px`, this.dot.style.top = `${r}px`;
	}
	detach() {
		for (let e of this.cleanups.splice(0)) e();
		this.activePointer = null;
	}
}, Ar = "Click the view to fly. W/S or ↑/↓ lengthen or shorten the thrust vector, A/D or ←/→ lean it. Commands take 1 s to reach the craft and its state 1 s to come back (game-scaled; the real one-way delay is 67-92 minutes). Click near a flag to choose that target. Esc releases the keys.";
function U(e, t, n, r) {
	let i = e.createElement(t);
	return n && (i.className = n), r !== void 0 && (i.textContent = r), i;
}
function jr(e, t) {
	let n = e.ownerDocument, r = (e, n, r) => e.addEventListener(n, r, { signal: t.signal }), i = U(n, "div", "lander-app");
	i.dataset.landerApp = "";
	let a = U(n, "style");
	a.textContent = Er;
	let o = U(n, "div", "topbar"), s = U(n, "select");
	s.setAttribute("aria-label", "Hop");
	for (let e = 1; e <= 5; e++) {
		let t = U(n, "option", void 0, `Hop ${e}`);
		t.value = String(e), s.append(t);
	}
	let c = U(n, "select");
	c.setAttribute("aria-label", "Conditions"), $t.forEach((e, t) => {
		let r = e[0].toUpperCase() + e.slice(1), i = U(n, "option", void 0, t === 3 ? `${r} (beyond Titan's predicted near-surface winds)` : r);
		i.value = String(t), c.append(i);
	}), c.value = "1";
	let l = Un(n, (e) => t.setMode(e));
	l.setAutopilotAvailable(!1, "The autopilot needs the dream model.");
	let u = U(n, "label", "ghosts-toggle"), d = U(n, "input");
	d.type = "checkbox", d.disabled = !0, d.title = "Ghost futures need the dream model.", u.append(d, U(n, "span", void 0, " Ghosts"));
	let f = U(n, "button", void 0, "New flight");
	f.type = "button", o.append(U(n, "strong", void 0, "Titan rotorcraft"), s, l.el, c, u, f);
	let p = U(n, "div", "no-model", t.noModelText);
	p.dataset.landerNomodel = "";
	let m = U(n, "div", "stage");
	t.canvas.classList.add("main-canvas");
	let h = U(n, "div", "endcard");
	h.hidden = !0, m.append(t.canvas, h);
	let g = U(n, "div", "rotor-bars"), _ = new Tr(g), v = U(n, "canvas", "minimap"), y = U(n, "div", "instruments"), b = new $n(y), x = U(n, "div", "touch"), S = U(n, "div", "vector-pad");
	x.append(S);
	let C = new kr(S, (e) => t.setVector(e)), w = U(n, "div", "status"), ee = U(n, "div", "help", Ar);
	return i.append(a, o, p, m, g, v, y, x, w, ee), e.append(i), r(f, "click", () => t.newFlight()), r(s, "change", () => t.replayHop(Number(s.value))), r(c, "change", () => t.setLevel(Number(c.value))), {
		ui: {
			root: i,
			topBar: o,
			instruments: y,
			status: w,
			noModel: p,
			stage: m,
			canvas: t.canvas,
			endcard: h,
			rotorBars: g,
			controlToggle: l,
			ghostsToggle: d
		},
		flightStarted(e) {
			l.set(e.mode), Yn(h), s.value = String(e.hop), c.value = String(e.baseLevel), w.textContent = "Click the view to start.";
		},
		setMode(e) {
			l.set(e);
		},
		setModel(e) {
			p.hidden = e !== "absent";
		},
		setStatus(e) {
			w.textContent = e;
		},
		showEnd(e, t) {
			Jn(h, e, t);
		},
		frame(e) {
			let t = v.getBoundingClientRect(), n = Math.max(1, t.width), r = Math.max(1, t.height);
			v.width !== Math.round(n * e.dpr) && (v.width = Math.round(n * e.dpr)), v.height !== Math.round(r * e.dpr) && (v.height = Math.round(r * e.dpr));
			let i = v.getContext("2d");
			i && (i.setTransform(e.dpr, 0, 0, e.dpr, 0, 0), xr(i, n, r, e.map, e.knowledge, e.targetX, e.pose, e.viewLeft, e.viewRight, e.palette)), b.update(e.readouts), _.update(e.rotor), C.show(e.vector);
		},
		destroy() {
			C.detach(), i.remove();
		}
	};
}
//#endregion
//#region src/ui/displayChrome.ts
var Mr = "The main craft is the dream's average prediction: where the craft will be in 1 s, when your newest command reaches it. The ghosts show the spread around it; the inset is the real downlink, 1 s old.", W = {
	loading: "Dream prediction loading: showing the physics fallback (ignores wind)",
	stale: "Dream prediction stale: showing the physics fallback (ignores wind)",
	late: "Prediction late: carrying the last average forward",
	awaiting: "Touchdown predicted: awaiting confirmation",
	confirmed: "Touchdown confirmed by the downlink",
	handback: "Handing back: physics fallback until the dream's first prediction"
}, Nr = [
	"Weak front rotor",
	"Weak rear rotor",
	"Gust front",
	"Lidar dropout"
];
function Pr(e) {
	return Nr.filter((t, n) => e >> n & 1).map((e) => `${e}: reached the ground 1 s late, the prediction corrects`);
}
function Fr(e) {
	let t = e.root.ownerDocument.createElement("p");
	t.className = "display-note", t.dataset.landerDisplayNote = "", t.textContent = Mr, t.hidden = !0, e.stage.after(t);
	let n = !1;
	return {
		setPredicting(e) {
			e !== n && (n = e, t.hidden = !n);
		},
		destroy() {
			t.remove();
		}
	};
}
var Ir = { painted: 0 }, G = {
	top: 12,
	pitch: 20,
	panelAlpha: .72,
	textAlpha: .95
};
function Lr(e, t, n = mr) {
	t.length !== 0 && (Ir.painted++, e.save(), e.font = "12px system-ui, sans-serif", e.textBaseline = "top", t.forEach((t, r) => {
		let i = G.top + r * G.pitch;
		e.fillStyle = H(n.panel, G.panelAlpha), e.fillRect(12, i - 3, 8 + 6.5 * t.length, 18), e.fillStyle = H(n.badgeText, G.textAlpha), e.fillText(t, 16, i);
	}), e.restore());
}
var Rr = 31;
function zr(e) {
	return 1 + 30 * e;
}
function Br(e, t, n = Rr) {
	return (e * n + t) * 9;
}
function K(e, t, n, r = Rr) {
	let i = Br(t, n, r);
	return {
		x: e[i],
		y: e[i + 1],
		vx: e[i + 2],
		vy: e[i + 3],
		theta: e[i + 4],
		omega: e[i + 5],
		sF: e[i + 6],
		sR: e[i + 7],
		energyEst: e[i + 8]
	};
}
//#endregion
//#region src/ghosts/touch.ts
function Vr(e) {
	return Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.vx) && Number.isFinite(e.vy) && Number.isFinite(e.theta) && Number.isFinite(e.omega) && Number.isFinite(e.sF) && Number.isFinite(e.sR) && Number.isFinite(e.energyEst);
}
function Hr(e, t, n) {
	if (n) return 0;
	for (let n = 0; n < e.length; n++) {
		if (L(e[n], t) >= 1) return n;
		if (n === 0) continue;
		let r = R(e[n], t);
		if (r < 0 && e[n].vy <= 0 && !st(lt(e[n - 1], e[n], ut(R(e[n - 1], t), r)), t)) return n - 1;
	}
	return -1;
}
function Ur(e, t, n, r) {
	let i = Hr(e, t, r);
	if (i < 0) return null;
	let a = dt(e.slice(i), t, n);
	return a ? {
		...a,
		index: a.index + i
	} : null;
}
var Wr = 2.5, Gr = 35;
function Kr(e, t, n, r) {
	let i = [];
	for (let t = 0; t < Rr; t++) i.push(K(e, 0, t));
	if (!i.every(Vr)) return null;
	let a = Ur(i, t, (e) => e >= 0 && e < 1e3 && n[e] === 2, r);
	return a ? {
		at: a.index - 1 + a.alpha,
		contact: a.contact
	} : null;
}
function qr(e, t, n) {
	let r = (e, t) => e + (t - e) * n;
	return {
		x: r(e.x, t.x),
		y: r(e.y, t.y),
		vx: r(e.vx, t.vx),
		vy: r(e.vy, t.vy),
		theta: e.theta + I(t.theta - e.theta) * n,
		omega: r(e.omega, t.omega),
		sF: r(e.sF, t.sF),
		sR: r(e.sR, t.sR),
		energyEst: r(e.energyEst, t.energyEst)
	};
}
function Jr(e, t) {
	let n = Math.min(30, Math.max(0, t)), r = Math.min(29, Math.floor(n));
	return qr(K(e, 0, r), K(e, 0, r + 1), n - r);
}
function Yr(e, t) {
	if (t > Gr) return null;
	if (e.touchdown && t >= e.touchdown.at) return {
		pose: {
			...Jr(e.mean, e.touchdown.at),
			...e.touchdown.contact.pose
		},
		u: t,
		extrapolated: !1,
		touchedDown: !0
	};
	let n, r = !1;
	if (t <= 30) n = Jr(e.mean, t);
	else {
		let a = K(e.mean, 0, 30), o = K(e.mean, 0, 29), s = (t - 30) * i, c = (a.x - o.x) / i, l = (a.y - o.y) / i, u = I(a.theta - o.theta) / i;
		n = {
			...a,
			x: a.x + c * s,
			y: a.y + l * s,
			theta: a.theta + u * s
		}, r = !0;
	}
	return Vr(n) ? {
		pose: n,
		u: t,
		extrapolated: r,
		touchedDown: !1
	} : null;
}
var Xr = class {
	cur = null;
	prev = null;
	adoptedAt = -Infinity;
	from = null;
	reset() {
		this.cur = null, this.prev = null, this.from = null, this.adoptedAt = -Infinity;
	}
	adopt(e, t, n = null) {
		return this.cur && e.flightId === this.cur.flightId && e.anchorStep <= this.cur.anchorStep ? !1 : (this.prev = this.cur && this.cur.flightId === e.flightId ? this.cur : null, this.from = n, this.cur = e, this.adoptedAt = t, !0);
	}
	get current() {
		return this.cur;
	}
	get started() {
		return this.cur !== null;
	}
	at(e) {
		if (!this.cur) return null;
		let t = Yr(this.cur, e - this.cur.anchorStep);
		if (!t) return null;
		let n = (e - this.adoptedAt) / Wr;
		if (n >= 1) return t;
		let r = this.prev ? Yr(this.prev, e - this.prev.anchorStep)?.pose ?? this.from : this.from;
		return r ? {
			...t,
			pose: qr(r, t.pose, Math.max(0, n))
		} : t;
	}
}, Zr = {
	path: .14,
	sprite: .32,
	marker: .9
}, Qr = .4, $r = 2.5, ei = s / 2, q = 1 / 2, J = q + .2, ti = [
	[
		[-ei, -q],
		[ei, -q],
		[ei, q],
		[-ei, q],
		[-ei, -q]
	],
	[[c, q], [c, J]],
	[[c - l / 2, J], [c + l / 2, J]],
	[[-c, q], [-c, J]],
	[[-c - l / 2, J], [-c + l / 2, J]],
	[[-1, -q], [-1, g]],
	[[1, -q], [1, g]]
], ni = { painted: 0 };
function ri(e, t, n) {
	let r = Math.cos(e.theta), i = Math.sin(e.theta), a = t - d, o = n - f;
	return [e.x + a * r - o * i, e.y + a * i + o * r];
}
function ii(e, t, n) {
	for (let r of ti) e.beginPath(), r.forEach(([r, i], a) => {
		let [o, s] = ri(n, r, i), [c, l] = t.toScreen(o, s);
		a === 0 ? e.moveTo(c, l) : e.lineTo(c, l);
	}), e.stroke();
}
function ai(e, t, n, r = 1) {
	let i = 30 * r;
	if (!n) return i;
	let a = zr(r);
	for (let r = 1; r <= i; r++) {
		let i = K(e, t, r, a);
		if (Math.abs(i.x - n.pose.x) <= .001 && Math.abs(i.y - n.pose.y) <= .001) return r;
	}
	return i;
}
function oi(e, t) {
	let n = e.k, r = zr(n), i = Math.max(0, t - e.anchorStep);
	if (i > 30 * n) return null;
	let a = [];
	for (let t = 0; t < e.n; t++) {
		let o = e.contacts[t] ?? null, s = ai(e.poses, t, o, n), c = Math.min(i, s), l = Math.floor(c), u = Math.min(l + 1, s), d = qr(K(e.poses, t, l, r), K(e.poses, t, u, r), c - l);
		if (!Vr(d)) continue;
		let f = [d.x, d.y];
		for (let n = l + 1; n <= s; n++) {
			let i = K(e.poses, t, n, r);
			if (!Number.isFinite(i.x) || !Number.isFinite(i.y)) break;
			f.push(i.x, i.y);
		}
		a.push({
			pose: d,
			path: f,
			contact: o,
			landed: o !== null && i >= s
		});
	}
	return {
		ghosts: a,
		k: i
	};
}
function si(e, t, n, r = mr) {
	ni.painted++, e.save(), e.lineWidth = 1, e.lineJoin = "round";
	for (let i of n.ghosts) {
		let n = i.contact ? i.contact.safe ? r.ghostSafe : r.ghostCrash : r.ghost;
		if (i.path.length >= 4) {
			e.strokeStyle = H(r.ghost, Zr.path), e.beginPath();
			let [n, a] = t.toScreen(i.path[0], i.path[1]);
			e.moveTo(n, a);
			for (let n = 2; n < i.path.length; n += 2) {
				let [r, a] = t.toScreen(i.path[n], i.path[n + 1]);
				e.lineTo(r, a);
			}
			e.stroke();
		}
		if (e.strokeStyle = H(i.landed ? n : r.ghost, Zr.sprite), ii(e, t, i.pose), i.contact) {
			let [r, a] = ot(i.contact.pose), o = r[1] <= a[1] ? r : a, [s, c] = t.toScreen(o[0], o[1]);
			e.fillStyle = H(n, Zr.marker), e.beginPath(), e.arc(s, c, Math.max($r, Qr * t.pxPerM), 0, 2 * Math.PI), e.fill();
		}
	}
	e.restore();
}
function ci(e, t, n) {
	return {
		toScreen: (r, i) => e.toScreen(r, i, t, n),
		pxPerM: e.scale(t)
	};
}
//#endregion
//#region src/ui/layout.ts
var li = 16 / 9, ui = "lander: opts.aspect 'fill' needs ui 'none' and a container with a definite height; drawing at 16:9 instead";
function di(e) {
	return `display:block;width:100%;${e === "fill" ? "height:100%" : `aspect-ratio:${e}`};touch-action:manipulation`;
}
function fi(e, t) {
	let n = t.style.display;
	t.style.display = "none";
	let r = e.getBoundingClientRect().height;
	return t.style.display = n, r > 0;
}
var pi = {
	w: 176,
	h: 112,
	margin: 12
}, mi = .3;
function hi(e) {
	let t = e < 480, n = mi * e, r = t ? n : Math.min(pi.w, Math.max(120, n));
	return {
		w: r,
		h: r * pi.h / pi.w,
		short: t
	};
}
function gi(e, t) {
	return t ? hi(e).w + pi.margin + 6 : 0;
}
//#endregion
//#region src/ui/downlinkInset.ts
var _i = {
	w: 176,
	h: 112,
	margin: 12,
	spanM: 60
}, vi = { painted: 0 };
function yi(e) {
	let t = hi(e);
	return {
		x: e - t.w - _i.margin,
		y: _i.margin,
		w: t.w,
		h: t.h
	};
}
function bi(e, t, n) {
	return Ci(t, hi(e).short ? xi : n);
}
var xi = "{s} s";
function Si(e, t) {
	let n = e.w / _i.spanM;
	return {
		toScreen: (r, i) => [e.x + e.w / 2 + (r - t.x) * n, e.y + e.h / 2 - (i - t.y) * n],
		pxPerM: n
	};
}
function Ci(e, t = V.insetLabel) {
	return yr(t, { s: e.toFixed(1) });
}
var wi = {
	panel: .78,
	line: .9,
	craft: .95,
	frame: .9,
	text: .95
};
function Ti(e, t, n, r, i = hr) {
	vi.painted++;
	let a = i.palette, o = yi(t), s = Si(o, r.pose);
	e.save(), e.fillStyle = H(a.panel, wi.panel), e.fillRect(o.x, o.y, o.w, o.h), e.beginPath(), e.rect(o.x, o.y, o.w, o.h), e.clip(), e.lineWidth = 1, e.strokeStyle = H(a.insetTerrain, wi.line), e.beginPath();
	let c = r.pose.x - _i.spanM / 2;
	for (let t = 0; t * 2 <= _i.spanM; t++) {
		let r = c + t * 2, [i, a] = s.toScreen(r, P(n, r));
		t === 0 ? e.moveTo(i, a) : e.lineTo(i, a);
	}
	e.stroke(), e.strokeStyle = H(a.insetCraft, wi.craft), ii(e, s, r.pose), e.restore(), e.save(), e.strokeStyle = H(a.insetFrame, wi.frame), e.strokeRect(o.x, o.y, o.w, o.h), i.text && (e.fillStyle = H(a.insetText, wi.text), e.font = "11px system-ui, sans-serif", e.textBaseline = "top", e.fillText(bi(t, r.ageS, i.text.insetLabel), o.x + 6, o.y + 5)), e.restore();
}
//#endregion
//#region src/ui/input.ts
function Ei(e) {
	switch (e) {
		case "ArrowUp":
		case "w":
		case "W": return "up";
		case "ArrowDown":
		case "s":
		case "S": return "down";
		case "ArrowLeft":
		case "a":
		case "A": return "left";
		case "ArrowRight":
		case "d":
		case "D": return "right";
		default: return null;
	}
}
function Di() {
	return {
		up: !1,
		down: !1,
		left: !1,
		right: !1
	};
}
var Oi = class {
	keys = Di();
	vector = bt;
	onFirstInput = null;
	cleanups = [];
	firstFired = !1;
	fireFirst() {
		this.firstFired || (this.firstFired = !0, this.onFirstInput?.());
	}
	releaseAll() {
		this.keys = Di();
	}
	attach(e) {
		let t = (e, t, n) => {
			e.addEventListener(t, n), this.cleanups.push(() => e.removeEventListener(t, n));
		};
		t(e, "keydown", (t) => {
			if (t.ctrlKey || t.metaKey || t.altKey) return;
			if (t.key === "Escape") {
				e.blur();
				return;
			}
			let n = Ei(t.key);
			n && (t.preventDefault(), !t.repeat && (this.keys[n] = !0, this.fireFirst()));
		}), t(e, "keyup", (e) => {
			let t = Ei(e.key);
			t && (e.preventDefault(), this.keys[t] = !1);
		}), t(e, "blur", () => this.releaseAll()), t(window, "blur", () => this.releaseAll()), t(document, "visibilitychange", () => {
			document.hidden && this.releaseAll();
		}), t(e, "pointerdown", () => e.focus());
	}
	detach() {
		for (let e of this.cleanups.splice(0)) e();
		this.releaseAll();
	}
	setVector(e) {
		this.vector = xt(e), this.fireFirst();
	}
	reset(e = bt) {
		this.keys = Di(), this.vector = xt(e), this.firstFired = !1;
	}
	step(e) {
		return this.vector = St(this.vector, this.keys, e), this.vector;
	}
}, ki = .25, Ai = class {
	step;
	maxFrame;
	acc = 0;
	last = null;
	constructor(e = i, t = ki) {
		this.step = e, this.maxFrame = t;
	}
	tick(e) {
		if (this.last === null) return this.last = e, 0;
		let t = Math.min(this.maxFrame, Math.max(0, (e - this.last) / 1e3));
		this.last = e, this.acc += t;
		let n = Math.floor(this.acc / this.step + 1e-9);
		return this.acc -= n * this.step, n;
	}
	alpha() {
		return Math.min(1, Math.max(0, this.acc / this.step));
	}
	reset() {
		this.last = null, this.acc = 0;
	}
}, ji = class {
	info;
	cmds = [];
	targets = [];
	constructor(e) {
		this.info = e;
	}
	recordStep(e, t) {
		if (e !== this.cmds.length) throw Error(`recorder: expected step ${this.cmds.length}, got ${e}`);
		this.cmds.push([t.front, t.rear]);
	}
	recordTarget(e, t) {
		this.targets.push({
			step: e,
			x: t
		});
	}
	get steps() {
		return this.cmds.length;
	}
	finish(e) {
		let t = this.info;
		return {
			version: 2,
			mapSeed: t.mapSeed,
			tier: t.tier,
			startPatch: t.startPatch ? Array.from(t.startPatch) : null,
			level: t.level,
			seed: t.seed,
			start: t.start.start,
			onGround: t.start.onGround,
			targetX: t.start.targetX,
			energy: t.start.energy,
			s: [t.start.s[0], t.start.s[1]],
			events: e.eventLog.map((e) => ({
				step: e.step,
				event: e.event
			})),
			targets: [...this.targets],
			cmds: [...this.cmds],
			outcome: e.contact ? {
				safe: e.contact.safe,
				contactStep: e.contactStep
			} : null,
			recordedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
	}
};
//#endregion
//#region src/ui/wrapText.ts
function Mi(e, t, n) {
	let r = [], i = "";
	for (let a of e.split(/\s+/).filter(Boolean)) {
		let e = i ? `${i} ${a}` : a;
		i && n(e) > t ? (r.push(i), i = a) : i = e;
	}
	return i && r.push(i), r;
}
//#endregion
//#region src/ui/craft.ts
var Y = {
	body: {
		x0: -s / 2,
		y0: -1 / 2,
		x1: s / 2,
		y1: 1 / 2
	},
	deck: {
		x0: -s / 2 + .25,
		y0: 1 / 2 - .16,
		x1: s / 2 - .15,
		y1: 1 / 2
	},
	arms: [[
		s / 2 - .15,
		1 / 2 - .05,
		c,
		.6
	], [
		-s / 2 + .15,
		1 / 2 - .05,
		-c,
		.6
	]],
	rotors: {
		x: [c, -c],
		yLow: .62,
		yHigh: .78,
		half: l / 2,
		hub: .07
	},
	skids: {
		struts: [[
			.7,
			-1 / 2,
			1,
			g
		], [
			-.7,
			-1 / 2,
			-1,
			g
		]],
		runner: [
			-1.3,
			g,
			1.3,
			g
		]
	},
	hga: {
		mastX: .2,
		mastY0: 1 / 2,
		mastY1: .62,
		cy: .66,
		radius: .435,
		depth: .09,
		tilt: .45
	},
	top: g + o,
	bottom: g,
	rtg: {
		x0: -s / 2 - .62,
		y0: -.3,
		x1: -s / 2 - .02,
		y1: .34,
		fins: 5
	},
	com: {
		x: d,
		y: f,
		r: .15
	}
};
2 * (c + l / 2);
function Ni(e) {
	return .12 + .6 * Math.sqrt(Math.min(1, Math.max(0, e)));
}
function Pi(e, t = "craft") {
	let n = t === "model" ? e.predictedLine : t === "baseline" ? e.fallbackLine : e.craftLine;
	return {
		body: e.craftBody,
		deck: e.craftDeck,
		line: n,
		rotor: e.rotor,
		weak: e.weak,
		rtg: e.rtg,
		com: e.com,
		comFill: e.comFill,
		vector: e.vector
	};
}
function Fi(e, t) {
	e.beginPath(), e.moveTo(t[0], t[1]), e.lineTo(t[2], t[3]), e.stroke();
}
function Ii(e, t, n) {
	let r = n.colors ?? Pi(mr), i = Math.max(1, 14 / (a * n.scale)), o = 1.4 / (n.scale * i);
	e.save(), e.translate(t.x, t.y), e.scale(i, i), e.save(), e.rotate(t.theta), e.translate(-d, -f), e.lineWidth = o, e.strokeStyle = r.line, Y.rotors.x.forEach((t, i) => {
		let a = i === 0 ? n.sF : n.sR;
		e.fillStyle = H(n.weak?.[i] ?? !1 ? r.weak : r.rotor, Number(Ni(a).toFixed(3)));
		for (let n of [Y.rotors.yLow, Y.rotors.yHigh]) e.beginPath(), e.ellipse(t, n, Y.rotors.half, .045 + .04 * Math.sqrt(Math.max(0, a)), 0, 0, Math.PI * 2), e.fill();
		e.fillStyle = r.line, e.fillRect(t - Y.rotors.hub / 2, Y.rotors.yLow - .08, Y.rotors.hub, Y.rotors.yHigh - Y.rotors.yLow + .12);
	});
	for (let t of Y.arms) Fi(e, t);
	for (let t of Y.skids.struts) Fi(e, t);
	Fi(e, Y.skids.runner);
	let s = Y.rtg;
	e.fillStyle = r.rtg, e.fillRect(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0), e.strokeRect(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0);
	for (let t = 1; t < s.fins; t++) {
		let n = s.x0 + (s.x1 - s.x0) * t / s.fins;
		Fi(e, [
			n,
			s.y0 - .04,
			n,
			s.y1 + .04
		]);
	}
	let c = Y.body;
	e.fillStyle = r.body, e.fillRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0), e.strokeRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);
	let l = Y.deck;
	e.fillStyle = r.deck, e.fillRect(l.x0, l.y0, l.x1 - l.x0, l.y1 - l.y0);
	let u = Y.hga;
	Fi(e, [
		u.mastX,
		u.mastY0,
		u.mastX,
		u.mastY1
	]), e.beginPath(), e.ellipse(u.mastX, u.cy, u.radius, u.depth, u.tilt, 0, Math.PI), e.stroke();
	let p = Y.com;
	e.fillStyle = r.comFill, e.beginPath(), e.arc(p.x, p.y, p.r, 0, Math.PI * 2), e.fill(), e.stroke(), e.fillStyle = r.com;
	for (let t of [0, Math.PI]) e.beginPath(), e.moveTo(p.x, p.y), e.arc(p.x, p.y, p.r, t, t + Math.PI / 2), e.closePath(), e.fill();
	if (e.restore(), n.vector && (n.vector.tx !== 0 || n.vector.ty !== 0)) {
		let t = n.vector.tx * 4, i = n.vector.ty * 4, a = Math.hypot(t, i), s = t / a, c = i / a, l = Math.min(.6, .4 * a);
		e.strokeStyle = r.vector, e.fillStyle = r.vector, e.lineWidth = 2 * o, e.beginPath(), e.moveTo(0, 0), e.lineTo(t - s * l, i - c * l), e.stroke(), e.beginPath(), e.moveTo(t, i), e.lineTo(t - s * l - c * l * .5, i - c * l + s * l * .5), e.lineTo(t - s * l + c * l * .5, i - c * l - s * l * .5), e.closePath(), e.fill();
	}
	e.restore();
}
//#endregion
//#region src/ui/render.ts
var Li = {
	fog: .18,
	targetDim: .45,
	hazeFar: .85
};
function Ri(e, t, n, r, i) {
	let a = i.style ?? hr, o = a.palette, s = i.camera, c = s.scale(t);
	e.setTransform(r, 0, 0, r, 0, 0);
	let l = e.createLinearGradient(0, 0, 0, n);
	l.addColorStop(0, o.skyTop), l.addColorStop(1, o.skyHorizon), e.fillStyle = l, e.fillRect(0, 0, t, n), e.setTransform(r * c, 0, 0, -r * c, r * (t / 2 - s.cx * c), r * (n / 2 + s.cy * c));
	let u = s.cx - s.width / 2 - 2, d = s.cx + s.width / 2 + 2, f = s.cy - n / c;
	Ui(e, i.map, u, d, f, c, o), Wi(e, i, u, d, c, o), Qi(e, i, c, a, t, n), i.streaks?.draw(e, i.field, c, o.streak), Ii(e, i.display, {
		sF: i.display.sF,
		sR: i.display.sR,
		weak: i.weak,
		vector: i.vector,
		scale: c,
		colors: Pi(o, i.tint ?? "craft")
	}), $i(e, i.display.x, u, d, f, s.cy + n / c, o), e.setTransform(r, 0, 0, r, 0, 0);
}
var X = {
	x: 8,
	bottom: 8,
	line: 14,
	ascent: 11,
	descent: 3,
	clearance: 40,
	font: "11px ui-monospace, monospace"
}, zi = {
	line: 11,
	ascent: 8,
	descent: 2,
	font: "9px system-ui, sans-serif"
};
function Bi(e, t, n, r, i) {
	return Math.hypot(Math.max(t - e[0], 0, e[0] - n), Math.max(r - e[1], 0, e[1] - i));
}
function Vi(e, t, n, r, i, a, o = !1) {
	let s = o ? zi : X, c = e.length, l = X.x, u = X.x + Math.max(0, ...t), d = G.top + a * G.pitch + s.ascent, f = e.map((e, t) => d + t * s.line), p = e.map((e, t) => r - X.bottom - (c - 1 - t) * s.line);
	return o ? Bi(i, l, u, d - s.ascent, (f[c - 1] ?? d) + s.descent) < X.clearance ? {
		at: "bottom",
		lines: e,
		baselines: p
	} : {
		at: "top",
		lines: e,
		baselines: f
	} : Bi(i, l, u, (p[0] ?? r) - s.ascent, r - X.bottom + s.descent) < X.clearance ? {
		at: "top",
		lines: e,
		baselines: f
	} : {
		at: "bottom",
		lines: e,
		baselines: p
	};
}
function Hi(e, t, n, r, i, a, o, s = 0) {
	e.save(), e.fillStyle = i.text;
	let c = t < 480, l = c ? zi : X;
	e.font = l.font, e.textBaseline = "alphabetic";
	let u = Mi(r, t - 2 * X.x - (c ? s : 0), (t) => e.measureText(t).width), d = u.map((t) => e.measureText(t).width), f = Vi(u, d, t, n, a, o, c);
	f.lines.forEach((t, n) => e.fillText(t, X.x, f.baselines[n])), e.restore();
	let p = (f.baselines[0] ?? 0) - l.ascent, m = (f.baselines[f.baselines.length - 1] ?? 0) + l.descent;
	return {
		...f,
		box: {
			x: X.x,
			y: p,
			w: Math.max(0, ...d),
			h: Math.max(0, m - p)
		}
	};
}
function Ui(e, t, n, r, i, a, o) {
	let s = Math.max(0, Math.ceil(n / 2) * 2), c = Math.min(O, r);
	e.beginPath(), e.moveTo(n, i), e.lineTo(n, P(t, n));
	for (let n = s; n <= c; n += 2) e.lineTo(n, P(t, n));
	e.lineTo(r, P(t, r)), e.lineTo(r, i), e.closePath(), e.fillStyle = o.ground, e.fill(), e.strokeStyle = o.edge, e.lineWidth = 1 / a, e.setLineDash([4 / a, 4 / a]);
	for (let a of [0, O]) a < n || a > r || (e.beginPath(), e.moveTo(a, i), e.lineTo(a, P(t, a) + 2e3), e.stroke());
	e.setLineDash([]);
}
function Wi(e, t, n, r, i, a) {
	let o = Math.max(0, F(n)), s = Math.min(A - 1, F(r)), c = 8 / i;
	for (let n = o; n <= s; n++) {
		let r = n * 4, o = r + 4, s = P(t.map, r), l = P(t.map, o), u = t.knowledge[n];
		if (e.strokeStyle = u === 0 ? a.surfaceFog : a.surfaceScanned, e.lineWidth = (u === 0 ? 1 : 2) / i, e.beginPath(), e.moveTo(r, s), e.lineTo(o, l), e.stroke(), u === 0) e.fillStyle = H(a.fog, Li.fog), e.beginPath(), e.moveTo(r, s), e.lineTo(o, l), e.lineTo(o, l + c), e.lineTo(r, s + c), e.closePath(), e.fill();
		else if (u === 2) {
			e.fillStyle = a.hazard, e.strokeStyle = a.hazardEdge, e.lineWidth = 1 / i;
			for (let i = 0; i < 2; i++) {
				let a = r + (.25 + .5 * i) * 4, o = .5 + .3 * ((n * 7 + i * 3) % 5 / 4);
				e.beginPath(), e.arc(a, P(t.map, a) + o * .7, o, 0, Math.PI * 2), e.fill(), e.stroke();
			}
		}
	}
}
var Gi = {
	len: 9,
	width: 10,
	inset: 3,
	gap: 3
};
function Ki(e, t, n, r, i = []) {
	let { len: a, width: o, inset: s, gap: c } = Gi, l = e < 0 || e > n;
	if (!l && t >= 0 && t <= r) return null;
	let u = l ? e > n ? 1 : -1 : t > r ? 1 : -1, d = l ? n : r, f = l ? r : n, p = u > 0 ? d - s : s, m = p - u * a, [h, g] = [Math.min(p, m), Math.max(p, m)], _ = o, v = f - o;
	for (let e of i) {
		let [t, n, r, i] = l ? [
			e.x,
			e.x + e.w,
			e.y,
			e.y + e.h
		] : [
			e.y,
			e.y + e.h,
			e.x,
			e.x + e.w
		];
		n <= h || t >= g || ((r + i) / 2 < f / 2 ? _ = Math.max(_, i + c + o / 2) : v = Math.min(v, r - c - o / 2));
	}
	let y = Math.min(v, Math.max(_, l ? t : e)), b = (e, t) => l ? [e, t] : [t, e];
	return [
		b(p, y),
		b(m, y - o / 2),
		b(m, y + o / 2)
	];
}
function qi(e, t, n, r, i, a = []) {
	let [o, s] = t.camera.toScreen(t.targetX, P(t.map, t.targetX), n, r), c = Ki(o, s, n, r, a);
	c && (e.fillStyle = i.target, e.beginPath(), e.moveTo(...c[0]), e.lineTo(...c[1]), e.lineTo(...c[2]), e.closePath(), e.fill());
}
var Ji = 4, Yi = 2, Xi = 13;
function Zi(e, t, n, r, i = Ji, a = Yi) {
	let o = {
		side: "right",
		lines: [t],
		dx: a
	}, s = r(t);
	if (!Number.isFinite(s) || !(e >= 0 && e <= n)) return o;
	let c = n - i - Math.max(e + a, i), l = Math.min(e - a, n - i) - i;
	return s <= c ? e + a >= i ? o : {
		...o,
		dx: i - e
	} : s <= l ? {
		side: "left",
		lines: [t],
		dx: -a
	} : c >= l ? {
		side: "right",
		lines: Mi(t, c, r),
		dx: Math.max(a, i - e)
	} : {
		side: "left",
		lines: Mi(t, l, r),
		dx: -a
	};
}
function Qi(e, t, n, r, i, a) {
	let o = r.palette, s = H(o.target, Li.targetDim);
	for (let c of t.map.targets) {
		let l = Math.abs(c.x - t.targetX) < 1e-6, u = P(t.map, c.x), d = 18 / n + 3;
		if (e.strokeStyle = l ? o.target : s, e.fillStyle = l ? o.target : s, e.lineWidth = 1.5 / n, e.beginPath(), e.moveTo(c.x, u), e.lineTo(c.x, u + d), e.stroke(), e.beginPath(), e.moveTo(c.x, u + d), e.lineTo(c.x + 10 / n + 1.5, u + d - 5 / n - .8), e.lineTo(c.x, u + d - 10 / n - 1.6), e.closePath(), e.fill(), l && (e.beginPath(), e.moveTo(c.x - 1, P(t.map, c.x - 1) + .5), e.lineTo(c.x - 1, P(t.map, c.x - 1)), e.lineTo(c.x + 1, P(t.map, c.x + 1)), e.lineTo(c.x + 1, P(t.map, c.x + 1) + .5), e.stroke()), !r.text) continue;
		e.save(), e.font = "11px system-ui, sans-serif";
		let f = yr(r.text.targetLabel, { label: c.label }), [p] = t.camera.toScreen(c.x, u, i, a), m = Zi(p, f, i, (t) => e.measureText(t).width);
		e.translate(c.x + m.dx / n, u + d + 4 / n), e.scale(1 / n, -1 / n), m.side === "left" && (e.textAlign = "right"), m.lines.forEach((t, n) => e.fillText(t, 0, (n - (m.lines.length - 1)) * Xi)), e.restore();
	}
}
function $i(e, t, n, r, i, a, o) {
	for (let s of [-1, 1]) {
		let c = e.createLinearGradient(t + s * 100, 0, t + s * 400, 0);
		c.addColorStop(0, H(o.haze, 0)), c.addColorStop(1, H(o.haze, Li.hazeFar)), e.fillStyle = c;
		let l = s < 0 ? n : t + 100, u = s < 0 ? t - 100 : r;
		u > l && e.fillRect(l, i, u - l, a - i);
	}
}
var ea = [2, 6], ta = 1.5, na = class {
	rng;
	count;
	streaks = [];
	constructor(e, t = 140) {
		this.rng = e, this.count = t;
	}
	spawn(e, t) {
		let n = e.left + (e.right - e.left) * this.rng.next(), r = Math.max(e.bottom, t(n) + .5);
		return {
			x: n,
			y: r + Math.max(0, e.top - r) * this.rng.next(),
			age: 0,
			life: ea[0] + (ea[1] - ea[0]) * this.rng.next()
		};
	}
	reset() {
		this.streaks.length = 0;
	}
	update(e, t, n, r) {
		for (; this.streaks.length < this.count;) {
			let e = this.spawn(n, r);
			e.age = e.life * this.rng.next(), this.streaks.push(e);
		}
		for (let i = 0; i < this.streaks.length; i++) {
			let a = this.streaks[i], [o, s] = t(a.x, a.y);
			a.x += o * e, a.y += s * e, a.age += e;
			let c = a.x < n.left || a.x > n.right || a.y < n.bottom || a.y > n.top;
			(a.age > a.life || c || a.y < r(a.x)) && (this.streaks[i] = this.spawn(n, r));
		}
	}
	draw(e, t, n, r = "rgb(255, 236, 200)") {
		e.lineWidth = 1.2 / n;
		for (let n of this.streaks) {
			let [i, a] = t(n.x, n.y), o = Math.hypot(i, a);
			if (o < .001) continue;
			let s = Math.min(1, n.age / .4, (n.life - n.age) / .4);
			e.strokeStyle = H(r, Number((Math.max(0, s) * Math.min(.7, .2 + o / 6)).toFixed(3))), e.beginPath(), e.moveTo(n.x, n.y), e.lineTo(n.x - i * ta, n.y - a * ta), e.stroke();
		}
	}
};
function ra(e, t) {
	let n = new URL(e.assetBase, t).href, r = typeof window < "u" && typeof window.matchMedia == "function" ? window.matchMedia : null;
	return {
		...e,
		assetBase: n.endsWith("/") ? n : `${n}/`,
		reducedMotion: e.reducedMotion ?? (r ? r("(prefers-reduced-motion: reduce)").matches : !1),
		manageVisibility: e.manageVisibility ?? !0,
		ui: e.ui ?? "full"
	};
}
function ia(e, t) {
	return Cn(e.world, e.link, t);
}
function aa(e, t) {
	let n = e.world, r = e.link.downlinkStep(t), i = r < n.records.length ? n.records[r] : null, a = i ? {
		state: i.state,
		onGround: i.onGround
	} : {
		state: n.state,
		onGround: n.onGround
	}, o = i ? i.faultBits : ke(n.faults, n.step), s = yt(n.map, a, o, r, ia(e, t)), c = s[Math.min(s.length - 1, t + 10 - r - 1)].state;
	return {
		x: c.x,
		y: c.y,
		vx: c.vx,
		vy: c.vy,
		theta: c.theta,
		omega: c.omega,
		sF: c.sF,
		sR: c.sR,
		energyEst: c.energyEst
	};
}
function oa(e, t) {
	let n = e.world;
	return e.mode === "autopilot" ? n.knowledge() : Ot(n.revealedAt, n.hazardFrom, e.link.downlinkStep(t));
}
function sa(e, t) {
	if (e.mode === "autopilot") return {
		pose: Sn(e.world, t),
		source: "onboard",
		age: 0
	};
	let n = e.world;
	if (n.done && (e.ended || t - 10 >= n.step)) return {
		pose: Sn(n, n.step),
		source: "downlink",
		age: 0
	};
	let r = Math.floor(t), a = t - r, o = aa(e, r);
	if (a < 1e-9) return {
		pose: o,
		source: "fallback",
		age: -10 * i
	};
	let s = aa(e, r + 1), c = lt(o, s, a), l = (e, t) => e + (t - e) * a;
	return {
		pose: {
			...c,
			sF: l(o.sF, s.sF),
			sR: l(o.sR, s.sR),
			energyEst: l(o.energyEst, s.energyEst)
		},
		source: "fallback",
		age: -10 * i
	};
}
function ca(e) {
	return e.source === "predicted" ? "model" : e.source === "fallback" ? "baseline" : "craft";
}
function la(e, t) {
	return new ua(e, t);
}
var ua = class {
	doc;
	opts;
	style;
	theme;
	features;
	chrome;
	ui;
	root;
	canvas;
	input = new Oi();
	clock = new Ai();
	camera;
	lastView = {
		altitude: 0,
		groundY: 0,
		h: 0
	};
	streaks = new na(j(87));
	listeners = new AbortController();
	reasons = /* @__PURE__ */ new Set();
	chainState = nn(1);
	current = null;
	nextFlightId = 1;
	startToken = 0;
	startIssued = !1;
	starting = null;
	mode = "manual";
	model = "absent";
	raf = null;
	lastFrame = null;
	frames = 0;
	focusedBeforeClick = !1;
	fillCheck = !1;
	dead = !1;
	destroying = null;
	commands = {
		newFlight: (e) => {
			this.dead || (e.level !== void 0 && (this.chainState = {
				...this.chainState,
				baseLevel: e.level
			}), this.startFlight({
				hop: e.hop,
				start: "pad",
				mode: "manual",
				attract: !1
			}));
		},
		setLevel: (e) => {
			this.dead || (this.chainState = {
				...this.chainState,
				baseLevel: e
			});
		},
		setAutopilot: (e) => this.afterStart(() => this.setAutopilot(e)),
		setInput: (e) => this.afterStart(() => this.controlInput(e)),
		injectFault: (e) => this.afterStart(() => this.injectFault(e))
	};
	constructor(e, t) {
		this.doc = e.ownerDocument, this.opts = ra(t, this.doc.baseURI);
		let n = this.opts.theme && Object.keys(this.opts.theme).length > 0 ? this.opts.theme : void 0;
		this.theme = Object.freeze(n ? _r(n, vr(this.doc)) : {}), this.style = gr(this.theme, this.opts.text === void 0 ? V : this.opts.text, this.opts.inset ?? !0), this.camera = new Bn(this.opts.zoom ?? 1), this.features = [...t.features ?? []];
		let r = this.doc, i = (e, t, n) => e.addEventListener(t, n, { signal: this.listeners.signal });
		this.canvas = r.createElement("canvas"), this.canvas.className = "main-canvas", this.canvas.tabIndex = 0, this.canvas.setAttribute("aria-label", "Rotorcraft view. Click to fly; Escape releases the keys.");
		let a = this.opts.aspect ?? 1.7777777777777777;
		this.opts.ui === "none" ? (this.canvas.style.cssText = di(a), this.fillCheck = a === "fill", this.chrome = null, this.root = this.canvas, e.append(this.canvas)) : (this.chrome = jr(e, {
			canvas: this.canvas,
			signal: this.listeners.signal,
			noModelText: this.style.text?.noModel ?? "Dream model isn't loaded: flying on a simple physics predictor that ignores wind.",
			setMode: (e) => Pn(this.commands, "setAutopilot", e === "autopilot"),
			newFlight: () => Pn(this.commands, "newFlight"),
			replayHop: (e) => void this.startFlight({
				hop: e,
				seed: this.chainState.seed,
				start: "pad",
				mode: "manual",
				attract: !1
			}),
			setLevel: (e) => {
				Pn(this.commands, "setLevel", e), this.startFlight({
					hop: this.current?.hop ?? 1,
					seed: this.chainState.seed,
					start: "pad",
					mode: "manual",
					attract: !1
				});
			},
			setVector: (e) => this.input.setVector(e)
		}), this.root = this.chrome.ui.root, a === "fill" && console.warn(ui), this.canvas.style.aspectRatio = String(a === "fill" ? li : a)), this.ui = this.chrome?.ui ?? null, this.input.attach(this.canvas), this.input.onFirstInput = () => this.beginCurrent(), i(this.canvas, "focus", () => this.beginCurrent()), i(this.canvas, "pointerdown", () => {
			this.focusedBeforeClick = r.activeElement === this.canvas;
		}), i(this.canvas, "click", (e) => {
			let t = this.current;
			if (!this.focusedBeforeClick || !t || t.ended) return;
			let n = this.canvas.getBoundingClientRect(), r = this.camera.screenToWorldX(e.clientX - n.left, n.width), i = [...t.world.map.targets].sort((e, t) => Math.abs(e.x - r) - Math.abs(t.x - r))[0];
			i && Math.abs(i.x - r) < 60 && (t.pendingTarget = i.x);
		}), this.opts.manageVisibility && i(r, "visibilitychange", () => r.hidden ? this.addReason("hidden") : this.removeReason("hidden")), this.setModelState("absent");
		let o = {
			startFlight: (e) => this.startFlight(e),
			setMode: (e) => this.setMode(e),
			flight: () => this.current,
			setModelState: (e) => this.setModelState(e),
			chain: () => this.chainState,
			opts: this.opts,
			canvas: this.canvas,
			...this.ui ? { ui: this.ui } : {},
			command: (e, ...t) => Pn(this.commands, e, ...t),
			recording: () => this.current ? this.current.recorder.finish(this.current.world) : null
		};
		for (let e of this.features) e.mount?.(this.ui, o);
		this.startIssued || this.startFlight({
			start: "pad",
			mode: "manual",
			attract: !1
		}), this.opts.manageVisibility && r.hidden && this.addReason("hidden"), this.schedule();
	}
	pause() {
		this.addReason("host");
	}
	resume() {
		this.removeReason("host");
	}
	debug() {
		let e = this.current;
		return {
			simTime: e ? e.world.state.t : 0,
			frames: this.frames,
			flightId: e ? e.flightId : 0,
			mode: e ? e.mode : this.mode,
			attract: e ? e.attract : !1,
			model: this.model,
			agl: e ? L(e.world.state, e.world.map) : 0,
			hop: e ? e.hop : 1,
			level: e ? e.level : this.chainState.baseLevel,
			groundStep: e ? e.groundStep : 0,
			worldStep: e ? e.world.step : 0,
			cameraWidth: this.camera.width,
			cameraAltitude: this.lastView.altitude,
			cameraPlainWidth: In(this.lastView.altitude),
			groundScreenY: this.lastView.groundY,
			viewHeight: this.lastView.h,
			theme: this.theme
		};
	}
	destroy() {
		return this.destroying ? this.destroying : (this.dead = !0, this.raf !== null && cancelAnimationFrame(this.raf), this.raf = null, this.listeners.abort(), this.input.detach(), this.chrome?.destroy(), this.current && (this.current.ended = !0), this.root.remove(), this.destroying = (async () => {
			for (let e of this.features) try {
				await e.destroy?.();
			} catch (e) {
				console.error("lander: a feature failed to destroy", e);
			}
		})(), this.destroying);
	}
	startFlight(e, t = null) {
		if (this.dead) return Promise.resolve();
		let n = this.applyStart(e, t);
		this.starting = n;
		let r = () => {
			this.starting === n && (this.starting = null);
		};
		return n.then(r, r), n;
	}
	async applyStart(e, t) {
		this.startIssued = !0;
		let n = ++this.startToken, r = cn(this.chainState, e, this.current?.hop ?? null, () => Math.random() * 2 ** 32 >>> 0);
		this.chainState = r.chain;
		let i = r.plan.hop;
		if (await Promise.resolve(), n !== this.startToken || (this.starting = null, this.dead)) return;
		let { plan: a, worldSeed: o, events: s } = r, c = a.level, l = Qt({
			seed: a.mapSeed,
			tier: a.tier,
			startPatch: t ?? void 0
		}), u = gn(l, new Uint8Array(A)), d = e.start === "air" ? fn(l, j(o), "transit", u) : dn(l, u), f = new On({
			map: l,
			level: c,
			seed: o,
			start: d.start,
			onGround: d.onGround,
			targetX: d.targetX,
			energy: d.energy,
			s: d.s,
			events: s
		}), p = new _t();
		p.reset({
			front: 0,
			rear: 0
		}, 0), this.current && (this.current.ended = !0);
		let m = j(o).fork(250), h = {
			flightId: this.nextFlightId++,
			hop: i,
			level: c,
			world: f,
			link: p,
			attract: e.attract,
			mode: e.mode,
			ended: !1,
			vector: {
				tx: 0,
				ty: 0
			},
			chainSeed: this.chainState.seed,
			start: d,
			startPatch: t,
			recorder: new ji({
				mapSeed: a.mapSeed,
				tier: a.tier,
				startPatch: t,
				level: c,
				seed: o,
				start: d
			}),
			cmd: {
				front: 0,
				rear: 0
			},
			mixOut: {
				front: 0,
				rear: 0
			},
			knowledge: f.knowledge(),
			started: !1,
			pendingTarget: null,
			recordedTarget: f.targetX,
			groundStep: 0,
			contactAt: -1,
			liveWind: [],
			faultRng: () => m.int(2)
		};
		this.current = h, this.mode = e.mode, this.input.reset(), this.clock.reset(), this.camera.reset(), this.streaks = new na(j(o).fork(87)), this.chrome?.flightStarted({
			hop: i,
			mode: e.mode,
			baseLevel: this.chainState.baseLevel
		});
		for (let e of this.features) e.onFlightStart?.(h);
		(e.attract || e.mode === "autopilot") && this.begin(h), this.publish();
	}
	setMode(e) {
		this.mode = e;
		let t = this.current;
		t && t.mode !== e && (t.mode = e, t.knowledge = oa(t, t.groundStep), this.chrome?.setMode(e), e === "manual" && (t.attract = !1), this.signal({
			type: "mode",
			flightId: t.flightId,
			mode: e
		}), this.publish());
	}
	setModelState(e) {
		this.model = e, this.chrome?.setModel(e), this.publish();
	}
	signal(e) {
		try {
			this.opts.onFlight?.(e);
		} catch (e) {
			console.error("lander: onFlight handler threw", e);
		}
	}
	afterStart(e) {
		let t = this.starting;
		if (this.dead) return;
		if (!t) {
			e();
			return;
		}
		let n = () => this.afterStart(e);
		t.then(n, n);
	}
	beginCurrent() {
		this.current && this.begin(this.current);
	}
	begin(e) {
		this.dead || e.started || e.ended || (e.started = !0, this.clock.reset(), this.chrome?.setStatus(""), this.signal({
			type: "start",
			flightId: e.flightId,
			hop: e.hop,
			level: e.level,
			mode: e.mode,
			attract: e.attract
		}));
	}
	fault(e) {
		let t = this.current;
		!t || t.ended || t.world.done || t.world.applyEvent(e);
	}
	injectFault(e) {
		let t = this.current;
		this.dead || !t || t.ended || t.world.done || this.fault(e === "weakRotor" ? {
			kind: e,
			station: t.faultRng()
		} : { kind: e });
	}
	setAutopilot(e) {
		let t = this.current;
		if (!(this.dead || !t || t.ended)) {
			if (!e) {
				t.mode === "autopilot" && this.setMode("manual");
				return;
			}
			this.model === "ready" && t.mode !== "autopilot" && (this.setMode("autopilot"), this.begin(t));
		}
	}
	controlInput(e) {
		let t = this.current;
		if (!this.dead && t) {
			for (let e of this.features) e.onControlInput?.(t);
			this.input.setVector({
				tx: e.x,
				ty: e.y
			});
		}
	}
	display(e, t) {
		for (let n of this.features) {
			let r = n.displayPose?.(e, t);
			if (r) return r;
		}
		return sa(e, t);
	}
	addReason(e) {
		if (this.dead || this.reasons.has(e)) return;
		let t = this.reasons.size === 0;
		if (this.reasons.add(e), t) {
			this.raf !== null && cancelAnimationFrame(this.raf), this.raf = null;
			for (let e of this.features) e.onPause?.();
		}
	}
	removeReason(e) {
		if (!(this.dead || !this.reasons.delete(e) || this.reasons.size > 0)) {
			this.clock.reset(), this.lastFrame = null, this.schedule();
			for (let e of this.features) e.onResume?.();
		}
	}
	schedule() {
		this.dead || this.raf !== null || this.reasons.size > 0 || (this.raf = requestAnimationFrame((e) => this.frame(e)));
	}
	frame(e) {
		if (this.raf = null, this.dead || this.reasons.size > 0) return;
		this.schedule(), this.frames++;
		let t = this.lastFrame === null ? 0 : Math.min(.1, (e - this.lastFrame) / 1e3);
		this.lastFrame = e;
		let n = this.current;
		if (n) {
			if (n.started && !n.ended) {
				let t = Math.min(3, this.clock.tick(e));
				for (let e = 0; e < t && !n.ended; e++) this.stepOnce(n);
			}
			this.draw(n, t);
		}
	}
	stepOnce(e) {
		let t = e.world;
		if (!t.done) {
			e.pendingTarget !== null && (t.setTarget(e.pendingTarget), e.pendingTarget = null), this.recordTarget(e), e.vector = this.input.step(i);
			let n = Tt(e.vector, this.display(e, e.groundStep).pose.theta);
			e.mixOut = n;
			let r = null;
			for (let t of this.features) {
				let i = t.command?.(e, n);
				if (i) {
					r = i;
					break;
				}
			}
			this.recordTarget(e);
			let a;
			r ? (a = M(r), e.link.reset(a, t.step + 1)) : (e.link.send(n, t.step), a = e.link.arriving(t.step)), e.cmd = a, e.recorder.recordStep(t.step, a), t.advance(a), e.liveWind.push(t.windAt(t.state.x, t.state.y)[0]);
			for (let t of this.features) t.afterStep?.(e);
			this.recordTarget(e), t.done && (e.contactAt = t.step);
		}
		e.groundStep++, e.knowledge = oa(e, e.groundStep), t.done && e.groundStep >= e.contactAt + (e.mode === "manual" ? 10 : 0) ? this.end(e) : t.done && this.chrome?.setStatus("Touchdown awaiting confirmation…");
	}
	recordTarget(e) {
		let t = e.world;
		t.targetX !== e.recordedTarget && (e.recorder.recordTarget(t.step, t.targetX), e.recordedTarget = t.targetX);
	}
	end(e) {
		e.ended = !0;
		let t = e.world.contact;
		if (!t) return;
		this.chrome?.setStatus("");
		for (let t of this.features) t.onTouchdown?.(e);
		this.signal({
			type: "touchdown",
			flightId: e.flightId,
			hop: e.hop,
			level: e.level,
			mode: e.mode,
			safe: t.safe
		});
		let n = e.start.energy - e.world.state.energyEst, r = [...this.chainState.results];
		r[e.hop - 1] = {
			safe: t.safe,
			energyUsed: n,
			landedX: t.pose.x
		}, this.chainState = {
			...this.chainState,
			results: r
		}, this.publish(), !e.attract && this.chrome?.showEnd({
			contact: t,
			hop: e.hop,
			level: e.level,
			energyUsedJ: n
		}, {
			again: () => void this.startFlight({
				hop: e.hop,
				seed: e.chainSeed,
				start: "pad",
				mode: "manual",
				attract: !1
			}, e.startPatch),
			next: () => void this.startFlight({
				hop: e.hop + 1,
				start: "pad",
				mode: e.mode,
				attract: !1
			}, Zt(e.world.map, t.pose.x))
		});
	}
	draw(e, t) {
		if (this.fillCheck) {
			this.fillCheck = !1;
			let e = this.canvas.parentElement;
			(!e || !fi(e, this.canvas)) && (console.warn(ui), this.canvas.style.height = "", this.canvas.style.aspectRatio = String(li));
		}
		let n = window.devicePixelRatio || 1, r = this.canvas.getBoundingClientRect(), a = Math.max(1, r.width), o = Math.max(1, r.height);
		(this.canvas.width !== Math.round(a * n) || this.canvas.height !== Math.round(o * n)) && (this.canvas.width = Math.round(a * n), this.canvas.height = Math.round(o * n));
		let s = e.world, c = this.shown(e), { displayStep: l, display: u, shownRow: d, shownBits: f, meanU: p, liveU: m } = c, h = u.pose, g = P(s.map, h.x);
		this.camera.update(h, g, t, o / a), this.lastView = {
			altitude: h.y - g,
			groundY: this.camera.toScreen(h.x, g, a, o)[1],
			h: o
		};
		let _ = (e, t) => s.windAt(e, t), v = {
			left: this.camera.cx - this.camera.width / 2,
			right: this.camera.cx + this.camera.width / 2,
			bottom: g - 5,
			top: this.camera.cy + this.camera.width * o / a / 2
		};
		this.opts.reducedMotion || this.streaks.update(t, _, v, (e) => P(s.map, e));
		let y = this.canvas.getContext("2d");
		if (y) {
			Ri(y, a, o, n, {
				map: s.map,
				knowledge: e.knowledge,
				targetX: s.targetX,
				display: h,
				weak: [!!(f & 1), !!(f & 2)],
				vector: e.mode === "manual" ? e.vector : null,
				camera: this.camera,
				streaks: this.opts.reducedMotion ? null : this.streaks,
				field: _,
				style: this.style,
				tint: this.featureState(e).planner === "simple-pilot" ? "baseline" : ca(u)
			});
			let t = {
				flight: e,
				camera: this.camera,
				w: a,
				h: o,
				dpr: n,
				displayStep: l,
				display: u,
				style: this.style
			};
			for (let e of this.features) e.draw && (y.save(), y.setTransform(n, 0, 0, n, 0, 0), e.draw(y, t), y.restore());
			let r = this.style.inset && this.features.some((e) => e.insetDrawn?.() === !0), i = r ? [yi(a)] : [], c = this.style.text;
			if (c) {
				let t = this.features.flatMap((t) => t.badges?.(e, c) ?? []);
				!this.chrome && this.model === "absent" && t.unshift(c.noModel), y.save(), y.setTransform(n, 0, 0, n, 0, 0), Lr(y, t, this.style.palette);
				let s = this.camera.toScreen(h.x, h.y, a, o);
				i.push(Hi(y, a, o, c.terrainCaption, this.style.palette, s, t.length, gi(a, r)).box), y.restore();
			}
			y.save(), y.setTransform(n, 0, 0, n, 0, 0), qi(y, {
				camera: this.camera,
				map: s.map,
				targetX: s.targetX
			}, a, o, this.style.palette, i), y.restore();
		}
		this.opts.onState?.(this.stateOf(e, c)), this.chrome && this.chrome.frame({
			map: s.map,
			knowledge: e.knowledge,
			targetX: s.targetX,
			pose: h,
			viewLeft: this.camera.cx - this.camera.width / 2,
			viewRight: this.camera.cx + this.camera.width / 2,
			readouts: Zn({
				display: h,
				source: u.source,
				age: u.age,
				clearance: L(h, s.map),
				meanU: p,
				liveU: m,
				t: l * i
			}),
			rotor: Cr(e.mode === "manual" ? e.mixOut : e.cmd, h, e.mode, f),
			vector: this.input.vector,
			palette: this.style.palette,
			dpr: n
		});
	}
	shown(e) {
		let t = e.world, n = e.started && !e.ended ? this.clock.alpha() : 1, r = Math.max(0, e.groundStep - 1 + n), i = this.display(e, r), a = Math.max(0, Math.min(t.step, Math.round(r) - (e.mode === "autopilot" ? 0 : 10))), o = a < t.records.length ? t.records[a].faultBits : ke(t.faults, t.step), [s] = ht(t.map, t.level, i.pose.x, i.pose.y);
		return {
			displayStep: r,
			display: i,
			shownRow: a,
			shownBits: o,
			meanU: s,
			liveU: a > 0 ? e.liveWind[a - 1] : s
		};
	}
	stateOf(t, n) {
		let r = n.display.pose, i = this.featureState(t), a = t.ended ? t.world.contact : null;
		return {
			mode: t.mode,
			attract: t.attract,
			hop: t.hop,
			level: t.level,
			model: this.model,
			planner: i.planner ?? "ok",
			display: n.display.source === "fallback" ? "fallback" : "predicted",
			flight: {
				agl: Math.max(0, L(r, t.world.map)),
				vx: r.vx,
				vy: r.vy,
				tiltDeg: r.theta / e,
				energy: Math.min(1, Math.max(0, r.energyEst / w)),
				windMs: n.liveU
			},
			landing: i.landing ?? null,
			outcome: a ? a.safe ? "landed" : "crashed" : null
		};
	}
	featureState(e) {
		let t = {};
		for (let n of this.features) {
			let r = n.reportState?.(e);
			r && (t.planner === void 0 && r.planner !== void 0 && (t.planner = r.planner), t.landing === void 0 && r.landing !== void 0 && (t.landing = r.landing));
		}
		return t;
	}
	publish() {
		let e = this.current;
		!this.dead && e && this.opts.onState && this.opts.onState(this.stateOf(e, this.shown(e)));
	}
}, da = /\b(iPhone|iPad|iPod)\b/, fa = /Chrom(e|ium)\//;
function pa(e, t) {
	return da.test(e) || /Macintosh/.test(e) && t > 1 ? !0 : /AppleWebKit\//.test(e) ? !fa.test(e) : !1;
}
function ma(e = globalThis.location?.search ?? "") {
	let t = globalThis.navigator, n = null;
	try {
		let t = new URLSearchParams(e).get("backend");
		(t === "wasm" || t === "webgpu") && (n = t);
	} catch {
		n = null;
	}
	return {
		ua: t?.userAgent ?? "",
		maxTouchPoints: t?.maxTouchPoints ?? 0,
		gpu: t?.gpu ?? null,
		override: n
	};
}
async function ha(e = ma()) {
	if (pa(e.ua, e.maxTouchPoints)) return "wasm";
	if (e.override) return e.override;
	if (!e.gpu) return "wasm";
	let t;
	try {
		return await Promise.race([e.gpu.requestAdapter(), new Promise((e) => {
			t = setTimeout(() => e(null), 2e3);
		})]) ? "webgpu" : "wasm";
	} catch {
		return "wasm";
	} finally {
		t !== void 0 && clearTimeout(t);
	}
}
//#endregion
//#region src/model/meta.ts
function Z(e) {
	throw Error(`dream_meta.json: ${e}`);
}
function Q(e, t) {
	let n = e[t];
	return (typeof n != "number" || !Number.isFinite(n)) && Z(`${t} must be a finite number`), n;
}
function ga(e, t, n, r = !1) {
	(!Array.isArray(e) || e.length !== t) && Z(`${n} must have length ${t}`);
	for (let t of e) (typeof t != "number" || !Number.isFinite(t)) && Z(`${n} has a non-finite entry`), r && !(t > 0) && Z(`${n} must be > 0`);
	return e;
}
function _a(e, t, n, r, i = !1) {
	return (!Array.isArray(e) || e.length !== t) && Z(`${r} must have ${t} rows`), e.map((e, t) => ga(e, n, `${r}[${t}]`, i));
}
function va(e) {
	(typeof e != "object" || !e) && Z("windGrid missing");
	let t = e, n = {
		nx: 16,
		dx: 4,
		dz: [...de],
		scale: 4
	};
	for (let e of [
		"nx",
		"dx",
		"scale"
	]) Q(t, e) !== n[e] && Z(`windGrid.${e} is ${String(t[e])}, constants.ts says ${n[e]}`);
	let r = ga(t.dz, n.dz.length, "windGrid.dz");
	return r.some((e, t) => e !== n.dz[t]) && Z(`windGrid.dz is [${r.join(", ")}], constants.ts says [${n.dz.join(", ")}]`), n;
}
function ya(e) {
	(typeof e != "object" || !e) && Z("not an object");
	let t = e;
	t.version !== 1 && Z(`unsupported version ${String(t.version)}`);
	for (let [e, n] of [
		["hist", 10],
		["fut", 30],
		["stateDim", 10],
		["actDim", 2],
		["statDim", 135],
		["ctxDim", 193]
	]) Q(t, e) !== n && Z(`${e} is ${String(t[e])}, constants.ts says ${n}`);
	let n = va(t.windGrid);
	Q(t, "e0") !== 2e6 && Z(`e0 is ${String(t.e0)}, constants.ts says ${w} (energyEst is scaled by it)`);
	let r = t.stepsDefault;
	r || Z("stepsDefault missing");
	for (let e of [
		"ghost",
		"planner",
		"display"
	]) {
		let t = r[e];
		(!Number.isInteger(t) || t < 1) && Z(`stepsDefault.${e} must be an integer >= 1`);
	}
	let i = Q(t, "sigmaMin"), a = Q(t, "sigmaMax");
	i > 0 && a > i || Z("need 0 < sigmaMin < sigmaMax");
	let o;
	t.sigmaMinPlanner !== void 0 && (o = Q(t, "sigmaMinPlanner"), o >= i && o < a || Z("need sigmaMin <= sigmaMinPlanner < sigmaMax"));
	let s = t.skipS0 === void 0 ? void 0 : Q(t, "skipS0"), c = t.trainedOn;
	return (!c || !Array.isArray(c.rounds)) && Z("trainedOn.rounds missing"), {
		version: 1,
		hist: 10,
		fut: 30,
		stateDim: 10,
		actDim: 2,
		statDim: 135,
		ctxDim: 193,
		windGrid: n,
		e0: w,
		histMean: ga(t.histMean, 10, "histMean"),
		histStd: ga(t.histStd, 10, "histStd", !0),
		futMean: _a(t.futMean, 30, 10, "futMean"),
		futStd: _a(t.futStd, 30, 10, "futStd", !0),
		sigmaMin: i,
		sigmaMax: a,
		rho: Q(t, "rho"),
		stepsDefault: {
			ghost: r.ghost,
			planner: r.planner,
			display: r.display
		},
		params: Q(t, "params"),
		trainedOn: {
			rounds: c.rounds,
			windows: Number(c.windows ?? 0),
			gitSha: String(c.gitSha ?? "unknown")
		},
		...o === void 0 ? {} : { sigmaMinPlanner: o },
		...s === void 0 ? {} : { skipS0: s }
	};
}
function ba(e) {
	return (e.headers.get("content-type") ?? "").includes("text/html");
}
async function xa(e, t) {
	try {
		let n = await t(`${e}dream.onnx`, { method: "HEAD" });
		if (!n.ok || ba(n)) return {
			ok: !1,
			reason: "missing"
		};
		let r = await t(`${e}dream_meta.json`);
		return !r.ok || ba(r) ? {
			ok: !1,
			reason: "missing"
		} : {
			ok: !0,
			ghostSteps: ya(await r.json()).stepsDefault.ghost
		};
	} catch {
		return {
			ok: !1,
			reason: "error"
		};
	}
}
var Sa = class {
	deps;
	onGhosts = null;
	onValue = null;
	onStateChange = null;
	_state = "idle";
	_fail = null;
	_info = null;
	_requested = null;
	worker = null;
	gen = 0;
	nextId = 1;
	loading = null;
	loadWaiter = null;
	map = null;
	flightId = 0;
	inFlight = null;
	pending = null;
	planInFlight = null;
	planPending = null;
	valueInFlight = null;
	valuePending = null;
	ghostErrors = 0;
	held = !1;
	constructor(e) {
		this.deps = e;
	}
	get state() {
		return this._state;
	}
	get failReason() {
		return this._fail;
	}
	get info() {
		return this._info;
	}
	get requestedBackend() {
		return this._requested;
	}
	load(e, t, n = {}) {
		if (this._state === "loading" && this.loading) return this.loading;
		if (this._state === "ready") return Promise.resolve(this._info);
		let r = ++this.gen;
		this._fail = null, this._requested = t, this.set("loading");
		let i = {
			modelsBase: n.modelsBase ?? `${e}models/`,
			ortBundled: `${e}ort/`,
			ortBase: {
				wasm: n.ortBase?.wasm ?? `${e}ort/`,
				webgpu: n.ortBase?.webgpu ?? `${e}ort/`
			}
		};
		return this.loading = this.doLoad(r, i, t, n.wantValue ?? !1, n.planDelayMs ?? 0), this.loading;
	}
	setMap(e) {
		this.map = e, this.worker && this.postMap(this.worker, e);
	}
	setFlight(e) {
		this.flightId = e, this.pending = null, this.valuePending = null, this.dropPlans();
	}
	requestGhosts(e, t, n, r, i = 1) {
		this._state === "ready" && this.worker && e.flightId === this.flightId && (this.pending = {
			snap: e,
			n: t,
			steps: n,
			seed: r,
			k: i
		}, this.pump());
	}
	requestPlan(e, t, n, r) {
		return this._state !== "ready" || !this.worker || e.flightId !== this.flightId ? Promise.resolve(null) : new Promise((i) => {
			this.planPending?.resolve(null), this.planPending = {
				snap: e,
				warm: t,
				budget: n,
				seed: r,
				resolve: i
			}, this.pumpPlan();
		});
	}
	requestValue(e) {
		this._state === "ready" && this.worker && this._info?.hasValue && e.flightId === this.flightId && (this.valuePending = e, this.pumpValue());
	}
	dropPending() {
		this.pending = null;
	}
	holdBackground(e) {
		e !== this.held && (this.held = e, e || (this.pump(), this.pumpValue()));
	}
	get holding() {
		return this.held;
	}
	unload() {
		this.gen++;
		let e = this.detach();
		e && (e.postMessage({
			kind: "unload",
			id: this.nextId++
		}), e.terminate()), this._fail = null, this.set("unloaded");
	}
	async doLoad(e, t, n, r, i) {
		let a = await xa(t.modelsBase, this.deps.fetch);
		if (e !== this.gen) return null;
		if (!a.ok) return this.failWith(a.reason), null;
		let o;
		try {
			o = this.deps.createWorker();
		} catch {
			return this.failWith("error"), null;
		}
		this.worker = o, o.onmessage = (e) => this.onMessage(o, e.data), o.onerror = () => this.onWorkerError(o);
		let s = this.nextId++, c = new Promise((e) => {
			this.loadWaiter = {
				id: s,
				resolve: e
			};
		});
		o.postMessage({
			kind: "load",
			id: s,
			...t,
			backend: n,
			wantValue: r,
			...i > 0 ? { planDelayMs: i } : {}
		}), this.map && this.postMap(o, this.map);
		let l = await c;
		return e === this.gen ? l.kind === "loaded" ? (this._info = {
			backend: l.backend,
			hasValue: l.hasValue,
			msPerSample: l.msPerSample,
			chainK: l.chainK,
			kManual: l.kManual,
			ghostSteps: a.ghostSteps
		}, this.set("ready"), this._info) : (this.failWith("error"), null) : (o.terminate(), null);
	}
	postMap(e, t) {
		e.postMessage({
			kind: "map",
			id: this.nextId++,
			heights: t.heights,
			fSite: t.fSite,
			windDir: t.windDir
		});
	}
	onMessage(e, t) {
		if (e === this.worker) {
			if (this.loadWaiter && t.id === this.loadWaiter.id) {
				let e = this.loadWaiter;
				this.loadWaiter = null, e.resolve(t);
				return;
			}
			if (this.planInFlight && t.id === this.planInFlight.id && (t.kind === "plan" || t.kind === "error")) {
				let e = this.planInFlight;
				this.planInFlight = null, e.resolve?.(t.kind === "plan" && t.flightId === e.flightId && e.flightId === this.flightId ? t : null), this.pumpPlan();
				return;
			}
			if (this.valueInFlight && t.id === this.valueInFlight.id && (t.kind === "value" || t.kind === "error")) {
				this.onValueReply(t);
				return;
			}
			(t.kind === "ghosts" || t.kind === "error") && this.onGhostReply(t);
		}
	}
	onGhostReply(e) {
		let t = this.inFlight;
		if (t && e.id === t.id) {
			if (this.inFlight = null, e.kind === "error") {
				if (++this.ghostErrors >= 3) {
					this.failWith("error");
					return;
				}
			} else this.ghostErrors = 0, e.flightId === this.flightId && t.flightId === this.flightId && this.onGhosts?.({
				flightId: e.flightId,
				anchorStep: t.step,
				poses: e.poses,
				n: e.n,
				contacts: e.contacts,
				k: e.k,
				ms: e.ms,
				mean: e.mean
			});
			this.pump();
		}
	}
	pump() {
		if (this.held || this.inFlight || !this.pending || !this.worker) return;
		let e = this.pending;
		if (this.pending = null, e.snap.flightId !== this.flightId) return;
		let t = this.nextId++;
		this.inFlight = {
			id: t,
			flightId: e.snap.flightId,
			step: e.snap.step
		}, this.worker.postMessage({
			kind: "ghosts",
			id: t,
			snap: e.snap,
			n: e.n,
			steps: e.steps,
			seed: e.seed,
			k: e.k
		});
	}
	onValueReply(e) {
		let t = this.valueInFlight;
		t && e.id === t.id && (this.valueInFlight = null, e.kind === "value" && e.flightId === this.flightId && t.flightId === this.flightId && Number.isFinite(e.pSafe) && Number.isFinite(e.tGo) && this.onValue?.({
			flightId: e.flightId,
			anchorStep: t.step,
			pSafe: e.pSafe,
			tGo: e.tGo
		}), this.pumpValue());
	}
	pumpValue() {
		if (this.held || this.valueInFlight || !this.valuePending || !this.worker) return;
		let e = this.valuePending;
		if (this.valuePending = null, e.flightId !== this.flightId) return;
		let t = this.nextId++;
		this.valueInFlight = {
			id: t,
			flightId: e.flightId,
			step: e.step
		}, this.worker.postMessage({
			kind: "value",
			id: t,
			snap: e
		});
	}
	pumpPlan() {
		if (this.planInFlight || !this.planPending || !this.worker) return;
		let e = this.planPending;
		if (this.planPending = null, e.snap.flightId !== this.flightId) {
			e.resolve(null);
			return;
		}
		let t = this.nextId++;
		this.planInFlight = {
			id: t,
			flightId: e.snap.flightId,
			resolve: e.resolve
		}, this.worker.postMessage({
			kind: "plan",
			id: t,
			snap: e.snap,
			warm: e.warm,
			budget: e.budget,
			seed: e.seed
		});
	}
	dropPlans() {
		this.planPending?.resolve(null), this.planPending = null, this.planInFlight && (this.planInFlight.resolve?.(null), this.planInFlight.resolve = null);
	}
	onWorkerError(e) {
		e === this.worker && this.failWith("error");
	}
	failWith(e) {
		this.detach()?.terminate(), this._fail = e, this.set("failed");
	}
	detach() {
		let e = this.worker;
		this.worker = null, e && (e.onmessage = null, e.onerror = null);
		let t = this.loadWaiter;
		return this.loadWaiter = null, t?.resolve({
			kind: "error",
			id: t.id,
			message: "worker detached"
		}), this.inFlight = null, this.pending = null, this.dropPlans(), this.planInFlight = null, this.valueInFlight = null, this.valuePending = null, this._info = null, this.ghostErrors = 0, e;
	}
	set(e) {
		this._state !== e && (this._state = e, this.onStateChange?.(e));
	}
};
//#endregion
//#region src/runtime/session.ts
function Ca() {
	return {
		fetch: (e, t) => fetch(e, t),
		selectBackend: () => ha()
	};
}
function wa(e) {
	return e === "ready" ? "ready" : e === "failed" || e === "unloaded" ? "absent" : "loading";
}
function Ta(e, t = Ca()) {
	let n = /* @__PURE__ */ new Set(), r = new Sa({
		createWorker: () => {
			if (!e) throw Error("dream session: no worker factory (AppOptions.createWorker)");
			return e();
		},
		fetch: t.fetch
	});
	r.onStateChange = (e) => {
		for (let t of [...n]) t(e);
	};
	let i = 0, a = null;
	return {
		client: r,
		state: () => r.state,
		info: () => {
			let e = r.info;
			return e ? {
				backend: e.backend,
				chainK: e.chainK,
				kManual: e.kManual,
				msPerSample: e.msPerSample,
				hasValue: e.hasValue
			} : null;
		},
		ensureLoaded(e, n = {}) {
			if (r.state === "ready") return Promise.resolve(!0);
			if (a) return a;
			let o = i, s = (async () => {
				let a = await t.selectBackend();
				return o === i && await r.load(e, a, {
					...n,
					wantValue: n.wantValue ?? !1
				}) !== null;
			})();
			a = s;
			let c = () => {
				a === s && (a = null);
			};
			return s.then(c, c), s;
		},
		onState(e) {
			return n.add(e), () => {
				n.delete(e);
			};
		},
		async unload() {
			i++, a = null, r.state !== "unloaded" && r.unload();
		}
	};
}
var Ea = class {
	host;
	opts;
	phase = "idle";
	seed;
	endedAt = 0;
	visitorFlights = 0;
	constructor(e, t) {
		this.host = e, this.opts = t, this.seed = t.firstSeed;
	}
	get inAttract() {
		return this.phase === "attract" || this.phase === "attract-ended";
	}
	maybeStart(e, t) {
		this.phase === "idle" && !this.opts.reducedMotion && e && t && (this.phase = "attract", this.host.startAttract(this.seed));
	}
	onFlightEnded(e) {
		this.phase === "attract" && (this.phase = "attract-ended", this.endedAt = e);
	}
	postpone(e) {
		this.phase === "attract-ended" && (this.endedAt += e);
	}
	tick(e, t = !0) {
		this.phase === "attract-ended" && t && e - this.endedAt >= 2.5 && (this.seed += 1, this.phase = "attract", this.host.startAttract(this.seed));
	}
	takeControls() {
		if (this.phase === "attract" || this.phase === "visitor") {
			this.phase = "visitor", this.host.takeOver();
			return;
		}
		this.phase = "visitor", this.host.startVisitor();
	}
	onVisitorFlight() {
		this.visitorFlights += 1, (this.inAttract || this.visitorFlights > 1) && (this.phase = "visitor");
	}
	onVisitorInput() {
		this.phase === "idle" && (this.phase = "visitor");
	}
};
//#endregion
//#region src/ui/attractFeature.ts
function Da() {
	let e = globalThis.matchMedia;
	return e ? e("(prefers-reduced-motion: reduce)").matches : !1;
}
function Oa(e = {}) {
	let t = e.now ?? (() => performance.now() / 1e3), n = null, r = null, i = null, a = null, o = !1, s = null, c = !1, l = null, u = () => {
		let e = l?.flight();
		n?.phase === "attract" && e && !e.attract && !e.ended && n.takeControls();
	}, d = () => {
		n && (n.inAttract ? n.takeControls() : n.onVisitorInput());
	}, f = (e) => {
		Hn(e.key) && d();
	};
	return {
		mount(t, s) {
			l = s, c = s.opts.reducedMotion ?? Da(), n = new Ea({
				startAttract: (e) => {
					s.startFlight({
						hop: 1,
						level: 1,
						seed: e,
						start: "pad",
						mode: "autopilot",
						attract: !0
					});
				},
				startVisitor: () => {
					s.startFlight({
						hop: 1,
						start: "pad",
						mode: "manual",
						attract: !1
					});
				},
				takeOver: () => {
					s.flight()?.mode === "autopilot" && s.setMode("manual");
				}
			}, {
				reducedMotion: c,
				firstSeed: e.firstSeed ?? 1
			}), t && (r = Wn(t.root.ownerDocument, () => n?.takeControls()), t.stage.append(r.el)), i = t?.canvas ?? s.canvas ?? null, i?.addEventListener("keydown", f);
			let u = t?.root ?? i;
			typeof IntersectionObserver > "u" || !u ? o = !0 : (a = new IntersectionObserver((e) => {
				o = e.some((e) => e.isIntersecting);
			}, { threshold: .3 }), a.observe(u));
		},
		onFlightStart(e) {
			e.attract || n?.onVisitorFlight();
		},
		onControlInput() {
			d();
		},
		afterStep(e) {
			e.attract || n?.onVisitorInput(), u();
		},
		onTouchdown(e) {
			e.attract && n?.onFlightEnded(t());
		},
		onPause() {
			s = t();
		},
		onResume() {
			s !== null && n?.postpone(t() - s), s = null;
		},
		draw() {
			if (!n || s !== null) return;
			let i = e.session?.state() === "ready";
			u(), n.maybeStart(o, i), n.tick(t(), i), r?.show(n.inAttract || n.phase === "idle" && c);
		},
		destroy() {
			a?.disconnect(), i?.removeEventListener("keydown", f), r?.el.remove();
		}
	};
}
//#endregion
//#region src/ghosts/ghosts.ts
function ka(e) {
	return {
		x: e.x,
		y: e.y,
		vx: e.vx,
		vy: e.vy,
		theta: e.theta,
		omega: e.omega,
		sF: e.sF,
		sR: e.sR,
		energyEst: e.energyEst
	};
}
function Aa(e, t) {
	return t >= e.step ? e.state : e.records[t].state;
}
function ja(e, t) {
	return Ot(e.revealedAt, e.hazardFrom, t);
}
function Ma(e, t) {
	return t < e.step ? e.records[t].faultBits : ke(e.faults, e.step);
}
function Na(e, t) {
	if (!e.armed) return !1;
	let n = Math.min(t, e.step);
	for (let t = 0; t <= n; t++) if (L(Aa(e, t), e.map) >= 1) return !0;
	return n >= e.step;
}
function Pa(e, t, n, r) {
	if (t < 9 || t > e.step || t < 10 && !e.records[0]?.onGround) return null;
	let i = [];
	for (let n = t - 10 + 1; n <= t; n++) {
		let t = n === 0 ? null : e.records[n - 1].cmd;
		i.push({
			row: ka(Aa(e, n)),
			cmd: t ? {
				front: t.front,
				rear: t.rear
			} : null
		});
	}
	return {
		step: t,
		hist: i,
		faultBits: Ma(e, t),
		level: e.level,
		targetX: e.targetX,
		knowledge: ja(e, t),
		armed: Na(e, t),
		given: n.map((e) => ({
			front: e.front,
			rear: e.rear
		})),
		heldCmd: {
			front: r.front,
			rear: r.rear
		}
	};
}
function Fa(e, t) {
	return Pa(e, e.step, [], t);
}
function Ia(e, t) {
	let n = e.step, r = t.downlinkStep(n);
	if (r !== n - 10) return null;
	let i = Cn(e, t, n);
	return Pa(e, r, i, i[i.length - 1]);
}
function La(e, t) {
	return (Math.imul(e ^ 2654435769, 2246822507) ^ Math.imul(t + 1, 3266489909)) >>> 0;
}
var Ra = class {
	req;
	cfg = null;
	paused = !1;
	flightId = 0;
	seedBase = 0;
	lastStep = -Infinity;
	latest = null;
	constructor(e) {
		this.req = e;
	}
	configure(e) {
		this.cfg = e ? {
			n: e.n,
			steps: e.steps,
			k: e.k ?? 1
		} : null, e || (this.latest = null);
	}
	setPaused(e) {
		this.paused = e;
	}
	startFlight(e, t) {
		this.flightId = e, this.seedBase = t >>> 0, this.lastStep = -Infinity, this.latest = null;
	}
	restart() {
		this.lastStep = -Infinity, this.latest = null;
	}
	onStep(e, t, n) {
		if (e.contact !== null || !this.cfg || this.paused || n !== "manual" || e.step - this.lastStep < 5) return !1;
		let r = Ia(e, t);
		if (!r) return !1;
		this.lastStep = e.step;
		let i = {
			...r,
			flightId: this.flightId
		};
		return this.req.requestGhosts(i, this.cfg.n, this.cfg.steps, La(this.seedBase, e.step), this.cfg.k), !0;
	}
	accept(e) {
		return e.flightId !== this.flightId || this.latest && e.anchorStep < this.latest.anchorStep ? !1 : (this.latest = e, !0);
	}
	get current() {
		return this.latest;
	}
}, za = 31;
//#endregion
//#region src/planner/plan.ts
function Ba(e, t, n) {
	return K(e, t, n, za);
}
function Va(e) {
	let t = M(e);
	return {
		mean: [[
			,
			,
			,
			,
			,
			,
		].fill(t.front), [
			,
			,
			,
			,
			,
			,
		].fill(t.rear)],
		std: [[
			,
			,
			,
			,
			,
			,
		].fill(_e), [
			,
			,
			,
			,
			,
			,
		].fill(_e)]
	};
}
function Ha(e) {
	return {
		mean: [e.mean[0].slice(), e.mean[1].slice()],
		std: [e.std[0].slice(), e.std[1].slice()]
	};
}
function Ua(e, t) {
	let n = Math.floor(t / 5);
	if (n >= 5) return e[5];
	if (n < 0) return e[0];
	let r = (t - n * 5) / 5;
	return e[n] + (e[n + 1] - e[n]) * r;
}
function Wa(e, t) {
	let n = Math.max(0, Math.round(t)), r = (t) => {
		let r = [], i = [];
		for (let a = 0; a < 6; a++) {
			let o = a * 5 + n;
			r.push(Ua(e.mean[t], o)), i.push(o > 25 ? _e : Math.max(Ua(e.std[t], o), ve));
		}
		return {
			mean: r,
			std: i
		};
	}, i = r(0), a = r(1);
	return {
		mean: [i.mean, a.mean],
		std: [i.std, a.std]
	};
}
var Ga = [
	{
		pop: 32,
		iters: 3,
		ghosts: 16
	},
	{
		pop: 16,
		iters: 2,
		ghosts: 8
	},
	{
		pop: 8,
		iters: 2,
		ghosts: 8
	},
	{
		pop: 8,
		iters: 1,
		ghosts: 4
	}
];
function Ka(e) {
	return e === "webgpu" ? 0 : 1;
}
function qa(e, t, n) {
	return Ga.slice(Ka(e)).map((r, i) => ({
		pop: r.pop,
		iters: r.iters,
		elite: 4,
		samplesPerCandidate: 1,
		steps: n,
		ghosts: r.ghosts,
		chainK: e === "webgpu" && i === 0 ? Math.max(1, t) : 1
	}));
}
function Ja(e) {
	let n = 875 * t / (N(e, 0) + N(e, 1)), r = Math.floor(n / _ + 1e-9) * _;
	return M({
		front: r,
		rear: r
	});
}
//#endregion
//#region src/planner/executor.ts
var Ya = class {
	ladder;
	plan = null;
	heldDist = null;
	pending = null;
	nextToken = 1;
	nextRequestStep = 0;
	streak = 0;
	onTime = 0;
	expired = 0;
	rungIx = 0;
	rng;
	constructor(e, t) {
		if (this.ladder = e, e.length === 0) throw Error("PlanExecutor: the budget ladder is empty");
		this.rng = j(t);
	}
	get active() {
		return this.plan !== null;
	}
	get current() {
		return this.plan;
	}
	get display() {
		return this.plan?.result ?? null;
	}
	get lateStreak() {
		return this.streak;
	}
	get onTimeStreak() {
		return this.onTime;
	}
	get expiredStreak() {
		return this.expired;
	}
	get rung() {
		return this.rungIx;
	}
	get atBottom() {
		return this.rungIx === this.ladder.length - 1;
	}
	get downgraded() {
		return this.rungIx > 0;
	}
	get activeBudget() {
		return this.ladder[this.rungIx];
	}
	get waiting() {
		return this.pending !== null;
	}
	newFlight(e = !1) {
		this.stop(), this.rungIx = e ? this.ladder.length - 1 : 0, this.streak = 0, this.onTime = 0, this.expired = 0;
	}
	toBottom() {
		this.rungIx = this.ladder.length - 1;
	}
	start(e, t) {
		let n = M(t);
		this.plan = {
			base: e,
			actions: Array.from({ length: 30 }, () => ({ ...n })),
			result: null
		}, this.heldDist = Va(n), this.pending = null, this.nextRequestStep = e, this.streak = 0, this.expired = 0;
	}
	stop() {
		this.plan = null, this.pending = null;
	}
	replanSoon(e) {
		this.nextRequestStep = Math.min(this.nextRequestStep, e);
	}
	command(e) {
		if (!this.plan) throw Error("PlanExecutor.command called while not engaged");
		let t = this.pending;
		t && !t.late && e >= t.step + 5 && (t.late = !0, this.streak += 1, this.onTime = 0, this.streak % 2 == 0 && !this.atBottom && (this.rungIx += 1));
		let n = e - this.plan.base;
		return n >= 0 && n < 30 ? { ...this.plan.actions[n] } : { ...this.plan.actions[29] };
	}
	due(e, t) {
		return this.plan !== null && this.pending === null && t && e >= this.nextRequestStep;
	}
	begin(e) {
		if (!this.plan) throw Error("PlanExecutor.begin called while not engaged");
		let t = this.nextToken++;
		return this.pending = {
			token: t,
			step: e,
			late: !1,
			bottom: this.atBottom
		}, this.nextRequestStep = e + 5, {
			token: t,
			step: e,
			warm: this.plan.result ? Wa(this.plan.result.dist, e - this.plan.base) : Ha(this.heldDist),
			budget: this.activeBudget,
			seed: this.rng.int(2147483647)
		};
	}
	resolve(e, t, n) {
		let r = this.pending;
		return !r || r.token !== e ? "stale" : (this.pending = null, t ? (r.late || (this.streak = 0), n - r.step > 25 ? (this.onTime = 0, this.expired = r.bottom ? this.expired + 1 : 0, "expired") : (this.expired = 0, r.late ? this.onTime = 0 : ++this.onTime >= 8 && this.rungIx > 0 && (--this.rungIx, this.onTime = 0), this.plan = {
			base: r.step,
			actions: t.actions,
			result: {
				...t,
				late: r.late
			}
		}, "adopted")) : (this.onTime = 0, this.expired = 0, "failed"));
	}
};
//#endregion
//#region src/pilots/observe.ts
function Xa(e, t = e.knowledge()) {
	let n = e.state;
	return {
		pose: {
			x: n.x,
			y: n.y,
			vx: n.vx,
			vy: n.vy,
			theta: n.theta,
			omega: n.omega
		},
		sF: n.sF,
		sR: n.sR,
		energyEst: n.energyEst,
		faultBits: ke(e.faults, e.step),
		level: e.level,
		map: e.map,
		targetX: e.targetX,
		knowledge: t,
		step: e.step,
		agl: ze(e.map, n),
		onGround: e.onGround,
		meanWindAt: (t, n) => ht(e.map, e.level, t, n),
		records: e.records
	};
}
var Za = .12, Qa = 30 * e, $a = 3 * e, eo = (e, t, n) => Math.min(n, Math.max(t, e));
function to(e, n = {}) {
	let r = n.vxCruise ?? 5, i = n.clearance ?? 20, a = e.pose, o = L(a, e.map), s = e.targetX - a.x, c = s >= 0 ? 1 : -1, l = un(e.map, a.x - c * 30, a.x + c * Math.min(200, Math.abs(s) + 30)), u = Math.abs(s) < 8 && Math.abs(a.vx) < .6, d = !u && o < .6 * i && Math.abs(s) > 30, f = u ? "descend" : d ? "climb" : "cruise", p = d ? 0 : c * Math.min(r, Math.sqrt(.3 * Math.abs(s)), .15 * Math.abs(s)), m = u ? -Math.min(4, .8 + Za * Math.max(0, o)) : eo(.25 * (l + i - a.y), -4, 4), h = eo(.5 * (p - a.vx), -.5, .5), g = t + eo(.8 * (m - a.vy), -.6, .8), [_, v] = e.meanWindAt(a.x, a.y), y = a.vx - _, b = a.vy - v, x = h - 2 * Ye(875 * t / 2, y) / 875 + Ke * Math.abs(y) * y / 875, S = g + qe * Math.abs(b) * b / 875, C = o < 3 ? $a : Qa, w = eo(Math.atan2(-x, S), -C, C);
	return {
		phase: f,
		vxDes: p,
		vyDes: m,
		thetaDes: w,
		force: 875 * Math.max(.1, S) / Math.cos(w),
		torque: Te() * (1.5 * (w - a.theta) - 2.2 * a.omega) + Ee() * a.omega,
		clearance: o
	};
}
function no(e, t, n) {
	let r = (t - Ge * e) / (We - Ge), i = e - r;
	return {
		front: r / N(n, 0),
		rear: i / N(n, 1)
	};
}
function ro(e, t = {}) {
	let n = to(e, t);
	return no(n.force, n.torque, Ae(e.faultBits, e.step));
}
var io = class {
	noise;
	id = 0;
	rng = j(0);
	constructor(e = .02) {
		this.noise = e;
	}
	reset(e) {
		this.rng = j(e).fork(157);
	}
	act(e) {
		let t = ro(e);
		return M({
			front: t.front + this.noise * this.rng.normal(),
			rear: t.rear + this.noise * this.rng.normal()
		});
	}
}, ao = class {
	opts;
	exec;
	world = null;
	flightId = -1;
	last = {
		front: 0,
		rear: 0
	};
	flying = !1;
	target = NaN;
	paused = !1;
	rtts = [];
	lates = 0;
	holding = !1;
	simple = !1;
	switched = !1;
	bottomNext = !1;
	engagedAt = -1;
	pilot = new io();
	now;
	redesignation = null;
	constructor(e) {
		this.opts = e, this.exec = new Ya(qa(e.backend, e.chainK, 0), e.seed), this.now = e.now ?? (() => performance.now());
	}
	get engaged() {
		return this.exec.active;
	}
	get lastCommand() {
		return { ...this.last };
	}
	get display() {
		return this.exec.active ? this.exec.display : null;
	}
	get budget() {
		return this.exec.activeBudget;
	}
	get degraded() {
		return this.exec.downgraded;
	}
	get rung() {
		return this.exec.rung;
	}
	get holdingBackground() {
		return this.holding;
	}
	command(e, t) {
		if (!this.track(e)) return null;
		let n = e.world;
		if (this.switched && !this.simple && (this.simple = !0), this.simple) return this.flySimple(n);
		if (!this.exec.active) {
			let e = n.onGround ? Ja(n.faults) : n.step === 0 ? He(n.faults) : n.records[n.step - 1].cmd;
			this.exec.start(n.step, e), this.engagedAt = n.step, this.last = M(e);
		}
		this.steer(n);
		let r = this.exec.command(n.step);
		return this.tooSlow(n) ? (this.goSimple(n), this.flySimple(n)) : (this.setHold(this.exec.lateStreak > 0), !this.paused && this.exec.due(n.step, n.step >= 9) && this.dispatch(e, n), this.last = M(r), this.flying = !0, r);
	}
	get simplePilot() {
		return this.simple;
	}
	tracks(e) {
		return e.world === this.world && e.flightId === this.flightId;
	}
	tooSlow(e) {
		return this.exec.atBottom && this.exec.expiredStreak >= 2 ? !0 : this.exec.display === null && e.step - this.engagedAt >= 50;
	}
	goSimple(e) {
		this.simple = !0, this.bottomNext = !0, this.exec.toBottom(), this.exec.stop(), this.setHold(!1), this.pilot.reset(e.seed);
	}
	flySimple(e) {
		let t = bn(e.map, e.knowledge(), e.targetX, _n(e.map, e.state, e.state.energyEst, e.onGround));
		t !== e.targetX && (this.redesignation = {
			step: e.step,
			from: e.targetX,
			to: t
		}, e.setTarget(t));
		let n = this.pilot.act(Xa(e));
		return this.last = M(n), this.flying = !0, n;
	}
	afterStep(e) {
		this.track(e);
	}
	end() {
		this.flying = !1, this.exec.stop(), this.setHold(!1);
	}
	setHold(e) {
		e !== this.holding && (this.holding = e, this.opts.requester.hold?.(e));
	}
	setPaused(e) {
		this.paused = e;
	}
	planStats() {
		let e = [...this.rtts].sort((e, t) => e - t), t = (t) => e.length ? e[Math.min(e.length - 1, Math.floor(t * e.length))] : 0;
		return {
			n: e.length,
			medianMs: t(.5),
			p95Ms: t(.95),
			late: this.lates,
			downgraded: this.exec.downgraded
		};
	}
	steer(e) {
		let t = bn(e.map, e.knowledge(), e.targetX, _n(e.map, e.state, e.state.energyEst, e.onGround));
		t !== e.targetX && (this.redesignation = {
			step: e.step,
			from: e.targetX,
			to: t
		}, e.setTarget(t)), e.targetX !== this.target && (this.exec.replanSoon(e.step), this.target = e.targetX);
	}
	track(e) {
		return (e.world !== this.world || e.flightId !== this.flightId) && (this.exec.newFlight(this.bottomNext), this.bottomNext = !1, this.simple = !1, this.switched = !1, this.world = e.world, this.flightId = e.flightId, this.flying = !1, this.target = e.world.targetX, this.redesignation = null), e.mode !== "autopilot" || e.ended || e.world.contact !== null ? (this.flying && e.mode === "manual" && !e.ended && e.world.contact === null && e.link.reset(this.last, e.world.step), this.flying = !1, this.simple &&= (this.switched = !0, !1), this.exec.stop(), this.setHold(!1), !1) : !0;
	}
	dispatch(e, t) {
		let n = Fa(t, this.last);
		if (!n) return;
		let r = {
			...n,
			flightId: this.flightId
		}, i = this.exec.begin(t.step), a = this.flightId, o = this.now(), s = () => this.world === t && this.flightId === a && e.world === t && e.flightId === a && e.mode === "autopilot" && !e.ended;
		this.opts.requester.request(r, i.warm, i.budget, i.seed).then((e) => {
			if (!s()) {
				this.world === t && this.flightId === a && this.exec.resolve(i.token, null, t.step);
				return;
			}
			let n = e && e.flightId === a ? e.result : null;
			if (this.exec.resolve(i.token, n, t.step) !== "adopted") return;
			this.rtts.push(this.now() - o);
			let r = this.exec.display;
			r?.late && (this.lates += 1), r && this.opts.onAdopt?.(r);
		}, () => {
			this.world === t && this.flightId === a && this.exec.resolve(i.token, null, t.step);
		});
	}
}, oo = {
	rejected: .08,
	elite: .3,
	chosen: .85
}, so = Array.from({ length: Math.floor(30 * i / 1) }, (e, t) => Math.round((t + 1) / i)).filter((e) => e < 30), co = {
	rejected: 0,
	elite: 1,
	chosen: 2
};
function lo(e) {
	let t = (t) => t === e.chosen ? "chosen" : e.elite[t] ? "elite" : "rejected";
	return Array.from({ length: e.n }, (e, n) => ({
		index: n,
		tier: t(n),
		alpha: oo[t(n)]
	})).sort((e, t) => co[e.tier] - co[t.tier] || e.index - t.index);
}
function uo(e) {
	let t = Math.cos(e.theta), n = Math.sin(e.theta);
	return [
		[-1, -1],
		[1, -1],
		[1, 1],
		[-1, 1]
	].map(([r, i]) => {
		let a = r * s / 2 - d, o = i * 1 / 2 - f;
		return [e.x + a * t - o * n, e.y + a * n + o * t];
	});
}
var fo = (e) => Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.theta);
function po(e, t) {
	for (let n of lo(e)) {
		let r = e.touchIndex[n.index] >= 0 ? e.touchIndex[n.index] : 30, i = new Float32Array((r + 1) * 2), a = !0;
		for (let t = 0; t <= r; t++) {
			let r = Ba(e.poses, n.index, t);
			if (!fo(r)) {
				a = !1;
				break;
			}
			i[2 * t] = r.x, i[2 * t + 1] = r.y;
		}
		if (!a) continue;
		t.path(i, n.alpha, n.tier);
		for (let i of so) i < r && t.outline(uo(Ba(e.poses, n.index, i)), n.alpha, n.tier);
		let o = e.contacts[n.index];
		t.outline(uo(o ? o.pose : Ba(e.poses, n.index, r)), n.alpha, n.tier);
	}
}
//#endregion
//#region src/ui/autopilotFeature.ts
var mo = "Dream model not loaded", ho = {
	takeoff: "Autopilot: taking off",
	transit: "Autopilot: transit at a safe height",
	scout: "Autopilot: scouting the landing site",
	approach: "Autopilot: approach",
	final: "Autopilot: final descent at 1 m/s"
};
function go(e) {
	if (e.advisoryS !== null) {
		let t = `${Math.ceil(e.advisoryS)} s`;
		if (e.mode === "autopilot" && e.redesignation) {
			let n = e.redesignation.to - e.redesignation.from;
			return `Hazard on the landing site. Autopilot redesignated ${Math.abs(n).toFixed(0)} m ${n < 0 ? "back" : "ahead"} (${t}).`;
		}
		return `Hazard detected on the landing site: pick another site (${t}).`;
	}
	return e.mode === "autopilot" && e.simple ? e.simple : e.mode === "autopilot" && e.phase ? ho[e.phase] : "";
}
function _o(e, t) {
	let n = t.style.palette, r = {
		rejected: n.planRejected,
		elite: n.planElite,
		chosen: n.planChosen
	}, i = (e, n) => t.camera.toScreen(e, n, t.w, t.h), a = (t, n, a, o, s) => {
		e.save(), e.strokeStyle = H(r[a], n), e.lineWidth = o, e.beginPath(), t.forEach(([t, n], r) => {
			let [a, o] = i(t, n);
			r === 0 ? e.moveTo(a, o) : e.lineTo(a, o);
		}), s && e.closePath(), e.stroke(), e.restore();
	};
	return {
		path(e, t, n) {
			if (e.length < 4) return;
			let r = [];
			for (let t = 0; t < e.length; t += 2) r.push([e[t], e[t + 1]]);
			a(r, t, n, n === "chosen" ? 1.5 : 1, !1);
		},
		outline(e, t, n) {
			a(e, t, n, 1, !0);
		}
	};
}
function vo(e) {
	globalThis.__landerPlan = { planStats: () => e.planStats() };
}
function yo(e) {
	let t = null, n = null, r = null, i = null, a = null, o = !1;
	function s() {
		let n = e.session.state() === "ready" ? e.session.info() : null;
		if (!n) return t &&= (t.end(), null), r?.setAutopilotAvailable(!1, mo), null;
		if (!t) {
			let r = e.session.client;
			t = new ao({
				requester: {
					request: (e, t, n, i) => r.requestPlan(e, t, n, i),
					hold: (e) => r.holdBackground?.(e)
				},
				backend: n.backend,
				chainK: n.chainK,
				seed: e.seed ?? (Date.now() >>> 0 || 1),
				onAdopt: e.onAdopt
			}), t.setPaused(o);
		}
		return r?.setAutopilotAvailable(!0, ""), t;
	}
	let c = () => {
		n?.flight()?.mode === "autopilot" && n.setMode("manual");
	}, l = (e) => {
		Hn(e.key) && c();
	}, u = {
		get ready() {
			return s() !== null;
		},
		session: () => t,
		planStats: () => t?.planStats() ?? null,
		counted(e) {
			return e.mode === "autopilot" ? t?.display?.pLand ?? null : null;
		},
		reportState(e) {
			return e.mode !== "autopilot" || !t || !t.tracks(e) ? { planner: "ok" } : { planner: t.simplePilot ? "simple-pilot" : t.degraded ? "degraded" : "ok" };
		},
		badges(e, n) {
			return e.mode === "autopilot" && t?.simplePilot && t.tracks(e) ? [n.simplePilot] : [];
		},
		mount(t, o) {
			n = o, t && (r = t.controlToggle, a = t.root.ownerDocument.createElement("div"), a.className = "autopilot-status", a.setAttribute("aria-live", "polite"), t.stage.append(a)), i = t?.canvas ?? o.canvas ?? null, i?.addEventListener("keydown", l), s(), e.debugHook && vo(u);
		},
		onFlightStart(e) {
			r?.set(e.mode);
		},
		onControlInput() {
			c();
		},
		command(e, t) {
			return s()?.command(e, t) ?? null;
		},
		afterStep(e) {
			t?.afterStep(e);
		},
		onTouchdown() {
			t?.end();
		},
		onPause() {
			o = !0, t?.setPaused(!0);
		},
		onResume() {
			o = !1, t?.setPaused(!1);
		},
		draw(t, i) {
			let o = s(), c = i.flight;
			!o && c.mode === "autopilot" && !c.ended && n?.setMode("manual"), r?.set(c.mode);
			let l = c.mode === "autopilot" ? o?.display ?? null : null;
			if (l && (e.ghostsOn?.() ?? !0) && po(l, _o(t, i)), a) {
				let e = c.ended ? null : xn(c.world.eventLog, c.world.step), t = c.mode === "autopilot" && o?.simplePilot && o.tracks(c) ? (i.style.text ?? V).simplePilot : null;
				a.textContent = go({
					mode: c.mode,
					phase: l?.phase ?? null,
					advisoryS: e ? e.remainingS : null,
					redesignation: o?.redesignation ?? null,
					simple: t
				});
			}
		},
		destroy() {
			delete globalThis.__landerPlan, t?.end(), t = null, i?.removeEventListener("keydown", l), r?.setAutopilotAvailable(!1, mo), a?.remove();
		}
	};
	return u;
}
//#endregion
//#region src/ui/chainFeature.ts
function bo(e, t) {
	return e.results.map((n, r) => {
		let i = r + 1, a = tn(e.seed, e.baseLevel, i), o = t[r] ?? null;
		if (!n) return {
			hop: i,
			conditions: an(a.level),
			map: rn[a.tier],
			outcome: "not flown",
			energy: "",
			gap: ""
		};
		let s = o && o.attempts > 1 ? ` (${o.attempts} tries)` : "";
		return {
			hop: i,
			conditions: an(a.level),
			map: rn[a.tier],
			outcome: `${n.safe ? "landed" : "crashed"}${o ? `, ${o.mode}` : ""}${s}`,
			energy: `${Math.round(100 * n.energyUsed / w)}%`,
			gap: o?.gapM == null ? "" : `${o.gapM.toFixed(1)} m`
		};
	});
}
function xo(e = {}) {
	let t = e.randomSeed ?? (() => Math.random() * 2 ** 32 >>> 0), n = null, r = null, i = null, a = null, o = [
		,
		,
		,
		,
		,
	].fill(null), s = null, c = () => {
		i?.remove(), i = null;
	}, l = (e, t, n) => {
		let r = e.createElement("button");
		return r.type = "button", r.textContent = t, r.addEventListener("click", n), r;
	};
	function u(e, t) {
		if (s !== e.seed) {
			s = e.seed;
			try {
				r?.opts.onFlight?.({
					type: "chain",
					flightId: t.flightId,
					landed: ln(e)
				});
			} catch (e) {
				console.error("lander: onFlight handler threw", e);
			}
		}
	}
	function d(e, n, i) {
		let a = e.createElement("div");
		a.className = "chain-summary";
		let s = e.createElement("h3");
		s.textContent = `Chain: ${ln(n)} of 5 hops landed`;
		let c = e.createElement("table");
		for (let t of bo(n, o)) {
			let n = e.createElement("tr");
			for (let r of [
				`Hop ${t.hop}`,
				t.conditions,
				t.map,
				t.outcome,
				t.energy,
				t.gap
			]) {
				let t = e.createElement("td");
				t.textContent = r, n.append(t);
			}
			c.append(n);
		}
		return a.append(s, c, l(e, "New chain", () => {
			r && r.startFlight({
				hop: 1,
				seed: t(),
				level: n.baseLevel,
				start: "pad",
				mode: "manual",
				attract: !1
			});
		})), u(n, i), a;
	}
	function f(e, t) {
		if (!n || !r) return;
		let a = r.chain(), o = n.endcard.ownerDocument;
		c();
		let s = o.createElement("div");
		if (s.className = "chain-card", t && e.hop >= 5) s.append(d(o, a, e));
		else if (!t) s.append(l(o, "End chain", () => s.replaceChildren(d(o, r.chain(), e))));
		else return;
		n.endcard.append(s), i = s;
	}
	return {
		mount(e, t) {
			n = e, r = t;
		},
		onFlightStart(e) {
			if (c(), e.attract || !r) return;
			let t = r.chain();
			t.seed !== a && (a = t.seed, o = [
				,
				,
				,
				,
				,
			].fill(null));
			let n = o[e.hop - 1];
			o[e.hop - 1] = {
				mode: e.mode,
				gapM: null,
				attempts: (n?.attempts ?? 0) + 1
			};
		},
		onTouchdown(t) {
			let n = t.world.contact;
			if (t.attract || !n) return;
			let i = o[t.hop - 1];
			i && (o[t.hop - 1] = {
				...i,
				mode: t.mode,
				gapM: e.gap?.()?.metres ?? null
			}), queueMicrotask(() => {
				n.safe && t.hop >= 5 && r && u(r.chain(), t), f(t, n.safe);
			});
		},
		destroy() {
			c();
		}
	};
}
function So(e) {
	let t = e.touchdown ? Math.min(30, Math.max(1, Math.ceil(e.touchdown.at))) : 30, n = new Float32Array((t + 1) * 2);
	for (let r = 0; r <= t; r++) {
		let t = K(e.mean, 0, r, 31);
		n[2 * r] = t.x, n[2 * r + 1] = t.y;
	}
	return {
		xy: n,
		last: t
	};
}
var Co = class {
	preds = [];
	lastBase = -Infinity;
	get predictions() {
		return this.preds;
	}
	reset() {
		this.preds = [], this.lastBase = -Infinity;
	}
	record(e) {
		let t = e.touchIndex[e.chosen] >= 0 ? e.touchIndex[e.chosen] : 30, n = new Float32Array((t + 1) * 2);
		for (let r = 0; r <= t; r++) {
			let t = Ba(e.poses, e.chosen, r);
			n[2 * r] = t.x, n[2 * r + 1] = t.y;
		}
		this.recordPath(e.step, n, t);
	}
	recordPath(e, t, n) {
		e < this.lastBase + 10 || (this.preds.push({
			base: e,
			xy: t,
			last: n
		}), this.lastBase = e);
	}
};
function wo(e) {
	let t = e.records.map((e) => ({
		x: e.state.x,
		y: e.state.y
	}));
	return t.push({
		x: e.state.x,
		y: e.state.y
	}), t;
}
function To(e, t) {
	let n = null;
	for (let r of e) for (let e = 1; e <= r.last; e++) {
		let i = r.base + e;
		if (i >= t.length) break;
		let a = Math.hypot(r.xy[2 * e] - t[i].x, r.xy[2 * e + 1] - t[i].y);
		Number.isFinite(a) && (!n || a > n.metres) && (n = {
			metres: a,
			base: r.base,
			k: e
		});
	}
	return n;
}
function Eo(e) {
	return `Largest dream-versus-reality gap: ${e.metres.toFixed(1)} m, ${(e.k / 10).toFixed(1)} s into the plan made at t = ${(e.base / 10).toFixed(1)} s`;
}
function Do(e, t, n, r, i) {
	let a = Infinity, o = -Infinity, s = Infinity, c = -Infinity, l = (e, t) => {
		Number.isFinite(e) && Number.isFinite(t) && (a = Math.min(a, e), o = Math.max(o, e), s = Math.min(s, t), c = Math.max(c, t));
	};
	for (let e of t) l(e.x, e.y);
	for (let t of e) for (let e = 0; e <= t.last; e++) l(t.xy[2 * e], t.xy[2 * e + 1]);
	Number.isFinite(a) || (a = 0, o = 1, s = 0, c = 1);
	let u = Math.max(o - a, 1e-6), d = Math.max(c - s, 1e-6), f = Math.min((n - 2 * i) / u, (r - 2 * i) / d), p = (n - 2 * i - u * f) / 2, m = (r - 2 * i - d * f) / 2;
	return { toScreen: (e, t) => [i + p + (e - a) * f, r - i - m - (t - s) * f] };
}
function Oo(e, t, n, r, i, a) {
	let o = Do(r, i, t, n, 10);
	e.clearRect(0, 0, t, n), e.save(), e.lineWidth = 1, e.setLineDash([4, 3]), e.strokeStyle = "rgba(159, 211, 255, 0.7)";
	for (let t of r) {
		e.beginPath();
		for (let n = 0; n <= t.last; n++) {
			let [r, i] = o.toScreen(t.xy[2 * n], t.xy[2 * n + 1]);
			n === 0 ? e.moveTo(r, i) : e.lineTo(r, i);
		}
		e.stroke();
	}
	if (e.setLineDash([]), e.lineWidth = 2, e.strokeStyle = "#ffffff", e.beginPath(), i.forEach((t, n) => {
		let [r, i] = o.toScreen(t.x, t.y);
		n === 0 ? e.moveTo(r, i) : e.lineTo(r, i);
	}), e.stroke(), a) {
		let t = r.find((e) => e.base === a.base), n = i[a.base + a.k];
		if (t && n) {
			let [r, i] = o.toScreen(t.xy[2 * a.k], t.xy[2 * a.k + 1]), [s, c] = o.toScreen(n.x, n.y);
			e.strokeStyle = "#ff6b6b", e.lineWidth = 2, e.beginPath(), e.moveTo(r, i), e.lineTo(s, c), e.stroke(), e.fillStyle = "#ff6b6b", e.beginPath(), e.arc(r, i, 3, 0, 2 * Math.PI), e.fill();
		}
	}
	e.restore();
}
function ko(e, t, n) {
	if (t.length === 0) return [];
	let r = e.ownerDocument, i = r.defaultView?.devicePixelRatio ?? 1, a = r.createElement("canvas");
	a.className = "dvr-overlay", a.width = Math.round(320 * i), a.height = Math.round(160 * i), a.style.width = "320px", a.style.height = "160px", a.setAttribute("role", "img");
	let o = To(t, n);
	a.setAttribute("aria-label", o ? Eo(o) : "Dream versus reality");
	let s = a.getContext("2d");
	s && (s.scale(i, i), Oo(s, 320, 160, t, n, o));
	let c = r.createElement("p");
	return c.className = "dvr-caption", c.textContent = o ? Eo(o) : "Dream versus reality", e.append(a, c), [a, c];
}
function Ao(e = {}) {
	let t = new Co(), n = null, r = null, i = [], a = null, o = () => {
		for (let e of i) e.remove();
		i = [];
	};
	return {
		record: (e) => t.record(e),
		recordPath: (e, n, r) => t.recordPath(e, n, r),
		lastGap: () => a,
		mount(e, t) {
			n = e, r = t;
		},
		onFlightStart() {
			t.reset(), a = null, o();
			let n = e.meanSource?.();
			n && (n.onMean = (e) => {
				if (r?.flight()?.mode !== "manual") return;
				let { xy: n, last: i } = So(e);
				t.recordPath(e.anchorStep, n, i);
			});
		},
		onTouchdown(e) {
			let r = t.predictions.slice(), s = wo(e.world);
			if (a = To(r, s), e.attract || !n) return;
			let c = n.endcard;
			queueMicrotask(() => {
				o(), i = ko(c, r, s);
			});
		},
		destroy() {
			o();
		}
	};
}
//#endregion
//#region src/ui/ghostChrome.ts
function jo(e) {
	let t = () => n.onToggle?.(e.checked), n = {
		onToggle: null,
		setToggle(t) {
			e.checked = t.on, e.disabled = !t.enabled, e.title = t.enabled ? "Show the dream's predicted futures" : "Ghost futures need the dream model.";
		},
		destroy() {
			e.removeEventListener("change", t), e.disabled = !0;
		}
	};
	return e.addEventListener("change", t), n;
}
var Mo = 10;
function No(e) {
	return e.mode === "manual" && !e.attract && !e.ended;
}
var Po = class {
	deps;
	scheduler;
	display = new Xr();
	stopState;
	flight = null;
	enabled = !0;
	mode = null;
	handbackAt = null;
	floor = null;
	lastBits = 0;
	faultNotice = null;
	lastT = null;
	lastShown = null;
	shownSource = null;
	last = {
		show: null,
		badges: [],
		u: null
	};
	drawn = 0;
	requests = 0;
	replies = 0;
	ghostMs = null;
	onMean = null;
	onGhosts = (e) => {
		this.replies++, this.ghostMs = e.ms;
		let t = this.flight;
		if (!t || e.flightId !== t.flightId || this.floor !== null && e.anchorStep < this.floor || !this.scheduler.accept(e)) return;
		let n = t.world, r = Kr(e.mean, n.map, ja(n, e.anchorStep), Na(n, e.anchorStep)), i = this.lastT ?? n.step - 1 + 10, a = {
			flightId: e.flightId,
			anchorStep: e.anchorStep,
			mean: e.mean,
			touchdown: r
		};
		this.display.adopt(a, i, this.lastShown) && this.onMean?.(a);
	};
	constructor(e) {
		this.deps = e;
		let t = e.session.client;
		this.scheduler = new Ra({ requestGhosts: (e, n, r, i, a) => {
			this.requests++, t.requestGhosts(e, n, r, i, a);
		} }), t.onGhosts = this.onGhosts, this.stopState = e.session.onState(() => this.sync()), e.chrome.onToggle = (e) => this.setEnabled(e), this.sync();
	}
	startFlight(e) {
		this.flight = e, this.mode = e.mode, this.handbackAt = null, this.floor = null, this.lastBits = 0, this.faultNotice = null, this.lastT = null, this.lastShown = null, this.shownSource = null, this.last = {
			show: null,
			badges: [],
			u: null
		}, this.display.reset(), this.scheduler.startFlight(e.flightId, Math.floor(this.deps.random() * 2 ** 32));
	}
	onModelStep(e) {
		if (!this.isCurrent(e) || e.attract) return;
		let t = e.world;
		if (this.mode === "autopilot" && e.mode === "manual" && (this.handbackAt = t.step, this.floor = e.link.downlinkStep(t.step), this.display.reset(), this.scheduler.restart(), this.lastBits = Ma(t, e.link.downlinkStep(t.step))), e.mode === "autopilot" && this.mode !== "autopilot" && this.deps.session.client.dropPending(), this.mode = e.mode, e.mode === "autopilot" && this.display.reset(), e.mode !== "manual") return;
		let n = Ma(t, e.link.downlinkStep(t.step)), r = n & ~this.lastBits;
		r && (this.faultNotice = {
			bits: r,
			until: t.step + 30
		}), this.lastBits = n, this.deps.session.state() === "ready" && this.scheduler.onStep(t, e.link, e.mode);
	}
	setPaused(e) {
		this.scheduler.setPaused(e), e && this.deps.session.client.dropPending();
	}
	setEnabled(e) {
		e !== this.enabled && (this.enabled = e, this.sync(), this.scheduler.restart());
	}
	displayPose(e, t) {
		return this.last = this.resolve(e, t), this.lastT = t + 10, this.last.show && (this.lastShown = this.last.show.pose), this.last.show;
	}
	noteShown(e, t) {
		this.isCurrent(e) && (this.lastShown = t.pose, this.shownSource = t.source);
	}
	frame(e, t) {
		let n = this.enabled && this.isCurrent(e) && No(e) && this.last.show?.source === "predicted" ? this.scheduler.current : null, r = n ? oi(n, t + 10) : null;
		return this.drawn = r ? r.ghosts.length : 0, r;
	}
	insetFrame(e, t) {
		if (!this.isCurrent(e) || this.last.show?.source !== "predicted") return null;
		let n = Math.max(0, t - 10);
		return {
			pose: Sn(e.world, n),
			ageS: (t - n) * i
		};
	}
	badges() {
		return this.last.badges;
	}
	get showing() {
		return this.last.show?.source ?? null;
	}
	status() {
		let e = this.deps.session.client, t = this.deps.session.state(), n = this.display.current, r = this.last.show;
		return {
			state: t,
			modelState: wa(t),
			failReason: e.failReason,
			backendRequested: e.requestedBackend,
			info: e.info,
			enabled: this.enabled,
			drawnGhosts: this.drawn,
			painted: ni.painted,
			requests: this.requests,
			replies: this.replies,
			flightId: this.flight?.flightId ?? 0,
			ghostMs: this.ghostMs,
			chunks: this.chunks(),
			display: {
				source: r?.source ?? null,
				shown: this.shownSource,
				badges: [...this.last.badges],
				anchorStep: n?.anchorStep ?? null,
				u: this.last.u,
				rotor: r ? [r.pose.sF, r.pose.sR] : null,
				insetPainted: vi.painted
			}
		};
	}
	detach() {
		this.stopState();
		let e = this.deps.session.client;
		e.onGhosts === this.onGhosts && (e.onGhosts = null), this.deps.chrome.onToggle = null, this.display.reset(), this.flight = null;
	}
	resolve(e, t) {
		let n = {
			show: null,
			badges: [],
			u: null
		};
		if (!this.isCurrent(e) || e.mode !== "manual" || e.attract) return n;
		let r = this.deps.session.state();
		if (r === "idle" || r === "loading") return No(e) ? {
			show: null,
			badges: [W.loading],
			u: null
		} : n;
		if (r !== "ready") return n;
		let a = e.world, o = this.faultNotice && t < this.faultNotice.until ? Pr(this.faultNotice.bits) : [];
		if (a.done && (e.ended || t - 10 >= a.step)) return {
			show: null,
			badges: [...o, W.confirmed],
			u: null
		};
		if (!No(e)) return n;
		let s = this.display.at(t + 10);
		return s ? (s.touchedDown ? o.push(W.awaiting) : s.extrapolated && o.push(W.late), {
			show: {
				pose: s.pose,
				source: "predicted",
				age: -10 * i
			},
			badges: o,
			u: s.u
		}) : this.handbackAt !== null && !this.display.started && a.step - this.handbackAt < Mo ? {
			show: null,
			badges: [...o, W.handback],
			u: null
		} : {
			show: null,
			badges: [...o, this.display.started ? W.stale : W.loading],
			u: null
		};
	}
	isCurrent(e) {
		return this.flight !== null && e.flightId === this.flight.flightId;
	}
	chunks() {
		return this.deps.kManual ?? this.deps.session.info()?.kManual ?? 1;
	}
	sync() {
		let e = this.deps.session.state(), t = this.deps.session.info(), n = this.deps.session.client.info?.ghostSteps;
		if (e === "ready" && t && n) {
			let e = this.enabled ? t.backend === "wasm" ? 8 : 16 : 8;
			this.scheduler.configure({
				n: e,
				steps: n,
				k: this.enabled ? this.chunks() : 1
			});
		} else this.scheduler.configure(null), this.display.reset();
		let r = e !== "failed" && e !== "unloaded";
		this.deps.chrome.setToggle({
			on: r && this.enabled,
			enabled: r
		});
	}
}, Fo = {
	onToggle: null,
	setToggle: () => {},
	destroy: () => {}
};
function Io() {
	return {
		mountChrome: (e) => jo(e.ghostsToggle),
		mountDisplayChrome: Fr,
		random: Math.random
	};
}
function Lo(e, t) {
	let n = null, r = null, i = null, a = !1;
	return {
		controller: () => n,
		mount(a, o) {
			let s = t ?? Io();
			r = a ? s.mountChrome(a) : { ...Fo }, i = a ? s.mountDisplayChrome(a) : null, n = new Po({
				session: e.session,
				chrome: r,
				random: s.random,
				kManual: e.kManual ?? null
			}), e.onMount?.(n, o, a);
		},
		onFlightStart(e) {
			n?.startFlight(e);
		},
		afterStep(e) {
			n?.onModelStep(e);
		},
		displayPose(e, t) {
			return n ? n.displayPose(e, t) : null;
		},
		draw(e, t) {
			if (a = !1, !n) return;
			n.noteShown(t.flight, t.display);
			let r = n.frame(t.flight, t.displayStep), o = n.insetFrame(t.flight, t.displayStep);
			i?.setPredicting(n.showing === "predicted"), e.save(), e.setTransform(t.dpr, 0, 0, t.dpr, 0, 0), r && si(e, ci(t.camera, t.w, t.h), r, t.style.palette), o && t.style.inset && (Ti(e, t.w, t.flight.world.map, o, t.style), a = !0), e.restore();
		},
		insetDrawn: () => a,
		badges(e, t) {
			return n ? n.badges().map((e) => e === W.awaiting ? t.awaitingTouchdown : e) : [];
		},
		onPause() {
			n?.setPaused(!0);
		},
		onResume() {
			n?.setPaused(!1);
		},
		destroy() {
			n?.detach(), r?.destroy(), i?.destroy(), n = null, a = !1, r = null, i = null;
		}
	};
}
function Ro(e, t, n) {
	return !e || e.flightId !== n || t - e.atMs > 1500 || !Number.isFinite(e.pSafe) ? null : e;
}
var zo = (e) => `${Math.round(Math.min(1, Math.max(0, e)) * 100)}%`;
function Bo(e) {
	let t = e.hasValue ? Ro(e.value, e.nowMs, e.flightId) : null;
	if (e.mode === "autopilot") {
		let n = e.counted;
		return n && n.n > 0 && Number.isFinite(n.value) ? {
			label: "Landing probability",
			value: zo(n.value),
			source: `from ${n.n} future${n.n === 1 ? "" : "s"}`
		} : t ? {
			label: "Landing probability",
			value: zo(t.pSafe),
			source: "estimated"
		} : null;
	}
	if (!t) return null;
	let n = e.ageS !== null && Number.isFinite(e.ageS) ? `, ${Math.max(0, e.ageS).toFixed(1)} s old` : "";
	return {
		label: "Autopilot could land from here",
		value: zo(t.pSafe),
		source: `estimated from the downlink${n}`
	};
}
function Vo(e) {
	let t = e.createElement("div");
	t.className = "instrument landing-readout", t.setAttribute("aria-live", "polite");
	let n = e.createElement("span");
	n.className = "instrument-label";
	let r = e.createElement("span");
	r.className = "instrument-value";
	let i = e.createElement("small");
	return i.className = "instrument-source", t.append(n, r, i), t.hidden = !0, {
		el: t,
		update(e) {
			t.hidden = e === null, e && (n.textContent = e.label, r.textContent = e.value, i.textContent = e.source);
		}
	};
}
//#endregion
//#region src/ui/valueSnapshot.ts
var Ho = {
	front: 0,
	rear: 0
};
function Uo(e) {
	let t = e.world;
	return e.mode === "autopilot" ? Fa(t, t.step > 0 ? t.records[t.step - 1].cmd : Ho) : Ia(t, e.link);
}
//#endregion
//#region src/ui/readoutFeature.ts
var Wo = 5;
function Go(e) {
	let t = e.now ?? (() => performance.now()), n = e.session.client, r = null, a = null, o = -1, s = -Infinity, c = !1, l = (e) => {
		e.flightId === o && (a = {
			pSafe: e.pSafe,
			tGo: e.tGo,
			atMs: t(),
			flightId: e.flightId,
			anchorStep: e.anchorStep
		});
	}, u = () => e.session.state() === "ready" && (e.session.info()?.hasValue ?? !1), d = (e) => e.mode === "manual" && a && a.anchorStep > e.link.downlinkStep(e.world.step) ? null : a;
	return {
		mount(t) {
			t && (r = e.createView ? e.createView(t) : Vo(t.root.ownerDocument), t.instruments.append(r.el)), n.onValue = l;
		},
		onFlightStart(e) {
			o = e.flightId, a = null, s = -Infinity, r?.update(null);
		},
		afterStep(e) {
			if (c || e.ended || e.flightId !== o || !u()) return;
			let t = e.world.step;
			if (t - s < Wo) return;
			let r = Uo(e);
			r && (s = t, n.requestValue({
				...r,
				flightId: e.flightId
			}));
		},
		reportState(e) {
			let n = u() ? Ro(d(e), t(), e.flightId) : null;
			return { landing: n ? {
				pSafe: n.pSafe,
				tGo: n.tGo
			} : null };
		},
		draw(n, a) {
			let o = a.flight, s = d(o);
			r?.update(Bo({
				mode: o.mode,
				hasValue: u(),
				value: s,
				nowMs: t(),
				flightId: o.flightId,
				counted: o.mode === "autopilot" ? e.counted?.(o) ?? null : null,
				ageS: o.mode === "manual" && s ? (o.world.step - s.anchorStep) * i : null
			}));
		},
		onPause() {
			c = !0;
		},
		onResume() {
			c = !1;
		},
		destroy() {
			n.onValue === l && (n.onValue = null), r?.el.remove(), r = null, a = null;
		},
		latest: () => a
	};
}
//#endregion
//#region src/ui/sessionFeature.ts
function Ko(e, t) {
	if (typeof IntersectionObserver > "u") return t(), () => {};
	let n = !1, r = new IntersectionObserver((e) => {
		!n && e.some((e) => e.isIntersecting) && (n = !0, r.disconnect(), t());
	});
	return r.observe(e), () => {
		n = !0, r.disconnect();
	};
}
function qo(e, t) {
	let n = new URL(e, t).href;
	return n.endsWith("/") ? n : `${n}/`;
}
function Jo(e, t = {}, n) {
	let r = null, i = null, a = null;
	return {
		mount(a, o) {
			t.onMount?.(a, o);
			let s = n ?? {
				observeOnce: Ko,
				baseURI: () => document.baseURI
			}, c = null, l = (e) => {
				let t = wa(e);
				t !== c && (c = t, o.setModelState(t));
			};
			i = e.onState(l), l(e.state());
			let u = qo(t.dreamBase ?? o.opts.assetBase, s.baseURI()), { modelsBase: d, ortBase: f, debugPlanDelayMs: p } = o.opts, m = () => {
				e.ensureLoaded(u, {
					wantValue: t.wantValue ?? !1,
					...d ? { modelsBase: d } : {},
					...f ? { ortBase: f } : {},
					...p ? { planDelayMs: p } : {}
				});
			}, h = a?.root ?? o.canvas ?? null;
			h ? r = s.observeOnce(h, m) : m();
		},
		onFlightStart(t) {
			e.client.setFlight(t.flightId), t.world.map !== a && (a = t.world.map, e.client.setMap(t.world.map));
		},
		async destroy() {
			r?.(), i?.(), r = null, i = null, a = null, await e.unload();
		}
	};
}
//#endregion
//#region src/lib/libraryFeatures.ts
function Yo() {
	return {
		fetch: (e, t) => fetch(e, t),
		selectBackend: () => ha(ma(""))
	};
}
function Xo(e, t = Yo()) {
	let n = Ta(e, t), r = Lo({ session: n }), i = Ao({ meanSource: () => r.controller() }), a = yo({
		session: n,
		ghostsOn: () => r.controller()?.status().enabled ?? !0,
		onAdopt: i.record
	});
	return [
		Jo(n, { wantValue: !0 }),
		r,
		a,
		Oa({ session: n }),
		i,
		xo({ gap: i.lastGap }),
		Go({
			session: n,
			counted: (e) => a.counted(e)
		})
	];
}
//#endregion
//#region src/lib/debug.ts
var Zo = Symbol.for("lander.debug"), Qo = Symbol.for("lander.debugOptions"), $o = 6e4;
function es(e) {
	let t = e[Qo];
	if (t === void 0) return {};
	let n = t?.planDelayMs;
	if (n === void 0) return {};
	if (typeof n != "number" || !Number.isFinite(n) || n < 0 || n > 6e4) throw TypeError(`lander: debug planDelayMs must be a number of ms in [0, ${$o}]`);
	return { planDelayMs: n };
}
//#endregion
//#region src/lib/flightEvents.ts
var ts = 16, ns = class {
	emit;
	flights = /* @__PURE__ */ new Map();
	chains = /* @__PURE__ */ new Set();
	closed = !1;
	constructor(e) {
		this.emit = e;
	}
	push(e) {
		if (!this.closed) switch (e.type) {
			case "start":
				if (this.flights.has(e.flightId)) return;
				this.flights.set(e.flightId, {
					visitor: !e.attract,
					mode: e.mode,
					hop: e.hop,
					level: e.level,
					ended: !1
				}), this.prune(), e.attract || this.emit({
					type: "flight_started",
					mode: e.mode,
					hop: e.hop,
					level: e.level
				});
				return;
			case "mode": {
				let t = this.flights.get(e.flightId);
				if (!t || t.ended || e.mode === t.mode) return;
				if (t.mode = e.mode, !t.visitor) {
					t.visitor = !0, this.emit({
						type: "flight_started",
						mode: e.mode,
						hop: t.hop,
						level: t.level
					});
					return;
				}
				this.emit({
					type: "handover",
					to: e.mode
				});
				return;
			}
			case "touchdown": {
				let t = this.flights.get(e.flightId);
				if (!t || t.ended) return;
				t.ended = !0, t.mode = e.mode, t.visitor && this.emit({
					type: e.safe ? "landed" : "crashed",
					hop: t.hop,
					level: t.level,
					mode: e.mode
				});
				return;
			}
			case "chain": {
				let t = this.flights.get(e.flightId);
				if (!t || !t.visitor || this.chains.has(e.flightId)) return;
				this.chains.add(e.flightId), this.emit({
					type: "chain_finished",
					landed: e.landed
				});
				return;
			}
			default: return;
		}
	}
	close() {
		this.closed = !0, this.flights.clear(), this.chains.clear();
	}
	prune() {
		for (; this.flights.size > ts;) this.flights.delete(Math.min(...this.flights.keys()));
		for (; this.chains.size > ts;) this.chains.delete(Math.min(...this.chains));
	}
};
//#endregion
//#region src/lib/assetBase.ts
function rs(e, t, n, r = new URL(n).origin) {
	if (typeof e != "string" || e.trim() === "") throw TypeError(`lander: opts.${t} must be the URL of a directory${t === "assetBase" ? " holding lander.js" : ""}`);
	let i = e.trim();
	if (i.includes("?") || i.includes("#")) throw TypeError(`lander: opts.${t} must not carry a query or fragment; version the directory instead`);
	let a;
	try {
		a = new URL(i.replace(/\/*$/, "/"), n);
	} catch {
		throw TypeError(`lander: opts.${t} "${i}" is not a URL`);
	}
	if (a.protocol !== "http:" && a.protocol !== "https:") throw TypeError(`lander: opts.${t} must be an http(s) URL, got ${a.protocol}`);
	if (a.username || a.password) throw TypeError(`lander: opts.${t} must not carry credentials`);
	if (a.origin !== r) throw TypeError(`lander: opts.${t} must be on this page's origin (${r}), not ${a.origin}: a module worker loads only from the page's own origin, so serve dist/lander from the site`);
	return a.href.replace(/\/+$/, "/");
}
var is = (e) => typeof e == "object" && !!e && !Array.isArray(e);
function as(e, t, n) {
	if (e === void 0) return {};
	if (!is(e)) throw TypeError(`lander: opts.${n} must be an object when given`);
	let r = {};
	for (let i of t) {
		let t = e[i];
		if (t !== void 0) {
			if (typeof t != "string") throw TypeError(`lander: opts.${n}.${i} must be a string`);
			r[i] = t;
		}
	}
	return r;
}
var os = ["wasm", "webgpu"];
function ss(e, t, n) {
	if (e === void 0) return {
		wasm: null,
		webgpu: null
	};
	if (typeof e == "string") {
		let r = rs(e, "ortBase", t, n);
		return {
			wasm: r,
			webgpu: r
		};
	}
	if (!is(e)) throw TypeError("lander: opts.ortBase must be a string or an object { wasm?, webgpu? } when given");
	let r = Object.keys(e).filter((e) => !os.includes(e));
	if (r.length > 0) throw TypeError(`lander: opts.ortBase has unknown key ${r.map((e) => JSON.stringify(e)).join(", ")}; the keys are wasm and webgpu`);
	let i = {
		wasm: null,
		webgpu: null
	};
	for (let r of os) {
		let a = e[r];
		if (a !== void 0) {
			if (typeof a != "string") throw TypeError(`lander: opts.ortBase.${r} must be a string when given`);
			i[r] = rs(a, `ortBase.${r}`, t, n);
		}
	}
	return i;
}
function cs(e, t, n) {
	if (!e || typeof e != "object") throw TypeError("lander: mount(container, opts) needs an options object");
	if (e.reducedMotion !== void 0 && typeof e.reducedMotion != "boolean") throw TypeError("lander: opts.reducedMotion must be a boolean when given");
	if (e.onEvent !== void 0 && typeof e.onEvent != "function") throw TypeError("lander: opts.onEvent must be a function when given");
	if (e.onState !== void 0 && typeof e.onState != "function") throw TypeError("lander: opts.onState must be a function when given");
	if (e.ui !== void 0 && e.ui !== "full" && e.ui !== "none") throw TypeError("lander: opts.ui must be 'full' or 'none' when given");
	if (e.inset !== void 0 && typeof e.inset != "boolean") throw TypeError("lander: opts.inset must be a boolean when given");
	let r = e.aspect ?? 1.7777777777777777;
	if (r !== "fill" && !(typeof r == "number" && Number.isFinite(r) && r > 0)) throw TypeError("lander: opts.aspect must be a positive finite number or 'fill'");
	let i = e.zoom ?? 1;
	if (!(typeof i == "number" && Number.isFinite(i) && i >= 1 && i <= 4)) throw TypeError("lander: opts.zoom must be a finite number in [1, 4] when given");
	let a = rs(e.assetBase, "assetBase", t, n), o = e.modelsBase === void 0 ? `${a}models/` : rs(e.modelsBase, "modelsBase", t, n), s = ss(e.ortBase, t, n), c = as(e.theme, dr, "theme"), l;
	return l = e.text === !1 ? null : {
		...V,
		...as(e.text, fr, "text")
	}, {
		assetBase: a,
		modelsBase: o,
		ortBase: s,
		ui: e.ui ?? "full",
		theme: c,
		text: l,
		inset: e.inset ?? !0,
		aspect: r,
		zoom: i,
		reducedMotion: e.reducedMotion,
		onEvent: e.onEvent,
		onState: e.onState
	};
}
var ls = .001, us = {
	now: () => performance.now(),
	setTimer: (e, t) => setTimeout(e, t),
	clearTimer: (e) => clearTimeout(e)
}, $ = (e, t) => Math.abs(e - t) <= ls;
function ds(e, t) {
	if (e.mode !== t.mode || e.attract !== t.attract || e.hop !== t.hop || e.level !== t.level || e.model !== t.model || e.planner !== t.planner || e.display !== t.display || e.outcome !== t.outcome) return !1;
	let n = e.flight, r = t.flight;
	return !$(n.agl, r.agl) || !$(n.vx, r.vx) || !$(n.vy, r.vy) || !$(n.tiltDeg, r.tiltDeg) || !$(n.energy, r.energy) || !$(n.windMs, r.windMs) ? !1 : e.landing === null || t.landing === null ? e.landing === t.landing : $(e.landing.pSafe, t.landing.pSafe) && $(e.landing.tGo, t.landing.tGo);
}
function fs(e) {
	return Object.freeze({
		...e,
		flight: Object.freeze({ ...e.flight }),
		landing: e.landing ? Object.freeze({ ...e.landing }) : null
	});
}
var ps = class {
	onState;
	clock;
	last = null;
	lastAt = -Infinity;
	pending = null;
	timer = null;
	closed = !1;
	constructor(e, t = us) {
		this.onState = e, this.clock = t;
	}
	push(e) {
		if (this.closed) return;
		if (this.last && ds(this.last, e)) {
			this.pending = null;
			return;
		}
		let t = this.clock.now();
		if (t - this.lastAt >= 100) {
			this.send(e, t);
			return;
		}
		this.pending = e, this.timer === null && (this.timer = this.clock.setTimer(() => {
			this.timer = null;
			let e = this.pending;
			e && !this.closed && this.send(e, this.clock.now());
		}, 100 - (t - this.lastAt)));
	}
	close() {
		this.closed = !0, this.pending = null, this.timer !== null && this.clock.clearTimer(this.timer), this.timer = null;
	}
	send(e, t) {
		this.pending = null, this.last = e, this.lastAt = t;
		try {
			this.onState(fs(e));
		} catch (e) {
			console.error("lander: onState threw", e);
		}
	}
}, ms = /* @__PURE__ */ new WeakSet();
function hs(e, t, n) {
	let { doc: r } = n;
	if (!e || e.nodeType !== 1) throw TypeError("lander: mount(container) needs an HTMLElement");
	let i = cs(t, r.baseURI, r.location?.origin ?? new URL(r.baseURI).origin), a = es(t);
	if (ms.has(e)) throw Error("lander: this container already holds a mounted lander; await handle.unload() first");
	let o = i.assetBase, s = r.createElement("div");
	s.dataset.lander = "root", s.style.position = "relative", s.style.width = "100%", i.ui === "none" ? (s.style.display = "block", i.aspect === "fill" && (s.style.height = "100%")) : s.style.height = "100%", e.appendChild(s), ms.add(e);
	let c = i.onEvent, l = new ns((e) => {
		if (c) try {
			c(e);
		} catch (e) {
			console.error("lander: onEvent threw", e);
		}
	}), u = i.onState ? new ps(i.onState, n.clock) : null, d;
	try {
		let e = () => n.createWorker(o);
		d = n.createApp(s, {
			assetBase: o,
			reducedMotion: i.reducedMotion,
			theme: i.theme,
			text: i.text,
			ui: i.ui,
			inset: i.inset,
			aspect: i.aspect,
			zoom: i.zoom,
			modelsBase: i.modelsBase,
			...i.ortBase.wasm || i.ortBase.webgpu ? { ortBase: Object.fromEntries(Object.entries(i.ortBase).filter(([, e]) => e)) } : {},
			...a.planDelayMs ? { debugPlanDelayMs: a.planDelayMs } : {},
			manageVisibility: !0,
			createWorker: e,
			onFlight: (e) => l.push(e),
			...u ? { onState: (e) => u.push(e) } : {},
			features: n.features(e)
		});
	} catch (t) {
		throw l.close(), u?.close(), s.remove(), ms.delete(e), t;
	}
	let f = !1, p = null, m = null, h = {
		...Object.fromEntries(Nn.map((e) => [e, (...t) => {
			p || Mn[e](d.commands, ...t);
		}])),
		pause() {
			p || (f = !0, d.pause());
		},
		resume() {
			p || (f = !1, d.resume());
		},
		unload() {
			return p || (d.pause(), l.close(), u?.close(), m = d.debug(), p = (async () => {
				try {
					await d.destroy();
				} catch (e) {
					console.error("lander: teardown failed", e);
				} finally {
					s.remove(), ms.delete(e);
				}
			})(), p);
		}
	};
	return Object.defineProperty(h, Zo, {
		enumerable: !1,
		value: () => ({
			...m ?? d.debug(),
			hostPaused: f,
			hidden: r.hidden === !0,
			unloaded: p !== null
		})
	}), h;
}
//#endregion
//#region src/lib/workerFactory.ts
function gs(e) {
	if (!e.endsWith("/")) throw TypeError("lander: worker base must end in \"/\" (pass a normalized assetBase)");
	return new Worker(`${e}lander-worker.js`, { type: "module" });
}
//#endregion
//#region src/index.ts
function _s(e, t) {
	return hs(e, t, {
		createApp: la,
		createWorker: gs,
		features: (e) => Xo(e),
		doc: e?.ownerDocument ?? document
	});
}
//#endregion
export { _s as mount };

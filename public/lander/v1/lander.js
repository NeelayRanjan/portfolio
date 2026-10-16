//#region src/engine/constants.ts
var e = Math.PI / 180, t = 1.352, n = 5.3, r = 1 / 120, i = .1, a = 3.85, o = 1.75, s = 2.5, c = 1.25, l = 1.35, u = 1.3;
u * 875 * t;
var d = -.35, f = .1, p = 1.8, m = 1.2, h = 1600, g = -.85, _ = .05, v = .3, y = .015, b = .8, x = .6, ee = .6, S = 2 * Math.PI * (l / 2) ** 2, C = 2e6, te = .005, ne = 1.6, re = [
	.3,
	1,
	2,
	4
], ie = [
	.1,
	.3,
	.5,
	1
], w = .3, ae = .5, oe = 1.5, T = [.5, 1.5], se = 1.5, ce = .8, E = 10 * e, le = 10 * e, ue = 15 * e, D = 4e3, O = 2001, k = D / 4, de = 30 * e, fe = [
	-6,
	-2,
	2,
	6
], pe = .1 * C, me = .55, he = .6, ge = 35 * e, _e = 2.5, ve = .12, ye = .05;
35 * e, 6 * e, 2 * e;
var be = 8 * e, xe = 1.2;
//#endregion
//#region src/engine/rng.ts
function Se(e, t) {
	let n = (Math.imul(e >>> 0, 2654435761) ^ Math.imul((t >>> 0) + 2135587861, 2246822519)) >>> 0;
	return n ^= n >>> 16, n = Math.imul(n, 2146121005), n ^= n >>> 15, n = Math.imul(n, 2221713035), n ^= n >>> 16, n >>> 0;
}
function A(e) {
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
			return A(Se(t, e));
		}
	};
}
//#endregion
//#region src/engine/knobs.ts
var Ce = {
	tMaxFrac: u,
	mixKp: me,
	inertiaPerKg: p,
	kOmega: h
};
function we() {
	return Ce.tMaxFrac * 875 * t;
}
function Te() {
	return Ce.mixKp;
}
function Ee() {
	return 875 * Ce.inertiaPerKg;
}
function De() {
	return Ce.kOmega;
}
//#endregion
//#region src/engine/rotor.ts
function Oe(e) {
	let t = Number.isFinite(e) ? Math.min(1, Math.max(0, e)) : 0, n = Math.round(1 / _);
	return Math.round(t * n) / n;
}
function j(e) {
	return {
		front: Oe(e.front),
		rear: Oe(e.rear)
	};
}
function ke() {
	return {
		weak: [!1, !1],
		gustFrontUntil: -1,
		gustFrontDu: 0,
		lidarUntil: -1
	};
}
function Ae(e, t) {
	let n = 0;
	return e.weak[0] && (n |= 1), e.weak[1] && (n |= 2), t < e.gustFrontUntil && (n |= 4), t < e.lidarUntil && (n |= 8), n;
}
function je(e, t) {
	return {
		weak: [!!(e & 1), !!(e & 2)],
		gustFrontUntil: e & 4 ? t + 1 : -1,
		gustFrontDu: 0,
		lidarUntil: e & 8 ? t + 1 : -1
	};
}
function M(e, t) {
	return e.weak[t] ? we() * x : we();
}
var Me = 1 - Math.exp(-r / v);
function Ne(e, t) {
	return e + (t - e) * Me;
}
var Pe = Math.exp(-i / b), Fe = y * Math.sqrt(1 - Pe * Pe);
function Ie(e, t) {
	return e * Pe + Fe * t;
}
//#endregion
//#region src/terrain/profile.ts
function N(e, t) {
	if (!(t > 0)) return e.heights[0];
	if (t >= 4e3) return e.heights[O - 1];
	let n = t / 2, r = Math.floor(n), i = n - r;
	return e.heights[r] * (1 - i) + e.heights[r + 1] * i;
}
function Le(e, t) {
	return (N(e, t + 1) - N(e, t - 1)) / 2;
}
function Re(e, t, n) {
	let r = Math.min(t, n), i = Math.max(t, n);
	return i - r < .01 ? Math.atan(Math.abs(Le(e, r))) : Math.atan(Math.abs(N(e, i) - N(e, r)) / (i - r));
}
function P(e) {
	return Math.floor(e / 4);
}
function ze(e) {
	return (e + .5) * 4;
}
//#endregion
//#region src/engine/energy.ts
var Be = 1 / (Math.sqrt(2 * n * S) * ee);
function F(e) {
	return e > 0 ? e ** 1.5 * Be : 0;
}
function Ve(e = ke()) {
	let n = Oe(875 * t / (M(e, 0) + M(e, 1)));
	return {
		front: n,
		rear: n
	};
}
function He(e = ke()) {
	let n = c - d, r = c + d, i = 875 * t, a = i * r / (n + r), o = i - a;
	return [a / M(e, 0), o / M(e, 1)];
}
//#endregion
//#region src/engine/sim.ts
var Ue = c - d, We = -c - d, Ge = .5 * n * 2, Ke = .5 * n * m;
function I(e) {
	let t = e - 2 * Math.PI * Math.floor((e + Math.PI) / (2 * Math.PI));
	return t === -Math.PI ? Math.PI : t;
}
function qe(e, t = {}) {
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
function Je(e, t) {
	if (!(e > 0)) return 0;
	let r = Math.sqrt(e / (2 * n * S));
	return -n * S * r * t;
}
function Ye(e, n, r, i) {
	let a = Math.sin(e.theta), o = Math.cos(e.theta), s = e.vx - i[0], c = e.vy - i[1], l = -Ge * Math.abs(s) * s, u = -Ke * Math.abs(c) * c, p = n + r, m = s * o + c * a + e.omega * f, h = Je(n, m) + Je(r, m), g = -d * o + f * a, _ = -d * a - f * o, v = Ue * n + We * r + f * h + (g * u - _ * l) - De() * e.omega;
	return {
		ax: (-p * a + h * o + l) / 875,
		ay: (p * o + h * a + u) / 875 - t,
		alpha: v / Ee()
	};
}
function Xe(e, t, n) {
	let i = Ne(e.sF, n ? 0 : t.uF), a = Ne(e.sR, n ? 0 : t.uR), o = Math.max(0, i * (1 + t.epsF) * t.tmF), s = Math.max(0, a * (1 + t.epsR) * t.tmR), c = F(o) + F(s), l = n ? 0 : F(t.uF * t.tmF) + F(t.uR * t.tmR);
	return {
		sF: i,
		sR: a,
		tF: o,
		tR: s,
		energy: Math.max(0, e.energy - c * r),
		energyEst: Math.max(0, e.energyEst - l * r)
	};
}
function Ze(e, t, n) {
	let i = Xe(e, t, n.energyLocked || e.energy <= 0), a = Ye(e, i.tF, i.tR, n.windAt(e.x, e.y)), o = e.vx + a.ax * r, s = e.vy + a.ay * r, c = e.omega + a.alpha * r;
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
function Qe(e, t, n, r) {
	let i = j(t), a = Ie(e.epsF, r.normal()), o = Ie(e.epsR, r.normal());
	return {
		uF: i.front,
		uR: i.rear,
		tmF: M(n.faults, 0),
		tmR: M(n.faults, 1),
		epsF: a,
		epsR: o
	};
}
function $e(e, t, n, r) {
	let i = Qe(e, t, n, r), a = [], o = e;
	for (let e = 0; e < 12; e++) o = Ze(o, i, n), a.push(o);
	return a;
}
function et(e, t, n, i) {
	let a = Qe(e, t, n, i), o = [], s = {
		...e,
		vx: 0,
		vy: 0,
		omega: 0
	}, c = -1;
	for (let e = 0; e < 12; e++) {
		if (c < 0) {
			let t = n.energyLocked || s.energy <= 0, i = Xe(s, a, t);
			(i.tF + i.tR) * Math.cos(s.theta) > 1183 ? (c = e, s = Ze(s, a, n)) : s = {
				...s,
				sF: i.sF,
				sR: i.sR,
				epsF: a.epsF,
				epsR: a.epsR,
				energy: i.energy,
				energyEst: i.energyEst,
				t: s.t + r
			};
		} else s = Ze(s, a, n);
		o.push(s);
	}
	return {
		states: o,
		liftOff: c
	};
}
//#endregion
//#region src/engine/touchdown.ts
var tt = [-1 - d, g - f], nt = [1 - d, g - f], rt = [[-s / 2 - d, 1 / 2 - f], [s / 2 - d, 1 / 2 - f]];
function it(e, t) {
	let n = Math.cos(e.theta), r = Math.sin(e.theta);
	return [e.x + t[0] * n - t[1] * r, e.y + t[0] * r + t[1] * n];
}
function at(e) {
	return [it(e, tt), it(e, nt)];
}
function L(e, t) {
	let [n, r] = at(e);
	return Math.min(n[1] - N(t, n[0]), r[1] - N(t, r[0]));
}
function R(e, t) {
	let n = L(e, t);
	for (let r of rt) {
		let [i, a] = it(e, r);
		n = Math.min(n, a - N(t, i));
	}
	return n;
}
function ot(e, t) {
	let n = ut(t, e.x);
	return Math.abs(I(e.theta - n.theta)) <= E && Math.abs(e.vx) <= .8 && Math.abs(e.vy) <= 1.5 && Math.abs(e.omega) <= le;
}
function st(e, t, n) {
	let [r, i] = at(e), a = Math.min(r[0], i[0]), o = Math.max(r[0], i[0]), s = a < 0 || o > 4e3, c = s, l = Math.max(0, P(a)), u = Math.min(k - 1, P(o));
	for (let e = l; e <= u && !c; e++) n(e) && (c = !0);
	let d = I(e.theta), f = {
		vy: se - Math.abs(e.vy),
		vx: ce - Math.abs(e.vx),
		theta: E - Math.abs(d),
		omega: le - Math.abs(e.omega),
		slope: ue - Re(t, a, o),
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
function z(e, t, n) {
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
function ct(e, t) {
	return e <= 0 ? 0 : Math.min(1, Math.max(0, e / (e - t)));
}
function lt(e, t, n) {
	if (e.length < 2) return null;
	let r = R(e[0], t);
	for (let i = 1; i < e.length; i++) {
		let a = R(e[i], t);
		if (a < 0) {
			let o = ct(r, a), s = z(e[i - 1], e[i], o);
			return {
				index: i,
				alpha: o,
				contact: st(s, t, n)
			};
		}
		r = a;
	}
	return null;
}
function ut(e, t) {
	let n = 0;
	for (let r = 0; r < 3; r++) {
		let [r, i] = at({
			x: t,
			y: 0,
			vx: 0,
			vy: 0,
			theta: n,
			omega: 0
		});
		n = Math.atan2(N(e, i[0]) - N(e, r[0]), i[0] - r[0]);
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
function dt(e) {
	return e > .005 ? Math.min(ne, Math.max(0, Math.log(e / te) / Math.log(10 / te))) : 0;
}
function ft(e, t) {
	let n = e.fSite;
	if (!(t > 0)) return n[0];
	if (t >= 4e3) return n[O - 1];
	let r = t / 2, i = Math.floor(r), a = r - i;
	return n[i] * (1 - a) + n[i + 1] * a;
}
function pt(e, t, n, r) {
	let i = r - N(e, n), a = e.windDir * re[t] * ft(e, n) * dt(i);
	return [a, a * Le(e, n) * Math.exp(-Math.max(i, 0) / 30)];
}
var mt = class {
	rng;
	u;
	w;
	sigma;
	constructor(e, t) {
		this.rng = t, this.sigma = ie[e], this.u = this.sigma * t.normal(), this.w = w * this.sigma * t.normal();
	}
	step(e) {
		let t = Math.exp(-e / 4), n = Math.sqrt(1 - t * t);
		this.u = this.u * t + this.sigma * n * this.rng.normal(), this.w = this.w * t + w * this.sigma * n * this.rng.normal();
	}
}, ht = class {
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
		this.log = [], this.held = j(e), this.from = t;
	}
	send(e, t) {
		if (t < this.from) throw Error(`DelayLink: send at step ${t} before the reset at ${this.from}`);
		let n = this.log[this.log.length - 1];
		if (n && t < n.step) throw Error(`DelayLink: send at step ${t} after step ${n.step}`);
		let r = j(e);
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
}, gt = {
	next: () => .5,
	normal: () => 0,
	int: () => 0,
	fork: () => gt
};
function _t(e, t, n, r, i) {
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
			faults: je(n, r + i),
			windAt: () => [0, 0],
			energyLocked: a.energy <= 0
		};
		if (o) {
			let e = et(a, t, l, gt);
			a = e.states[e.states.length - 1], e.liftOff >= 0 && (o = !1);
		} else {
			let n = $e(a, t, l, gt), r = a, i = R(r, e);
			a = n[n.length - 1];
			for (let t of n) {
				let n = R(t, e);
				if (n < 0 && t.vy <= 0) {
					let c = {
						...t,
						...z(r, t, ct(i, n))
					};
					ot(c, e) ? (a = {
						...a,
						...ut(e, t.x)
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
var vt = {
	tx: 0,
	ty: 0
};
function yt(e) {
	let t = Math.hypot(e.tx, e.ty);
	if (!(t > 1e-9) || !(e.ty > 0)) return {
		tx: 0,
		ty: 0
	};
	let n = Math.max(-ge, Math.min(ge, Math.atan2(e.tx, e.ty))), r = Math.min(1, t);
	return {
		tx: r * Math.sin(n),
		ty: r * Math.cos(n)
	};
}
function bt(e, t, n) {
	let r = +!!t.right - !!t.left, i = +!!t.up - !!t.down;
	return r === 0 && i === 0 ? e : yt({
		tx: e.tx + r * he * n,
		ty: e.ty + i * he * n
	});
}
function xt(e) {
	return e.tx === 0 && e.ty === 0 ? 0 : -Math.atan2(e.tx, e.ty);
}
function St(e) {
	return Math.hypot(e.tx, e.ty);
}
//#endregion
//#region src/control/mixer.ts
function Ct(e, t) {
	let n = St(e), r = I(xt(e) - t), i = Te() * r;
	return {
		front: Oe(n + i),
		rear: Oe(n - i)
	};
}
//#endregion
//#region src/terrain/fog.ts
var wt = Math.cos(de);
function Tt(e, t) {
	let n = Math.sin(e.theta), r = -Math.cos(e.theta), i = Math.max(0, P(e.x - 250)), a = Math.min(k - 1, P(e.x + 250)), o = [];
	for (let s = i; s <= a; s++) {
		let i = ze(s), a = i - e.x, c = N(t, i) - e.y, l = Math.hypot(a, c);
		l > 250 || l < 1e-9 || (a * n + c * r) / l >= wt && o.push(s);
	}
	return o;
}
function Et(e, t, n) {
	let r = new Uint8Array(k);
	for (let i = 0; i < k; i++) {
		let a = e[i];
		if (a < 0 || a > n) continue;
		let o = t[i];
		r[i] = o >= 0 && o <= n ? 2 : 1;
	}
	return r;
}
//#endregion
//#region src/terrain/hazards.ts
var Dt = [
	.02,
	.03,
	.04,
	.07,
	.05
], Ot = 25 * e;
function kt(e, t) {
	let n = e * 4, r = n + 4;
	return t.some((e) => r > e.from && n < e.to);
}
function At(e, t, n, r, i) {
	let a = new Uint8Array(k);
	for (let t = 0; t < k; t++) {
		let n = t * 4;
		Math.atan(Math.abs(N(e, n + 4) - N(e, n)) / 4) > Ot && (a[t] = 1);
	}
	let o = Math.round(Dt[t - 1] * k), s = 0, c = (e) => {
		let t = 1 + i.int(3);
		for (let n = 0; n < t; n++) {
			let t = e + i.int(11) - 5, n = 1 + i.int(3);
			for (let e = t; e < t + n; e++) e < 0 || e >= 1e3 || a[e] || (a[e] = 1, s++);
		}
	};
	for (let e = 0; s < o && e < 1e4; e++) c(i.int(k));
	if (t === 4) for (let e of r) for (let t of [-1, 1]) c(P((t < 0 ? e.from : e.to) + t * (8 + 32 * i.next())));
	for (let e = 0; e < k; e++) a[e] && kt(e, n) && (a[e] = 0);
	return a;
}
function jt(e, t, n) {
	let r = 16 + 24 * n.next(), i = t + (n.next() - .5) * 8;
	return {
		from: P(i - r / 2),
		to: P(i + r / 2)
	};
}
//#endregion
//#region src/terrain/labels.ts
var Mt = "illustrative, generated from Cassini-observed dune and crater statistics", Nt = [
	"interdune organics",
	"dune sand sampling",
	"water-ice bedrock exposure",
	"prebiotic chemistry site",
	"Selk rim ejecta",
	"impact melt deposit",
	"crater floor sediments",
	"channel outwash deposit"
];
function Pt(e, t) {
	let n = t === 3 ? Nt.slice(4) : Nt.slice(0, 4);
	return n[e.int(n.length)];
}
//#endregion
//#region src/terrain/mapgen.ts
var Ft = 937, It = [
	40,
	25,
	20,
	14,
	10
], Lt = 21, Rt = 31 * e, zt = 33 * e, Bt = [
	[40, 60],
	[40, 70],
	[40, 60],
	[50, 80],
	[60, 100]
], Vt = [
	[120, 260],
	[80, 200],
	[80, 200],
	[50, 140],
	[40, 120]
], Ht = (e) => e * e * (3 - 2 * e);
function Ut(e, t) {
	if (t <= e.a || t >= e.b) return 0;
	let n = t < e.crest ? (t - e.a) / (e.crest - e.a) : (e.b - t) / (e.b - e.crest);
	return e.h * Ht(n);
}
var Wt = (e, t) => 1.5 * e / Math.tan(t);
function B(e, t, n) {
	return t + (n - t) * e.next();
}
function Gt(e, t, n, r, i, a, o, s = .4) {
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
var Kt = [20, 100], qt = .1;
function Jt(e, t, n) {
	let r = It[n - 1], i = t + 100, a = t + 300, o = 2 * r + 40 + (n === 5 ? 65 : 0), s = Math.max(0, a - i - o - Kt[0]), c = 2 + e.int(2), l = n === 3 || n === 5 ? i + s - B(e, 0, Math.min(20, s)) : i + B(e, 0, Math.min(40, s)), u = [l];
	for (; u.length < c;) {
		if (l += o + B(e, Kt[0], Kt[1]), l > a) {
			if (u.length >= 2) break;
			l = a;
		}
		u.push(l);
	}
	return u.map((e) => Math.round(e / 2) * 2);
}
function Yt(e, t) {
	let n = Math.round(t / 2) * 2, r = N(e, n), i = new Float32Array(Lt);
	for (let t = 0; t < Lt; t++) i[t] = N(e, n - 20 + t * 2) - r;
	return i;
}
function Xt(e) {
	let { seed: t, tier: n } = e;
	if (e.startPatch && e.startPatch.length !== Lt) throw Error(`generateMap: startPatch needs ${Lt} samples`);
	let r = A(t).fork(Ft), i = r.fork(1), a = r.fork(2), o = r.fork(3), s = r.fork(4), c = r.fork(5), l = i.next() < .5 ? 1 : -1, u = It[n - 1], d = Jt(i, 400, n), f = d.map((e) => ({
		x: e,
		halfWidth: u,
		label: Pt(c, n)
	})), p = B(i, 0, 2 * Math.PI), m = B(i, 0, 2 * Math.PI), h = B(i, 0, 2 * Math.PI), g = (e) => 6 * Math.sin(2 * Math.PI * e / 3e3 + p), _ = (e) => .3 * Math.sin(2 * Math.PI * e / 37 + m) + .1 * Math.sin(2 * Math.PI * e / 13 + h), v = {
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
	})], x = [], [ee, S] = Bt[n - 1];
	if (n === 3) {
		let e = b[0].to, t = b[1].from, n = B(a, 60, 90), r = Wt(n, zt), i = Gt(e, t, n, r, r * B(a, 1.2, 1.6), 1, "hi", qt);
		i && (x.push(i), b.push({
			from: i.a,
			to: i.b
		}));
	}
	if (n === 5) {
		let e = b[1];
		for (let t of [-1, 1]) {
			let n = B(a, ee, S), r = Wt(n, Rt), i = Gt(t < 0 ? Math.max(...b.filter((t) => t.to <= e.from).map((e) => e.to), -200) : e.to, t < 0 ? e.from : Math.min(...b.filter((t) => t.from >= e.to).map((e) => e.from), D + 200), n, r, r * B(a, 1, 1.2), t < 0 ? 1 : -1, t < 0 ? "hi" : "lo", qt);
			i && (x.push(i), b.push({
				from: i.a,
				to: i.b
			}));
		}
	}
	let [C, te] = Vt[n - 1], ne = y[y.length - 1].from, re = [...b].sort((e, t) => e.from - t.from), ie = [], w = -100;
	for (let e of re) e.from > w && ie.push({
		from: w,
		to: e.from
	}), w = Math.max(w, e.to);
	ie.push({
		from: w,
		to: D + 100
	});
	for (let e of ie) {
		let t = e.from >= 400 && e.to <= ne, n = e.from;
		for (let r = 0; r < 50; r++) {
			let i = e.to, o = B(a, ee, S), s = Wt(o, Rt), c = t && r === 0, u = Gt(n, i, o, s, s * B(a, 1.4, 2.2), l, "lo", c ? 0 : .4);
			if (!u || (c ? u.h < 4 : u.h < .45 * o)) break;
			x.push(u), n = u.b + B(a, C, te);
		}
	}
	let T = new Float64Array(O);
	for (let e = 0; e < O; e++) {
		let t = e * 2, n = g(t) + _(t);
		for (let e of x) n += Ut(e, t);
		T[e] = n;
	}
	let se = (e, t) => {
		for (let n = 0; n < O; n++) {
			let r = n * 2, i = Math.max(e.from - r, r - e.to, 0);
			if (i >= 10) continue;
			let a = i <= 0 ? 1 : .5 * (1 + Math.cos(Math.PI * i / 10));
			T[n] = T[n] * (1 - a) + t(r) * a;
		}
	};
	for (let e of y) {
		let t = g((e.from + e.to) / 2);
		se(e, (e) => t + .1 * _(e));
	}
	let ce = g(400);
	if (e.startPatch) {
		let t = e.startPatch;
		se({
			from: 380,
			to: 420
		}, (e) => {
			let n = Math.min(Lt - 1, Math.max(0, Math.round((e - 380) / 2)));
			return ce + t[n];
		});
	} else se(v, (e) => ce + .1 * _(e));
	let E = Float32Array.from(T), le = B(o, 300, 800), ue = B(o, 300, 800), k = B(o, 0, 2 * Math.PI), de = B(o, 0, 2 * Math.PI), fe = new Float64Array(O);
	for (let e = 0; e < O; e++) fe[e] = Math.min(1.2, Math.max(0, (E[e] - g(e * 2)) / 100));
	let pe = new Float32Array(O);
	for (let e = 0; e < O; e++) {
		let t = 0, n = 0;
		for (let r = Math.max(0, e - 15); r <= Math.min(O - 1, e + 15); r++) t += fe[r], n++;
		let r = e * 2, i = 1 + .18 * Math.sin(2 * Math.PI * r / le + k) + .1 * Math.sin(2 * Math.PI * r / ue + de) + .35 * (t / n - .2);
		pe[e] = Math.min(oe, Math.max(ae, i));
	}
	let me = [{
		from: v.from - 4,
		to: v.to + 4
	}, ...y];
	return {
		seed: t,
		tier: n,
		heights: E,
		fSite: pe,
		windDir: l,
		baseHazards: At({ heights: E }, n, me, y, s),
		startX: 400,
		targets: f
	};
}
var Zt = [
	"calm",
	"breezy",
	"strong",
	"beyond predicted"
];
function Qt(e, t) {
	return Math.min(3, e + Math.max(0, t - 1));
}
function $t(e, t, n) {
	if (!Number.isInteger(n) || n < 1 || n > 5) throw Error(`hopPlan: hop must be 1..5, got ${n}`);
	return {
		hop: n,
		level: Qt(t, n),
		tier: n,
		mapSeed: Se(e, n),
		midHopEvent: n >= 4
	};
}
function en(e, t = 1) {
	return {
		seed: e >>> 0,
		baseLevel: t,
		results: Array.from({ length: 5 }, () => null)
	};
}
var tn = {
	1: "wide interdune target",
	2: "narrower interdune",
	3: "crater-rim relief",
	4: "narrow corridor, more ice blocks",
	5: "slipface-flanked target"
};
function nn(e) {
	return e === 3 ? `${Zt[3]} (beyond Titan's predicted near-surface winds)` : Zt[e];
}
function rn(e, t) {
	return Se(e, 1e3 + t);
}
function an(e, t) {
	if (!$t(e, 0, t).midHopEvent) return null;
	let n = A(Se(e, 2e3 + t)), r = Math.round((20 + n.next() * 35) / i), a = n.int(4), o = n.int(2);
	return {
		step: r,
		event: a === 0 ? {
			kind: "weakRotor",
			station: o
		} : a === 1 ? { kind: "gustFront" } : a === 2 ? { kind: "lidarDropout" } : { kind: "hazard" }
	};
}
function on(e, t, n, r) {
	let i = t.hop ?? n ?? 1, a = n === null || i === 1 && t.seed === void 0 || t.seed !== void 0 && t.seed >>> 0 !== e.seed, o = t.level !== void 0, s = o && (i === 1 || a) ? Math.max(0, t.level - (i - 1)) : e.baseLevel, c = a ? en(t.seed ?? r(), s) : s === e.baseLevel ? e : {
		...e,
		baseLevel: s
	}, l = a && o ? {
		...$t(c.seed, c.baseLevel, i),
		level: t.level
	} : $t(c.seed, c.baseLevel, i), u = an(c.seed, i);
	return {
		chain: c,
		plan: l,
		worldSeed: rn(c.seed, i),
		events: u ? [u] : []
	};
}
function sn(e) {
	return e.results.filter((e) => e?.safe).length;
}
//#endregion
//#region src/world/start.ts
function V(e, t, n) {
	return t + (n - t) * e.next();
}
function cn(e, t, n) {
	let r = -Infinity;
	for (let i = Math.min(t, n); i <= Math.max(t, n); i += 4) r = Math.max(r, N(e, i));
	return r;
}
function ln(e, t = e.targets[0].x) {
	return {
		kind: "ground",
		start: ut(e, e.startX),
		onGround: !0,
		targetX: t,
		energy: C,
		s: [0, 0]
	};
}
function un(t, n, r, i) {
	let a = i - t.startX, o = (e) => Math.max(0, Math.min(e, a - 30)), s, c, l, u, d;
	r === "transit" ? (s = t.startX + V(n, 30, Math.max(40, a - 60)), c = V(n, 15, 50), l = V(n, 0, 5), u = V(n, -1, 1), d = V(n, .4, .95) * C) : r === "scout" ? (s = i + V(n, -o(120), 60), c = V(n, 15, 60), l = V(n, -1.5, 3), u = V(n, -1, 1), d = V(n, .3, .8) * C) : (s = i + V(n, -o(25), 25), c = V(n, 4, 40), l = V(n, -1, 1), u = V(n, -2, .5), d = V(n, .2, .7) * C);
	let f = cn(t, s - 50, s + 50);
	return {
		kind: r,
		start: {
			x: s,
			y: f + c,
			vx: l,
			vy: u,
			theta: V(n, -8, 8) * e,
			omega: V(n, -3, 3) * e
		},
		onGround: !1,
		targetX: i,
		energy: d,
		s: He()
	};
}
//#endregion
//#region src/world/targets.ts
function dn(e, t = 0) {
	return [P(e - d - 1 - t), P(e - d + 1 + t)];
}
function fn(e, t) {
	let [n, r] = dn(e);
	for (let e = n; e <= r; e++) if (e >= 0 && e < 1e3 && t[e] === 2) return !0;
	return !1;
}
function pn(e, t, n) {
	let [r, i] = dn(e, 4);
	if (r < 0 || i >= 1e3) return !1;
	for (let e = r; e <= i; e++) if (t[e] !== 1) return !1;
	return Re(n, e - d - 1, e - d + 1) <= be;
}
function mn(e, t) {
	let n = null;
	for (let r of e.targets) {
		if (fn(r.x, t)) continue;
		let i = Math.abs(r.x - e.startX);
		(!n || r.halfWidth > n.w || r.halfWidth === n.w && i < n.d) && (n = {
			x: r.x,
			w: r.halfWidth,
			d: i
		});
	}
	return n ? n.x : e.targets[0].x;
}
function hn(e, t, n, r) {
	return r ? void 0 : {
		x: t.x,
		clearance: L(t, e),
		energyEst: n
	};
}
function gn(e, n, r) {
	return pe + xe * 2 * F(875 * t / 2) * (Math.abs(r - e) / 6 + Math.max(0, n - 10) / 3 + 10);
}
function _n(e, t, n) {
	let r = Math.round(n / 4) * 4;
	for (let n = 0; n <= 250; n += 4) {
		if (pn(r - n, t, e)) return r - n;
		if (n > 0 && pn(r + n, t, e)) return r + n;
	}
	return null;
}
function vn(e, t, n, r) {
	if (r && r.energyEst < gn(r.x, r.clearance, n)) {
		let n = _n(e, t, r.x);
		if (n !== null) return n;
	}
	if (!fn(n, t)) return n;
	for (let r = 4; r <= 60; r += 4) {
		if (pn(n - r, t, e)) return n - r;
		if (pn(n + r, t, e)) return n + r;
	}
	let i = e.targets.filter((e) => Math.abs(e.x - n) > 60 && !fn(e.x, t)).sort((e, t) => Math.abs(e.x - n) - Math.abs(t.x - n));
	return i.length > 0 ? i[0].x : n;
}
function yn(e, t) {
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
function bn(e, t) {
	let n = (t) => t < e.records.length ? e.records[Math.max(0, t)].state : e.state, r = Math.max(0, Math.min(Math.floor(t), e.step)), i = Math.min(r + 1, e.step), a = n(r), o = n(i), s = Math.min(1, Math.max(0, t - r)), c = z(a, o, s), l = (e, t) => e + (t - e) * s;
	return {
		...c,
		sF: l(a.sF, o.sF),
		sR: l(a.sR, o.sR),
		energyEst: l(a.energyEst, o.energyEst)
	};
}
function xn(e, t, n) {
	let r = t.downlinkStep(n), i = e.records;
	return Array.from({ length: 20 }, (e, a) => {
		let o = r + a;
		return o < n && o < i.length ? i[o].cmd : t.arriving(o);
	});
}
var Sn = 1, Cn = 2, wn = 3;
function Tn(e, t, n) {
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
var En = class {
	map;
	level;
	seed;
	stopAtContact;
	step = 0;
	state;
	faults = ke();
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
		this.state = qe(t, {
			energy: e.energy,
			s: e.s
		}), this.armed = !e.onGround && L(t, e.map) >= 1;
		let n = A(e.seed);
		this.rng = n.fork(Sn), this.gusts = new mt(e.level, n.fork(Cn)), this.eventRng = n.fork(wn), this.pending = [...e.events ?? []].sort((e, t) => e.step - t.step), this.hazardFrom = new Int32Array(k).fill(-1);
		for (let t = 0; t < k; t++) e.map.baseHazards[t] && (this.hazardFrom[t] = 0);
		this.revealedAt = new Int32Array(k).fill(-1), this.scan();
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
		let t = j(e);
		this.records.push({
			state: this.state,
			cmd: t,
			faultBits: Ae(this.faults, this.step),
			targetX: this.targetX,
			onGround: this.onGround
		}), this.gusts.step(i);
		let n = {
			faults: this.faults,
			windAt: (e, t) => this.windAt(e, t),
			energyLocked: this.energyLocked
		}, r, a = 0;
		if (this.onGround) {
			let e = et(this.state, t, n, this.rng);
			r = e.states, e.liftOff >= 0 ? (this.onGround = !1, a = e.liftOff) : a = r.length;
		} else r = $e(this.state, t, n, this.rng);
		let o = r[r.length - 1];
		if (!this.onGround && a < r.length) {
			let e = a === 0 ? this.state : r[a - 1], t = R(e, this.map);
			for (let n = a; n < r.length; n++) {
				let i = r[n], a = R(i, this.map);
				if (a < 0 && (this.armed || i.vy <= 0)) {
					let s = ct(t, a), c = Tn(e, i, s);
					if (!this.armed && !ot(c, this.map) && (this.armed = !0), this.armed) this.contact === null && !this.groundless && (this.contact = st(c, this.map, (e) => this.hazardTrue(e)), this.contactStep = this.step, this.contactAlpha = (n + s) / r.length, this.stopAtContact ? o = c : this.groundless = !0);
					else {
						let e = ut(this.map, i.x);
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
			let n = this.eventRng.next() < .5 ? -1 : 1, r = (T[0] + (T[1] - T[0]) * this.eventRng.next()) * Math.max(re[this.level], 1), i = 5 + 7 * this.eventRng.next(), a = e.du ?? n * r, o = e.steps ?? Math.round(i / .1);
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
			let { from: e, to: t } = jt(this.map, this.targetX, this.eventRng);
			for (let n = Math.max(0, e); n <= Math.min(k - 1, t); n++) this.hazardFrom[n] < 0 && (this.hazardFrom[n] = this.step);
		}
		this.eventLog.push({
			step: this.step,
			event: t
		});
	}
	knowledge() {
		return Et(this.revealedAt, this.hazardFrom, this.step);
	}
	hazardTrue(e) {
		if (e < 0 || e >= 1e3) return !0;
		let t = this.hazardFrom[e];
		return t >= 0 && t <= this.step;
	}
	setTarget(e) {
		this.targetX = Math.min(D, Math.max(0, e));
	}
	windAt(e, t) {
		let [n, r] = pt(this.map, this.level, e, t), i = dt(t - N(this.map, e)), a = Math.min(1, i);
		return [n + (this.step < this.faults.gustFrontUntil ? this.faults.gustFrontDu * i : 0) + this.gusts.u * a, r + this.gusts.w * a];
	}
	gust() {
		return {
			u: this.gusts.u,
			w: this.gusts.w
		};
	}
	scan() {
		if (!(this.step < this.faults.lidarUntil)) for (let e of Tt(this.state, this.map)) this.revealedAt[e] < 0 && (this.revealedAt[e] = this.step);
	}
};
//#endregion
//#region src/ui/camera.ts
function Dn(e) {
	return Math.min(400, Math.max(30, _e * Math.max(0, e) + 20));
}
function On(e, t) {
	return 1 - Math.exp(-Math.max(0, e) / t);
}
var kn = .6, An = .25, jn = class e {
	cx = 400;
	cy = 0;
	width = 400;
	primed = !1;
	visibleHeight(e) {
		return this.width * e;
	}
	static target(e, t, n, r) {
		let i = n * r, a = t + .4 * i, o = e.y - .35 * i;
		return {
			cx: e.x,
			cy: Math.max(a, o)
		};
	}
	update(t, n, r, i) {
		let a = Dn(t.y - n);
		if (!this.primed) {
			this.width = a;
			let r = e.target(t, n, this.width, i);
			this.cx = r.cx, this.cy = r.cy, this.primed = !0;
			return;
		}
		this.width += (a - this.width) * On(r, kn);
		let o = e.target(t, n, this.width, i), s = On(r, An);
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
}, Mn = /* @__PURE__ */ new Set([
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
function Nn(e) {
	return Mn.has(e);
}
function Pn(e, t) {
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
function Fn(e, t) {
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
var In = (t) => Number((t / e).toFixed(1));
function Ln(t) {
	let n = t.margins, r = t.pose, i = ue - n.slope;
	return [
		{
			label: "Vertical speed",
			value: `${Math.abs(r.vy).toFixed(2)} m/s`,
			limit: `${se} m/s`,
			ok: n.vy >= 0
		},
		{
			label: "Horizontal speed",
			value: `${Math.abs(r.vx).toFixed(2)} m/s`,
			limit: `${ce} m/s`,
			ok: n.vx >= 0
		},
		{
			label: "Tilt",
			value: `${(Math.abs(r.theta) / e).toFixed(1)}°`,
			limit: `${In(E)}°`,
			ok: n.theta >= 0
		},
		{
			label: "Spin rate",
			value: `${(Math.abs(r.omega) / e).toFixed(1)}°/s`,
			limit: `${In(le)}°/s`,
			ok: n.omega >= 0
		},
		{
			label: "Ground slope",
			value: `${(i / e).toFixed(1)}°`,
			limit: `${In(ue)}°`,
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
function Rn(e) {
	return `Energy used: ${(e / 1e3).toFixed(0)} kJ, ${Math.round(100 * e / C)}% of the hop budget (game-scaled; Dragonfly recharges from its RTG between flights)`;
}
function zn(e, t, n) {
	let r = e.ownerDocument;
	e.replaceChildren();
	let i = t.contact, a = r.createElement("h2");
	a.textContent = i.safe ? "Landed safely" : "Crashed", a.className = i.safe ? "ok" : "bad";
	let o = r.createElement("p");
	o.textContent = `Hop ${t.hop} of 5 · ${Zt[t.level]}`;
	let s = r.createElement("table");
	for (let e of Ln(i)) {
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
	c.textContent = Rn(t.energyUsedJ);
	let l = r.createElement("div");
	l.className = "endcard-buttons";
	let u = (e, t, n = !0) => {
		let i = r.createElement("button");
		return i.type = "button", i.textContent = e, i.disabled = !n, i.addEventListener("click", t), i;
	};
	l.append(u("Fly again", n.again), ...i.safe && t.hop < 5 ? [u("Next hop", n.next)] : [], u("Save recording", n.save)), e.append(a, o, s, c, l), e.hidden = !1;
}
function Bn(e) {
	e.hidden = !0, e.replaceChildren();
}
//#endregion
//#region src/ui/faultBar.ts
var Vn = [
	{
		kind: "weakRotor",
		label: "Weak rotor",
		title: "One station's rotor pair drops to 60% thrust (Dragonfly's X8 layout tolerates a rotor failure)"
	},
	{
		kind: "gustFront",
		label: "Gust front",
		title: "A step in the mean wind for 5-12 s"
	},
	{
		kind: "lidarDropout",
		label: "Lidar dropout",
		title: "No terrain scanning for 8 s"
	},
	{
		kind: "hazard",
		label: "Hazard on target",
		title: "An ice-block field appears on the current target"
	}
];
function Hn(e, t, n) {
	let r = e.createElement("div");
	r.className = "fault-bar", r.setAttribute("role", "group"), r.setAttribute("aria-label", "Faults");
	let i = e.createElement("span");
	i.textContent = "Faults:", r.append(i);
	let a = Vn.map((i) => {
		let a = e.createElement("button");
		return a.type = "button", a.textContent = i.label, a.title = i.title, a.dataset.fault = i.kind, a.addEventListener("click", () => {
			t(i.kind === "weakRotor" ? {
				kind: "weakRotor",
				station: n()
			} : { kind: i.kind });
		}), r.append(a), a;
	});
	return {
		el: r,
		setEnabled(e) {
			for (let t of a) t.disabled = !e;
		}
	};
}
//#endregion
//#region src/ui/input.ts
function Un(e) {
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
function Wn() {
	return {
		up: !1,
		down: !1,
		left: !1,
		right: !1
	};
}
var Gn = class {
	keys = Wn();
	vector = vt;
	onFirstInput = null;
	cleanups = [];
	firstFired = !1;
	fireFirst() {
		this.firstFired || (this.firstFired = !0, this.onFirstInput?.());
	}
	releaseAll() {
		this.keys = Wn();
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
			let n = Un(t.key);
			n && (t.preventDefault(), !t.repeat && (this.keys[n] = !0, this.fireFirst()));
		}), t(e, "keyup", (e) => {
			let t = Un(e.key);
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
		this.vector = yt(e), this.fireFirst();
	}
	reset(e = vt) {
		this.keys = Wn(), this.vector = yt(e), this.firstFired = !1;
	}
	step(e) {
		return this.vector = bt(this.vector, this.keys, e), this.vector;
	}
}, Kn = (e, t = 1) => `${e >= 0 ? "+" : ""}${e.toFixed(t)}`;
function qn(t) {
	let n = t.display;
	return {
		hgt: `${Math.max(0, t.clearance).toFixed(1)} m`,
		vx: `${Kn(n.vx)} m/s`,
		vy: `${Kn(n.vy)} m/s`,
		tilt: `${Kn(n.theta / e)}°`,
		energy: `${Math.round(100 * n.energyEst / C)}% est.`,
		wind: `${Kn(t.meanU)} mean · ${Kn(t.liveU)} live m/s`,
		link: t.source === "onboard" ? "onboard, no delay" : t.age < 0 ? `${t.source}, ${(-t.age).toFixed(1)} s ahead` : `${t.source}, ${t.age.toFixed(1)} s old`,
		time: `${t.t.toFixed(1)} s`
	};
}
var Jn = [
	["hgt", "HGT"],
	["vx", "VX"],
	["vy", "VY"],
	["tilt", "TILT"],
	["energy", "ENERGY"],
	["wind", "WIND"],
	["link", "LINK"],
	["time", "T"]
], Yn = class {
	cells = /* @__PURE__ */ new Map();
	constructor(e) {
		let t = e.ownerDocument;
		e.replaceChildren();
		for (let [n, r] of Jn) {
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
}, Xn = .25, Zn = class {
	step;
	maxFrame;
	acc = 0;
	last = null;
	constructor(e = i, t = Xn) {
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
};
//#endregion
//#region src/ui/minimap.ts
function Qn(e, t, n, r, i, a, o, s, c) {
	let l = Infinity, u = -Infinity;
	for (let e = 0; e < O; e++) l = Math.min(l, r.heights[e]), u = Math.max(u, r.heights[e]);
	let d = Math.max(u, o.y), f = Math.max(1, d - l), p = (e) => e / D * t, m = (e) => n - 3 - (e - l) / f * (n - 8);
	e.clearRect(0, 0, t, n), e.fillStyle = "#2a190b", e.fillRect(0, 0, t, n), e.beginPath(), e.moveTo(0, n);
	for (let t = 0; t < O; t++) e.lineTo(p(t * 2), m(r.heights[t]));
	e.lineTo(t, n), e.closePath(), e.fillStyle = "#5a3a1d", e.fill();
	let h = Math.max(1, t / k);
	for (let t = 0; t < k; t++) e.fillStyle = i[t] === 0 ? "#6b4a2b" : i[t] === 2 ? "#dff4ff" : "#e0b47a", e.fillRect(p(t * 4), n - 3, h, 3);
	e.strokeStyle = "rgba(255,240,220,0.4)", e.lineWidth = 1, e.strokeRect(p(s), 1, Math.max(2, p(c) - p(s)), n - 2);
	for (let t of r.targets) e.fillStyle = Math.abs(t.x - a) < 1e-6 ? "#9dffb0" : "rgba(157,255,176,0.4)", e.fillRect(p(t.x) - 1, 0, 2, n);
	e.fillStyle = "#ffffff", e.beginPath(), e.arc(Math.min(t - 2, Math.max(2, p(o.x))), Math.max(3, m(o.y)), 3, 0, Math.PI * 2), e.fill();
}
//#endregion
//#region src/ui/recorder.ts
var $n = class {
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
function er(e) {
	let t = e.recordedAt.replace(/[:.]/g, "-"), n = e.outcome ? e.outcome.safe ? "safe" : "crash" : "open";
	return `flight-tier${e.tier}-${e.mapSeed}-${e.seed}-${n}-${t}.json`;
}
function tr(e) {
	let t = new Blob([JSON.stringify(e)], { type: "application/json" }), n = document.createElement("a");
	n.href = URL.createObjectURL(t), n.download = er(e), document.body.appendChild(n), n.click(), n.remove(), setTimeout(() => URL.revokeObjectURL(n.href), 1e3);
}
//#endregion
//#region src/ui/wrapText.ts
function nr(e, t, n) {
	let r = [], i = "";
	for (let a of e.split(/\s+/).filter(Boolean)) {
		let e = i ? `${i} ${a}` : a;
		i && n(e) > t ? (r.push(i), i = a) : i = e;
	}
	return i && r.push(i), r;
}
//#endregion
//#region src/ui/craft.ts
var H = {
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
function rr(e) {
	return .12 + .6 * Math.sqrt(Math.min(1, Math.max(0, e)));
}
var U = {
	body: "#e9dcc6",
	deck: "#b9a487",
	line: "#2a1c10",
	rotor: "rgba(255, 238, 210, A)",
	weak: "rgba(255, 120, 90, A)",
	rtg: "#9c7a52",
	com: "#1a120a",
	comFill: "#f5efe4",
	vector: "#7fe3ff"
};
function ir(e, t) {
	e.beginPath(), e.moveTo(t[0], t[1]), e.lineTo(t[2], t[3]), e.stroke();
}
function ar(e, t, n) {
	let r = Math.max(1, 14 / (a * n.scale)), i = 1.4 / (n.scale * r);
	e.save(), e.translate(t.x, t.y), e.scale(r, r), e.save(), e.rotate(t.theta), e.translate(-d, -f), e.lineWidth = i, e.strokeStyle = U.line, H.rotors.x.forEach((t, r) => {
		let i = r === 0 ? n.sF : n.sR;
		e.fillStyle = (n.weak?.[r] ?? !1 ? U.weak : U.rotor).replace("A", rr(i).toFixed(3));
		for (let n of [H.rotors.yLow, H.rotors.yHigh]) e.beginPath(), e.ellipse(t, n, H.rotors.half, .045 + .04 * Math.sqrt(Math.max(0, i)), 0, 0, Math.PI * 2), e.fill();
		e.fillStyle = U.line, e.fillRect(t - H.rotors.hub / 2, H.rotors.yLow - .08, H.rotors.hub, H.rotors.yHigh - H.rotors.yLow + .12);
	});
	for (let t of H.arms) ir(e, t);
	for (let t of H.skids.struts) ir(e, t);
	ir(e, H.skids.runner);
	let o = H.rtg;
	e.fillStyle = U.rtg, e.fillRect(o.x0, o.y0, o.x1 - o.x0, o.y1 - o.y0), e.strokeRect(o.x0, o.y0, o.x1 - o.x0, o.y1 - o.y0);
	for (let t = 1; t < o.fins; t++) {
		let n = o.x0 + (o.x1 - o.x0) * t / o.fins;
		ir(e, [
			n,
			o.y0 - .04,
			n,
			o.y1 + .04
		]);
	}
	let s = H.body;
	e.fillStyle = U.body, e.fillRect(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0), e.strokeRect(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0);
	let c = H.deck;
	e.fillStyle = U.deck, e.fillRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);
	let l = H.hga;
	ir(e, [
		l.mastX,
		l.mastY0,
		l.mastX,
		l.mastY1
	]), e.beginPath(), e.ellipse(l.mastX, l.cy, l.radius, l.depth, l.tilt, 0, Math.PI), e.stroke();
	let u = H.com;
	e.fillStyle = U.comFill, e.beginPath(), e.arc(u.x, u.y, u.r, 0, Math.PI * 2), e.fill(), e.stroke(), e.fillStyle = U.com;
	for (let t of [0, Math.PI]) e.beginPath(), e.moveTo(u.x, u.y), e.arc(u.x, u.y, u.r, t, t + Math.PI / 2), e.closePath(), e.fill();
	if (e.restore(), n.vector && (n.vector.tx !== 0 || n.vector.ty !== 0)) {
		let t = n.vector.tx * 4, r = n.vector.ty * 4, a = Math.hypot(t, r), o = t / a, s = r / a, c = Math.min(.6, .4 * a);
		e.strokeStyle = U.vector, e.fillStyle = U.vector, e.lineWidth = 2 * i, e.beginPath(), e.moveTo(0, 0), e.lineTo(t - o * c, r - s * c), e.stroke(), e.beginPath(), e.moveTo(t, r), e.lineTo(t - o * c - s * c * .5, r - s * c + o * c * .5), e.lineTo(t - o * c + s * c * .5, r - s * c - o * c * .5), e.closePath(), e.fill();
	}
	e.restore();
}
//#endregion
//#region src/ui/render.ts
var W = {
	skyTop: "#2b1a0c",
	skyHorizon: "#b86f2c",
	haze: "rgba(196, 128, 62, A)",
	ground: "#4a2f17",
	surfaceScanned: "#e0b47a",
	surfaceFog: "#7a5432",
	fog: "rgba(214, 150, 84, 0.18)",
	hazard: "#dff4ff",
	hazardEdge: "#4d7a96",
	target: "#9dffb0",
	targetDim: "rgba(157, 255, 176, 0.45)",
	text: "#f3d6ae",
	edge: "#a2774a"
};
function or(e, t, n, r, i) {
	let a = i.camera, o = a.scale(t);
	e.setTransform(r, 0, 0, r, 0, 0);
	let s = e.createLinearGradient(0, 0, 0, n);
	s.addColorStop(0, W.skyTop), s.addColorStop(1, W.skyHorizon), e.fillStyle = s, e.fillRect(0, 0, t, n), e.setTransform(r * o, 0, 0, -r * o, r * (t / 2 - a.cx * o), r * (n / 2 + a.cy * o));
	let c = a.cx - a.width / 2 - 2, l = a.cx + a.width / 2 + 2, u = a.cy - n / o;
	sr(e, i.map, c, l, u, o), cr(e, i, c, l, o), lr(e, i, o), i.streaks?.draw(e, i.field, o), ar(e, i.display, {
		sF: i.display.sF,
		sR: i.display.sR,
		weak: i.weak,
		vector: i.vector,
		scale: o
	}), ur(e, i.display.x, c, l, u, a.cy + n / o), e.setTransform(r, 0, 0, r, 0, 0), e.fillStyle = W.text, e.font = "11px ui-monospace, monospace";
	let d = nr(`terrain: ${Mt}`, t - 16, (t) => e.measureText(t).width);
	for (let t = 0; t < d.length; t++) e.fillText(d[d.length - 1 - t], 8, n - 8 - t * 14);
}
function sr(e, t, n, r, i, a) {
	let o = Math.max(0, Math.ceil(n / 2) * 2), s = Math.min(D, r);
	e.beginPath(), e.moveTo(n, i), e.lineTo(n, N(t, n));
	for (let n = o; n <= s; n += 2) e.lineTo(n, N(t, n));
	e.lineTo(r, N(t, r)), e.lineTo(r, i), e.closePath(), e.fillStyle = W.ground, e.fill(), e.strokeStyle = W.edge, e.lineWidth = 1 / a, e.setLineDash([4 / a, 4 / a]);
	for (let a of [0, D]) a < n || a > r || (e.beginPath(), e.moveTo(a, i), e.lineTo(a, N(t, a) + 2e3), e.stroke());
	e.setLineDash([]);
}
function cr(e, t, n, r, i) {
	let a = Math.max(0, P(n)), o = Math.min(k - 1, P(r)), s = 8 / i;
	for (let n = a; n <= o; n++) {
		let r = n * 4, a = r + 4, o = N(t.map, r), c = N(t.map, a), l = t.knowledge[n];
		if (e.strokeStyle = l === 0 ? W.surfaceFog : W.surfaceScanned, e.lineWidth = (l === 0 ? 1 : 2) / i, e.beginPath(), e.moveTo(r, o), e.lineTo(a, c), e.stroke(), l === 0) e.fillStyle = W.fog, e.beginPath(), e.moveTo(r, o), e.lineTo(a, c), e.lineTo(a, c + s), e.lineTo(r, o + s), e.closePath(), e.fill();
		else if (l === 2) {
			e.fillStyle = W.hazard, e.strokeStyle = W.hazardEdge, e.lineWidth = 1 / i;
			for (let i = 0; i < 2; i++) {
				let a = r + (.25 + .5 * i) * 4, o = .5 + .3 * ((n * 7 + i * 3) % 5 / 4);
				e.beginPath(), e.arc(a, N(t.map, a) + o * .7, o, 0, Math.PI * 2), e.fill(), e.stroke();
			}
		}
	}
}
function lr(e, t, n) {
	for (let r of t.map.targets) {
		let i = Math.abs(r.x - t.targetX) < 1e-6, a = N(t.map, r.x), o = 18 / n + 3;
		e.strokeStyle = i ? W.target : W.targetDim, e.fillStyle = i ? W.target : W.targetDim, e.lineWidth = 1.5 / n, e.beginPath(), e.moveTo(r.x, a), e.lineTo(r.x, a + o), e.stroke(), e.beginPath(), e.moveTo(r.x, a + o), e.lineTo(r.x + 10 / n + 1.5, a + o - 5 / n - .8), e.lineTo(r.x, a + o - 10 / n - 1.6), e.closePath(), e.fill(), i && (e.beginPath(), e.moveTo(r.x - 1, N(t.map, r.x - 1) + .5), e.lineTo(r.x - 1, N(t.map, r.x - 1)), e.lineTo(r.x + 1, N(t.map, r.x + 1)), e.lineTo(r.x + 1, N(t.map, r.x + 1) + .5), e.stroke()), e.save(), e.translate(r.x + 2 / n, a + o + 4 / n), e.scale(1 / n, -1 / n), e.font = "11px system-ui, sans-serif", e.fillText(`${r.label} (illustrative)`, 0, 0), e.restore();
	}
}
function ur(e, t, n, r, i, a) {
	for (let o of [-1, 1]) {
		let s = e.createLinearGradient(t + o * 100, 0, t + o * 400, 0);
		s.addColorStop(0, W.haze.replace("A", "0")), s.addColorStop(1, W.haze.replace("A", "0.85")), e.fillStyle = s;
		let c = o < 0 ? n : t + 100, l = o < 0 ? t - 100 : r;
		l > c && e.fillRect(c, i, l - c, a - i);
	}
}
//#endregion
//#region src/ui/rotorBars.ts
var dr = {
	you: "you: the command your vector makes now (hollow marker)",
	autopilot: "autopilot: its command now (hollow marker)",
	rotor: "rotor: actual thrust at the shown moment (solid; it lags)"
};
function fr(e, t, n, r) {
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
var pr = (e) => `${(100 * Math.min(1, Math.max(0, e))).toFixed(1)}%`, mr = class {
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
			r.fill.style.width = pr(t.rotor), r.marker.style.left = pr(t.cmd), r.weak.hidden = !t.weak;
			let i = `${e.cmdLabel} ${Math.round(100 * t.cmd)}% · rotor ${Math.round(100 * t.rotor)}%`;
			r.value.textContent !== i && (r.value.textContent = i);
		});
		let t = `${dr[e.cmdLabel]} · ${dr.rotor}`;
		this.legend.textContent !== t && (this.legend.textContent = t);
	}
}, hr = "\n.lander-app { --bg: #1a1009; --panel: #2a1a0e; --line: #5a3a20; --text: #f3e2c8; --dim: #c09a72; --ok: #9dffb0; --bad: #ff7a5c; --accent: #7fe3ff;\n  color-scheme: dark; background: var(--bg); color: var(--text); font: 14px/1.4 system-ui, sans-serif;\n  display: flex; flex-direction: column; gap: 8px; }\n.lander-app * { box-sizing: border-box; }\n.lander-app [hidden] { display: none !important; }\n.lander-app .topbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }\n.lander-app .topbar select, .lander-app .topbar button, .lander-app .endcard button, .lander-app .fault-bar button {\n  background: var(--panel); color: var(--text); border: 1px solid var(--line); border-radius: 6px; padding: 5px 10px; font: inherit; }\n.lander-app .topbar select { max-width: 100%; }\n.lander-app button:disabled, .lander-app input:disabled + span { opacity: 0.45; }\n.lander-app .seed { color: var(--dim); font-family: ui-monospace, monospace; }\n.lander-app .no-model { color: var(--dim); font-size: 13px; }\n.lander-app .stage { position: relative; }\n.lander-app .main-canvas { display: block; width: 100%; aspect-ratio: 16 / 9; border: 1px solid var(--line); border-radius: 8px; outline: none; touch-action: none; }\n.lander-app .main-canvas:focus { border-color: #b98a55; }\n.lander-app .minimap { display: block; width: 100%; height: 36px; border: 1px solid var(--line); border-radius: 6px; }\n.lander-app .fault-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }\n.lander-app .rotor-bars { display: grid; gap: 4px; font-family: ui-monospace, monospace; font-size: 13px; }\n.lander-app .rotor-row { display: grid; grid-template-columns: 48px 1fr auto auto; align-items: center; gap: 8px; }\n.lander-app .rotor-track { position: relative; height: 14px; background: var(--panel); border: 1px solid var(--line); border-radius: 4px; }\n.lander-app .rotor-fill { position: absolute; left: 0; top: 0; bottom: 0; background: #e0b47a; border-radius: 3px; }\n.lander-app .rotor-cmd { position: absolute; top: -3px; width: 10px; height: 18px; margin-left: -5px; border: 2px solid var(--accent); border-radius: 3px; background: transparent; }\n.lander-app .rotor-weak { color: var(--bad); }\n.lander-app .rotor-legend { color: var(--dim); font-size: 12px; }\n.lander-app .instruments { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 6px; }\n.lander-app .inst { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 6px 8px; display: flex; justify-content: space-between; gap: 6px; font-family: ui-monospace, monospace; }\n.lander-app .inst-label { color: var(--dim); }\n.lander-app .touch { display: flex; justify-content: center; }\n.lander-app .vector-pad { position: relative; width: 220px; height: 120px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); touch-action: none; }\n.lander-app .vector-pad-dot { position: absolute; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 50%; background: var(--accent); left: 50%; top: 100%; }\n@media (hover: hover) and (pointer: fine) { .lander-app .touch { display: none; } }\n.lander-app .status, .lander-app .help { color: var(--dim); font-size: 13px; }\n.lander-app .endcard { position: absolute; inset: 10% 20%; background: rgba(42, 26, 14, 0.95); border: 1px solid var(--line); border-radius: 10px; padding: 16px 20px; overflow: auto; }\n.lander-app .endcard h2 { margin: 0 0 8px; }\n.lander-app .endcard .ok { color: var(--ok); }\n.lander-app .endcard .bad { color: var(--bad); }\n.lander-app .endcard table { border-collapse: collapse; width: 100%; font-family: ui-monospace, monospace; font-size: 13px; }\n.lander-app .endcard td { padding: 3px 6px; border-bottom: 1px solid var(--line); }\n.lander-app .endcard-buttons { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }\n@media (max-width: 640px) { .lander-app .endcard { inset: 4%; } }\n.lander-app .control-toggle { display: flex; align-items: center; gap: 4px; }\n.lander-app .control-toggle button[aria-pressed=\"true\"] { border-color: var(--accent); background: #3a2a18; color: #fff; }\n.lander-app .display-note { margin: 6px 0 0; font-size: 13px; color: var(--muted, #cdb89a); max-width: 70ch; }\n";
//#endregion
//#region src/ui/vectorPad.ts
function gr(e, t, n, r) {
	return !(n > 0) || !(r > 0) ? vt : yt({
		tx: (e - n / 2) / (n / 2),
		ty: (r - t) / r
	});
}
function _r(e, t, n) {
	return [t / 2 + e.tx * (t / 2), n - e.ty * n];
}
var vr = class {
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
			this.onVector(gr(t.clientX - n.left, t.clientY - n.top, n.width, n.height));
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
		let t = this.el.getBoundingClientRect(), [n, r] = _r(e, t.width, t.height);
		this.dot.style.left = `${n}px`, this.dot.style.top = `${r}px`;
	}
	detach() {
		for (let e of this.cleanups.splice(0)) e();
		this.activePointer = null;
	}
}, yr = [2, 6], br = 1.5, xr = class {
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
			life: yr[0] + (yr[1] - yr[0]) * this.rng.next()
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
	draw(e, t, n, r = "rgba(255, 236, 200, A)") {
		e.lineWidth = 1.2 / n;
		for (let n of this.streaks) {
			let [i, a] = t(n.x, n.y), o = Math.hypot(i, a);
			if (o < .001) continue;
			let s = Math.min(1, n.age / .4, (n.life - n.age) / .4);
			e.strokeStyle = r.replace("A", (Math.max(0, s) * Math.min(.7, .2 + o / 6)).toFixed(3)), e.beginPath(), e.moveTo(n.x, n.y), e.lineTo(n.x - i * br, n.y - a * br), e.stroke();
		}
	}
}, Sr = "Dream model isn't loaded: flying on a simple physics predictor that ignores wind.";
function G(e, t, n, r) {
	let i = e.createElement(t);
	return n && (i.className = n), r !== void 0 && (i.textContent = r), i;
}
function Cr(e, t) {
	let n = new URL(e.assetBase, t).href, r = typeof window < "u" && typeof window.matchMedia == "function" ? window.matchMedia : null;
	return {
		...e,
		assetBase: n.endsWith("/") ? n : `${n}/`,
		reducedMotion: e.reducedMotion ?? (r ? r("(prefers-reduced-motion: reduce)").matches : !1),
		manageVisibility: e.manageVisibility ?? !0
	};
}
function wr(e, t) {
	return xn(e.world, e.link, t);
}
function Tr(e, t) {
	let n = e.world, r = e.link.downlinkStep(t), i = r < n.records.length ? n.records[r] : null, a = i ? {
		state: i.state,
		onGround: i.onGround
	} : {
		state: n.state,
		onGround: n.onGround
	}, o = i ? i.faultBits : Ae(n.faults, n.step), s = _t(n.map, a, o, r, wr(e, t)), c = s[Math.min(s.length - 1, t + 10 - r - 1)].state;
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
function Er(e, t) {
	let n = e.world;
	return e.mode === "autopilot" ? n.knowledge() : Et(n.revealedAt, n.hazardFrom, e.link.downlinkStep(t));
}
function Dr(e, t) {
	if (e.mode === "autopilot") return {
		pose: bn(e.world, t),
		source: "onboard",
		age: 0
	};
	let n = e.world;
	if (n.done && (e.ended || t - 10 >= n.step)) return {
		pose: bn(n, n.step),
		source: "downlink",
		age: 0
	};
	let r = Math.floor(t), a = t - r, o = Tr(e, r);
	if (a < 1e-9) return {
		pose: o,
		source: "fallback",
		age: -10 * i
	};
	let s = Tr(e, r + 1), c = z(o, s, a), l = (e, t) => e + (t - e) * a;
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
function Or(e, t) {
	return new kr(e, t);
}
var kr = class {
	doc;
	opts;
	features;
	ui;
	root;
	canvas;
	minimap;
	endcard;
	hopSelect;
	levelSelect;
	seedLabel;
	autoSave;
	status;
	noModel;
	instruments;
	rotorBars;
	faultBar;
	pad;
	input = new Gn();
	clock = new Zn();
	camera = new jn();
	streaks = new xr(A(87));
	listeners = new AbortController();
	reasons = /* @__PURE__ */ new Set();
	chainState = en(1);
	current = null;
	nextFlightId = 1;
	startToken = 0;
	startIssued = !1;
	mode = "manual";
	model = "absent";
	raf = null;
	lastFrame = null;
	frames = 0;
	focusedBeforeClick = !1;
	dead = !1;
	destroying = null;
	constructor(e, t) {
		this.doc = e.ownerDocument, this.opts = Cr(t, this.doc.baseURI), this.features = [...t.features ?? []];
		let n = this.doc, r = (e, t, n) => e.addEventListener(t, n, { signal: this.listeners.signal });
		this.root = G(n, "div", "lander-app"), this.root.dataset.landerApp = "";
		let i = G(n, "style");
		i.textContent = hr;
		let a = G(n, "div", "topbar");
		this.hopSelect = G(n, "select"), this.hopSelect.setAttribute("aria-label", "Hop");
		for (let e = 1; e <= 5; e++) {
			let t = G(n, "option", void 0, `Hop ${e}`);
			t.value = String(e), this.hopSelect.append(t);
		}
		this.levelSelect = G(n, "select"), this.levelSelect.setAttribute("aria-label", "Conditions"), Zt.forEach((e, t) => {
			let r = e[0].toUpperCase() + e.slice(1), i = G(n, "option", void 0, t === 3 ? `${r} (beyond Titan's predicted near-surface winds)` : r);
			i.value = String(t), this.levelSelect.append(i);
		}), this.levelSelect.value = "1";
		let o = Pn(n, (e) => this.setMode(e));
		o.setAutopilotAvailable(!1, "The autopilot needs the dream model.");
		let s = G(n, "label", "ghosts-toggle"), c = G(n, "input");
		c.type = "checkbox", c.disabled = !0, c.title = "Ghost futures need the dream model.", s.append(c, G(n, "span", void 0, " Ghosts"));
		let l = G(n, "button", void 0, "New flight");
		l.type = "button", this.seedLabel = G(n, "span", "seed"), this.autoSave = G(n, "input"), this.autoSave.type = "checkbox";
		let u = G(n, "label", "autosave");
		u.append(this.autoSave, n.createTextNode(" auto-save my flights")), a.append(G(n, "strong", void 0, "Titan rotorcraft"), this.hopSelect, o.el, this.levelSelect, s, l, this.seedLabel, u), this.noModel = G(n, "div", "no-model", Sr), this.noModel.dataset.landerNomodel = "";
		let d = G(n, "div", "stage");
		this.canvas = G(n, "canvas", "main-canvas"), this.canvas.tabIndex = 0, this.canvas.setAttribute("aria-label", "Rotorcraft view. Click to fly; Escape releases the keys."), this.endcard = G(n, "div", "endcard"), this.endcard.hidden = !0, d.append(this.canvas, this.endcard), this.faultBar = Hn(n, (e) => this.fault(e), () => this.current?.faultRng() ?? 0);
		let f = G(n, "div", "rotor-bars");
		this.rotorBars = new mr(f), this.minimap = G(n, "canvas", "minimap");
		let p = G(n, "div", "instruments");
		this.instruments = new Yn(p);
		let m = G(n, "div", "touch"), h = G(n, "div", "vector-pad");
		m.append(h), this.pad = new vr(h, (e) => this.input.setVector(e)), this.status = G(n, "div", "status");
		let g = G(n, "div", "help", "Click the view to fly. W/S or ↑/↓ lengthen or shorten the thrust vector, A/D or ←/→ lean it. Commands take 1 s to reach the craft and its state 1 s to come back (game-scaled; the real one-way delay is 67-92 minutes). Click near a flag to choose that target. Esc releases the keys.");
		this.root.append(i, a, this.noModel, d, this.faultBar.el, f, this.minimap, p, m, this.status, g), e.append(this.root), this.ui = {
			root: this.root,
			topBar: a,
			instruments: p,
			status: this.status,
			noModel: this.noModel,
			stage: d,
			canvas: this.canvas,
			endcard: this.endcard,
			faultBar: this.faultBar.el,
			rotorBars: f,
			controlToggle: o,
			ghostsToggle: c
		}, this.input.attach(this.canvas), this.input.onFirstInput = () => this.beginCurrent(), r(this.canvas, "focus", () => this.beginCurrent()), r(this.canvas, "pointerdown", () => {
			this.focusedBeforeClick = n.activeElement === this.canvas;
		}), r(this.canvas, "click", (e) => {
			let t = this.current;
			if (!this.focusedBeforeClick || !t || t.ended) return;
			let n = this.canvas.getBoundingClientRect(), r = this.camera.screenToWorldX(e.clientX - n.left, n.width), i = [...t.world.map.targets].sort((e, t) => Math.abs(e.x - r) - Math.abs(t.x - r))[0];
			i && Math.abs(i.x - r) < 60 && (t.pendingTarget = i.x);
		});
		let _ = (e, t) => void this.startFlight({
			hop: e,
			seed: t,
			start: "pad",
			mode: "manual",
			attract: !1
		});
		r(l, "click", () => _(1)), r(this.hopSelect, "change", () => _(Number(this.hopSelect.value), this.chainState.seed)), r(this.levelSelect, "change", () => {
			this.chainState = {
				...this.chainState,
				baseLevel: Number(this.levelSelect.value)
			}, _(this.current?.hop ?? 1, this.chainState.seed);
		}), this.opts.manageVisibility && r(n, "visibilitychange", () => n.hidden ? this.addReason("hidden") : this.removeReason("hidden")), this.setModelState("absent");
		let v = {
			startFlight: (e) => this.startFlight(e),
			setMode: (e) => this.setMode(e),
			flight: () => this.current,
			setModelState: (e) => this.setModelState(e),
			chain: () => this.chainState,
			opts: this.opts
		};
		for (let e of this.features) e.mount?.(this.ui, v);
		this.startIssued || this.startFlight({
			start: "pad",
			mode: "manual",
			attract: !1
		}), this.opts.manageVisibility && n.hidden && this.addReason("hidden"), this.schedule();
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
			worldStep: e ? e.world.step : 0
		};
	}
	destroy() {
		return this.destroying ? this.destroying : (this.dead = !0, this.raf !== null && cancelAnimationFrame(this.raf), this.raf = null, this.listeners.abort(), this.input.detach(), this.pad.detach(), this.current && (this.current.ended = !0), this.root.remove(), this.destroying = (async () => {
			for (let e of this.features) try {
				await e.destroy?.();
			} catch (e) {
				console.error("lander: a feature failed to destroy", e);
			}
		})(), this.destroying);
	}
	async startFlight(e, t = null) {
		if (this.dead) return;
		this.startIssued = !0;
		let n = ++this.startToken, r = on(this.chainState, e, this.current?.hop ?? null, () => Math.random() * 2 ** 32 >>> 0);
		this.chainState = r.chain;
		let i = r.plan.hop;
		if (await Promise.resolve(), this.dead || n !== this.startToken) return;
		let { plan: a, worldSeed: o, events: s } = r, c = a.level, l = Xt({
			seed: a.mapSeed,
			tier: a.tier,
			startPatch: t ?? void 0
		}), u = mn(l, new Uint8Array(k)), d = e.start === "air" ? un(l, A(o), "transit", u) : ln(l, u), f = new En({
			map: l,
			level: c,
			seed: o,
			start: d.start,
			onGround: d.onGround,
			targetX: d.targetX,
			energy: d.energy,
			s: d.s,
			events: s
		}), p = new ht();
		p.reset({
			front: 0,
			rear: 0
		}, 0), this.current && (this.current.ended = !0);
		let m = A(o).fork(250), h = {
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
			recorder: new $n({
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
		this.current = h, this.mode = e.mode, this.ui.controlToggle.set(e.mode), this.input.reset(), this.clock.reset(), this.camera.reset(), this.streaks = new xr(A(o).fork(87)), Bn(this.endcard), this.faultBar.setEnabled(!0), this.hopSelect.value = String(i), this.levelSelect.value = String(this.chainState.baseLevel), this.seedLabel.textContent = `seed ${this.chainState.seed}`, this.status.textContent = "Click the view to start.";
		for (let e of this.features) e.onFlightStart?.(h);
		(e.attract || e.mode === "autopilot") && this.begin(h);
	}
	setMode(e) {
		this.mode = e;
		let t = this.current;
		t && t.mode !== e && (t.mode = e, t.knowledge = Er(t, t.groundStep), this.ui.controlToggle.set(e), e === "manual" && (t.attract = !1), this.signal({
			type: "mode",
			flightId: t.flightId,
			mode: e
		}));
	}
	setModelState(e) {
		this.model = e, this.noModel.hidden = e !== "absent";
	}
	signal(e) {
		try {
			this.opts.onFlight?.(e);
		} catch (e) {
			console.error("lander: onFlight handler threw", e);
		}
	}
	beginCurrent() {
		this.current && this.begin(this.current);
	}
	begin(e) {
		this.dead || e.started || e.ended || (e.started = !0, this.clock.reset(), this.status.textContent = "", this.signal({
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
	display(e, t) {
		for (let n of this.features) {
			let r = n.displayPose?.(e, t);
			if (r) return r;
		}
		return Dr(e, t);
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
			let n = Ct(e.vector, this.display(e, e.groundStep).pose.theta);
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
			r ? (a = j(r), e.link.reset(a, t.step + 1)) : (e.link.send(n, t.step), a = e.link.arriving(t.step)), e.cmd = a, e.recorder.recordStep(t.step, a), t.advance(a), e.liveWind.push(t.windAt(t.state.x, t.state.y)[0]);
			for (let t of this.features) t.afterStep?.(e);
			this.recordTarget(e), t.done && (e.contactAt = t.step);
		}
		e.groundStep++, e.knowledge = Er(e, e.groundStep), t.done && e.groundStep >= e.contactAt + (e.mode === "manual" ? 10 : 0) ? this.end(e) : t.done && (this.status.textContent = "Touchdown awaiting confirmation…");
	}
	recordTarget(e) {
		let t = e.world;
		t.targetX !== e.recordedTarget && (e.recorder.recordTarget(t.step, t.targetX), e.recordedTarget = t.targetX);
	}
	end(e) {
		e.ended = !0, this.faultBar.setEnabled(!1);
		let t = e.world.contact;
		if (!t) return;
		this.status.textContent = "";
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
		if (r[e.hop - 1] = {
			safe: t.safe,
			energyUsed: n,
			landedX: t.pose.x
		}, this.chainState = {
			...this.chainState,
			results: r
		}, e.attract) return;
		let i = () => tr(e.recorder.finish(e.world));
		this.autoSave.checked && i(), zn(this.endcard, {
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
			}, Yt(e.world.map, t.pose.x)),
			save: i
		});
	}
	draw(e, t) {
		let n = window.devicePixelRatio || 1, r = this.canvas.getBoundingClientRect(), a = Math.max(1, r.width), o = Math.max(1, r.height);
		(this.canvas.width !== Math.round(a * n) || this.canvas.height !== Math.round(o * n)) && (this.canvas.width = Math.round(a * n), this.canvas.height = Math.round(o * n));
		let s = e.world, c = e.started && !e.ended ? this.clock.alpha() : 1, l = Math.max(0, e.groundStep - 1 + c), u = this.display(e, l), d = u.pose, f = N(s.map, d.x);
		this.camera.update(d, f, t, o / a);
		let p = (e, t) => s.windAt(e, t), m = {
			left: this.camera.cx - this.camera.width / 2,
			right: this.camera.cx + this.camera.width / 2,
			bottom: f - 5,
			top: this.camera.cy + this.camera.width * o / a / 2
		};
		this.opts.reducedMotion || this.streaks.update(t, p, m, (e) => N(s.map, e));
		let h = this.canvas.getContext("2d"), g = Math.max(0, Math.min(s.step, Math.round(l) - (e.mode === "autopilot" ? 0 : 10))), _ = g < s.records.length ? s.records[g].faultBits : Ae(s.faults, s.step);
		if (h) {
			or(h, a, o, n, {
				map: s.map,
				knowledge: e.knowledge,
				targetX: s.targetX,
				display: d,
				weak: [!!(_ & 1), !!(_ & 2)],
				vector: e.mode === "manual" ? e.vector : null,
				camera: this.camera,
				streaks: this.opts.reducedMotion ? null : this.streaks,
				field: p
			});
			let t = {
				flight: e,
				camera: this.camera,
				w: a,
				h: o,
				dpr: n,
				displayStep: l,
				display: u
			};
			for (let e of this.features) e.draw && (h.save(), h.setTransform(n, 0, 0, n, 0, 0), e.draw(h, t), h.restore());
		}
		let v = this.minimap.getBoundingClientRect(), y = Math.max(1, v.width), b = Math.max(1, v.height);
		this.minimap.width !== Math.round(y * n) && (this.minimap.width = Math.round(y * n)), this.minimap.height !== Math.round(b * n) && (this.minimap.height = Math.round(b * n));
		let x = this.minimap.getContext("2d");
		x && (x.setTransform(n, 0, 0, n, 0, 0), Qn(x, y, b, s.map, e.knowledge, s.targetX, d, this.camera.cx - this.camera.width / 2, this.camera.cx + this.camera.width / 2));
		let [ee] = pt(s.map, s.level, d.x, d.y), S = g > 0 ? e.liveWind[g - 1] : ee;
		this.instruments.update(qn({
			display: d,
			source: u.source,
			age: u.age,
			clearance: L(d, s.map),
			meanU: ee,
			liveU: S,
			t: l * i
		})), this.rotorBars.update(fr(e.mode === "manual" ? e.mixOut : e.cmd, d, e.mode, _)), this.pad.show(this.input.vector);
	}
}, Ar = /\b(iPhone|iPad|iPod)\b/, jr = /Chrom(e|ium)\//;
function Mr(e, t) {
	return Ar.test(e) || /Macintosh/.test(e) && t > 1 ? !0 : /AppleWebKit\//.test(e) ? !jr.test(e) : !1;
}
function Nr(e = globalThis.location?.search ?? "") {
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
async function Pr(e = Nr()) {
	if (Mr(e.ua, e.maxTouchPoints)) return "wasm";
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
function K(e) {
	throw Error(`dream_meta.json: ${e}`);
}
function q(e, t) {
	let n = e[t];
	return (typeof n != "number" || !Number.isFinite(n)) && K(`${t} must be a finite number`), n;
}
function Fr(e, t, n, r = !1) {
	(!Array.isArray(e) || e.length !== t) && K(`${n} must have length ${t}`);
	for (let t of e) (typeof t != "number" || !Number.isFinite(t)) && K(`${n} has a non-finite entry`), r && !(t > 0) && K(`${n} must be > 0`);
	return e;
}
function Ir(e, t, n, r, i = !1) {
	return (!Array.isArray(e) || e.length !== t) && K(`${r} must have ${t} rows`), e.map((e, t) => Fr(e, n, `${r}[${t}]`, i));
}
function Lr(e) {
	(typeof e != "object" || !e) && K("windGrid missing");
	let t = e, n = {
		nx: 16,
		dx: 4,
		dz: [...fe],
		scale: 4
	};
	for (let e of [
		"nx",
		"dx",
		"scale"
	]) q(t, e) !== n[e] && K(`windGrid.${e} is ${String(t[e])}, constants.ts says ${n[e]}`);
	let r = Fr(t.dz, n.dz.length, "windGrid.dz");
	return r.some((e, t) => e !== n.dz[t]) && K(`windGrid.dz is [${r.join(", ")}], constants.ts says [${n.dz.join(", ")}]`), n;
}
function Rr(e) {
	(typeof e != "object" || !e) && K("not an object");
	let t = e;
	t.version !== 1 && K(`unsupported version ${String(t.version)}`);
	for (let [e, n] of [
		["hist", 10],
		["fut", 30],
		["stateDim", 10],
		["actDim", 2],
		["statDim", 135],
		["ctxDim", 193]
	]) q(t, e) !== n && K(`${e} is ${String(t[e])}, constants.ts says ${n}`);
	let n = Lr(t.windGrid);
	q(t, "e0") !== 2e6 && K(`e0 is ${String(t.e0)}, constants.ts says ${C} (energyEst is scaled by it)`);
	let r = t.stepsDefault;
	r || K("stepsDefault missing");
	for (let e of [
		"ghost",
		"planner",
		"display"
	]) {
		let t = r[e];
		(!Number.isInteger(t) || t < 1) && K(`stepsDefault.${e} must be an integer >= 1`);
	}
	let i = q(t, "sigmaMin"), a = q(t, "sigmaMax");
	i > 0 && a > i || K("need 0 < sigmaMin < sigmaMax");
	let o;
	t.sigmaMinPlanner !== void 0 && (o = q(t, "sigmaMinPlanner"), o >= i && o < a || K("need sigmaMin <= sigmaMinPlanner < sigmaMax"));
	let s = t.skipS0 === void 0 ? void 0 : q(t, "skipS0"), c = t.trainedOn;
	return (!c || !Array.isArray(c.rounds)) && K("trainedOn.rounds missing"), {
		version: 1,
		hist: 10,
		fut: 30,
		stateDim: 10,
		actDim: 2,
		statDim: 135,
		ctxDim: 193,
		windGrid: n,
		e0: C,
		histMean: Fr(t.histMean, 10, "histMean"),
		histStd: Fr(t.histStd, 10, "histStd", !0),
		futMean: Ir(t.futMean, 30, 10, "futMean"),
		futStd: Ir(t.futStd, 30, 10, "futStd", !0),
		sigmaMin: i,
		sigmaMax: a,
		rho: q(t, "rho"),
		stepsDefault: {
			ghost: r.ghost,
			planner: r.planner,
			display: r.display
		},
		params: q(t, "params"),
		trainedOn: {
			rounds: c.rounds,
			windows: Number(c.windows ?? 0),
			gitSha: String(c.gitSha ?? "unknown")
		},
		...o === void 0 ? {} : { sigmaMinPlanner: o },
		...s === void 0 ? {} : { skipS0: s }
	};
}
function zr(e) {
	return (e.headers.get("content-type") ?? "").includes("text/html");
}
async function Br(e, t) {
	try {
		let n = await t(`${e}models/dream.onnx`, { method: "HEAD" });
		if (!n.ok || zr(n)) return {
			ok: !1,
			reason: "missing"
		};
		let r = await t(`${e}models/dream_meta.json`);
		return !r.ok || zr(r) ? {
			ok: !1,
			reason: "missing"
		} : {
			ok: !0,
			ghostSteps: Rr(await r.json()).stepsDefault.ghost
		};
	} catch {
		return {
			ok: !1,
			reason: "error"
		};
	}
}
var Vr = class {
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
		return this._fail = null, this._requested = t, this.set("loading"), this.loading = this.doLoad(r, e, t, n.wantValue ?? !1), this.loading;
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
	unload() {
		this.gen++;
		let e = this.detach();
		e && (e.postMessage({
			kind: "unload",
			id: this.nextId++
		}), e.terminate()), this._fail = null, this.set("unloaded");
	}
	async doLoad(e, t, n, r) {
		let i = await Br(t, this.deps.fetch);
		if (e !== this.gen) return null;
		if (!i.ok) return this.failWith(i.reason), null;
		let a;
		try {
			a = this.deps.createWorker();
		} catch {
			return this.failWith("error"), null;
		}
		this.worker = a, a.onmessage = (e) => this.onMessage(a, e.data), a.onerror = () => this.onWorkerError(a);
		let o = this.nextId++, s = new Promise((e) => {
			this.loadWaiter = {
				id: o,
				resolve: e
			};
		});
		a.postMessage({
			kind: "load",
			id: o,
			base: t,
			backend: n,
			wantValue: r
		}), this.map && this.postMap(a, this.map);
		let c = await s;
		return e === this.gen ? c.kind === "loaded" ? (this._info = {
			backend: c.backend,
			hasValue: c.hasValue,
			msPerSample: c.msPerSample,
			chainK: c.chainK,
			kManual: c.kManual,
			ghostSteps: i.ghostSteps
		}, this.set("ready"), this._info) : (this.failWith("error"), null) : (a.terminate(), null);
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
		if (this.inFlight || !this.pending || !this.worker) return;
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
		if (this.valueInFlight || !this.valuePending || !this.worker) return;
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
function Hr() {
	return {
		fetch: (e, t) => fetch(e, t),
		selectBackend: () => Pr()
	};
}
function Ur(e) {
	return e === "ready" ? "ready" : e === "failed" || e === "unloaded" ? "absent" : "loading";
}
function Wr(e, t = Hr()) {
	let n = /* @__PURE__ */ new Set(), r = new Vr({
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
				return o === i && await r.load(e, a, { wantValue: n.wantValue ?? !1 }) !== null;
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
var Gr = class {
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
function Kr() {
	let e = globalThis.matchMedia;
	return e ? e("(prefers-reduced-motion: reduce)").matches : !1;
}
function qr(e = {}) {
	let t = e.now ?? (() => performance.now() / 1e3), n = null, r = null, i = null, a = null, o = !1, s = null, c = !1, l = null, u = () => {
		let e = l?.flight();
		n?.phase === "attract" && e && !e.attract && !e.ended && n.takeControls();
	}, d = (e) => {
		n && Nn(e.key) && (n.inAttract ? n.takeControls() : n.onVisitorInput());
	};
	return {
		mount(t, s) {
			l = s, c = s.opts.reducedMotion ?? Kr(), n = new Gr({
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
			}), r = Fn(t.root.ownerDocument, () => n?.takeControls()), t.stage.append(r.el), i = t.canvas, i.addEventListener("keydown", d), typeof IntersectionObserver > "u" ? o = !0 : (a = new IntersectionObserver((e) => {
				o = e.some((e) => e.isIntersecting);
			}, { threshold: .3 }), a.observe(t.root));
		},
		onFlightStart(e) {
			e.attract || n?.onVisitorFlight();
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
			a?.disconnect(), i?.removeEventListener("keydown", d), r?.el.remove();
		}
	};
}
//#endregion
//#region src/ghosts/ghosts.ts
function Jr(e) {
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
function Yr(e, t) {
	return t >= e.step ? e.state : e.records[t].state;
}
function Xr(e, t) {
	return Et(e.revealedAt, e.hazardFrom, t);
}
function Zr(e, t) {
	return t < e.step ? e.records[t].faultBits : Ae(e.faults, e.step);
}
function Qr(e, t) {
	if (!e.armed) return !1;
	let n = Math.min(t, e.step);
	for (let t = 0; t <= n; t++) if (L(Yr(e, t), e.map) >= 1) return !0;
	return n >= e.step;
}
function $r(e, t, n, r) {
	if (t < 9 || t > e.step || t < 10 && !e.records[0]?.onGround) return null;
	let i = [];
	for (let n = t - 10 + 1; n <= t; n++) {
		let t = n === 0 ? null : e.records[n - 1].cmd;
		i.push({
			row: Jr(Yr(e, n)),
			cmd: t ? {
				front: t.front,
				rear: t.rear
			} : null
		});
	}
	return {
		step: t,
		hist: i,
		faultBits: Zr(e, t),
		level: e.level,
		targetX: e.targetX,
		knowledge: Xr(e, t),
		armed: Qr(e, t),
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
function ei(e, t) {
	return $r(e, e.step, [], t);
}
function ti(e, t) {
	let n = e.step, r = t.downlinkStep(n);
	if (r !== n - 10) return null;
	let i = xn(e, t, n);
	return $r(e, r, i, i[i.length - 1]);
}
function ni(e, t) {
	return (Math.imul(e ^ 2654435769, 2246822507) ^ Math.imul(t + 1, 3266489909)) >>> 0;
}
var ri = class {
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
		let r = ti(e, t);
		if (!r) return !1;
		this.lastStep = e.step;
		let i = {
			...r,
			flightId: this.flightId
		};
		return this.req.requestGhosts(i, this.cfg.n, this.cfg.steps, ni(this.seedBase, e.step), this.cfg.k), !0;
	}
	accept(e) {
		return e.flightId !== this.flightId || this.latest && e.anchorStep < this.latest.anchorStep ? !1 : (this.latest = e, !0);
	}
	get current() {
		return this.latest;
	}
}, ii = 31;
function ai(e) {
	return 1 + 30 * e;
}
function oi(e, t, n = ii) {
	return (e * n + t) * 9;
}
function J(e, t, n, r = ii) {
	let i = oi(t, n, r);
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
//#region src/ghosts/dreamIO.ts
var si = 31;
//#endregion
//#region src/planner/plan.ts
function ci(e, t, n) {
	return J(e, t, n, si);
}
function li(e) {
	let t = j(e);
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
		].fill(ve), [
			,
			,
			,
			,
			,
			,
		].fill(ve)]
	};
}
function ui(e) {
	return {
		mean: [e.mean[0].slice(), e.mean[1].slice()],
		std: [e.std[0].slice(), e.std[1].slice()]
	};
}
function di(e, t) {
	let n = Math.floor(t / 5);
	if (n >= 5) return e[5];
	if (n < 0) return e[0];
	let r = (t - n * 5) / 5;
	return e[n] + (e[n + 1] - e[n]) * r;
}
function fi(e, t) {
	let n = Math.max(0, Math.round(t)), r = (t) => {
		let r = [], i = [];
		for (let a = 0; a < 6; a++) {
			let o = a * 5 + n;
			r.push(di(e.mean[t], o)), i.push(o > 25 ? ve : Math.max(di(e.std[t], o), ye));
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
function pi(e, t, n) {
	return e === "webgpu" ? {
		pop: 32,
		iters: 3,
		elite: 4,
		samplesPerCandidate: 1,
		steps: n,
		ghosts: 16,
		chainK: Math.max(1, t)
	} : {
		pop: 16,
		iters: 2,
		elite: 4,
		samplesPerCandidate: 1,
		steps: n,
		ghosts: 8,
		chainK: 1
	};
}
function mi(e) {
	let n = 875 * t / (M(e, 0) + M(e, 1)), r = Math.floor(n / _ + 1e-9) * _;
	return j({
		front: r,
		rear: r
	});
}
//#endregion
//#region src/planner/executor.ts
var hi = class {
	full;
	fallback;
	plan = null;
	heldDist = null;
	pending = null;
	nextToken = 1;
	nextRequestStep = 0;
	streak = 0;
	lowered = !1;
	budget;
	rng;
	constructor(e, t, n) {
		this.full = e, this.fallback = t, this.budget = e, this.rng = A(n);
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
	get downgraded() {
		return this.lowered;
	}
	get activeBudget() {
		return this.budget;
	}
	get waiting() {
		return this.pending !== null;
	}
	newFlight() {
		this.stop(), this.lowered = !1, this.budget = this.full;
	}
	start(e, t) {
		let n = j(t);
		this.plan = {
			base: e,
			actions: Array.from({ length: 30 }, () => ({ ...n })),
			result: null
		}, this.heldDist = li(n), this.pending = null, this.nextRequestStep = e, this.streak = 0;
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
		t && !t.late && e >= t.step + 5 && (t.late = !0, this.streak += 1, this.streak >= 2 && !this.lowered && (this.lowered = !0, this.budget = this.fallback));
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
			late: !1
		}, this.nextRequestStep = e + 5, {
			token: t,
			step: e,
			warm: this.plan.result ? fi(this.plan.result.dist, e - this.plan.base) : ui(this.heldDist),
			budget: this.budget,
			seed: this.rng.int(2147483647)
		};
	}
	resolve(e, t, n) {
		let r = this.pending;
		return !r || r.token !== e ? "stale" : (this.pending = null, t ? (r.late || (this.streak = 0), n - r.step > 25 ? "expired" : (this.plan = {
			base: r.step,
			actions: t.actions,
			result: {
				...t,
				late: r.late
			}
		}, "adopted")) : "failed");
	}
}, gi = class {
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
	now;
	redesignation = null;
	constructor(e) {
		this.opts = e, this.exec = new hi(pi(e.backend, e.chainK, 0), pi("wasm", 1, 0), e.seed), this.now = e.now ?? (() => performance.now());
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
	command(e, t) {
		if (!this.track(e)) return null;
		let n = e.world;
		if (!this.exec.active) {
			let e = n.onGround ? mi(n.faults) : n.step === 0 ? Ve(n.faults) : n.records[n.step - 1].cmd;
			this.exec.start(n.step, e), this.last = j(e);
		}
		this.steer(n);
		let r = this.exec.command(n.step);
		return !this.paused && this.exec.due(n.step, n.step >= 9) && this.dispatch(e, n), this.last = j(r), this.flying = !0, r;
	}
	afterStep(e) {
		this.track(e);
	}
	end() {
		this.flying = !1, this.exec.stop();
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
		let t = vn(e.map, e.knowledge(), e.targetX, hn(e.map, e.state, e.state.energyEst, e.onGround));
		t !== e.targetX && (this.redesignation = {
			step: e.step,
			from: e.targetX,
			to: t
		}, e.setTarget(t)), e.targetX !== this.target && (this.exec.replanSoon(e.step), this.target = e.targetX);
	}
	track(e) {
		return (e.world !== this.world || e.flightId !== this.flightId) && (this.exec.newFlight(), this.world = e.world, this.flightId = e.flightId, this.flying = !1, this.target = e.world.targetX, this.redesignation = null), e.mode !== "autopilot" || e.ended || e.world.contact !== null ? (this.flying && e.mode === "manual" && !e.ended && e.world.contact === null && e.link.reset(this.last, e.world.step), this.flying = !1, this.exec.stop(), !1) : !0;
	}
	dispatch(e, t) {
		let n = ei(t, this.last);
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
}, _i = {
	rejected: .08,
	elite: .3,
	chosen: .85
}, vi = Array.from({ length: Math.floor(30 * i / 1) }, (e, t) => Math.round((t + 1) / i)).filter((e) => e < 30), yi = {
	rejected: 0,
	elite: 1,
	chosen: 2
};
function bi(e) {
	let t = (t) => t === e.chosen ? "chosen" : e.elite[t] ? "elite" : "rejected";
	return Array.from({ length: e.n }, (e, n) => ({
		index: n,
		tier: t(n),
		alpha: _i[t(n)]
	})).sort((e, t) => yi[e.tier] - yi[t.tier] || e.index - t.index);
}
function xi(e) {
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
var Si = (e) => Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.theta);
function Ci(e, t) {
	for (let n of bi(e)) {
		let r = e.touchIndex[n.index] >= 0 ? e.touchIndex[n.index] : 30, i = new Float32Array((r + 1) * 2), a = !0;
		for (let t = 0; t <= r; t++) {
			let r = ci(e.poses, n.index, t);
			if (!Si(r)) {
				a = !1;
				break;
			}
			i[2 * t] = r.x, i[2 * t + 1] = r.y;
		}
		if (!a) continue;
		t.path(i, n.alpha, n.tier);
		for (let i of vi) i < r && t.outline(xi(ci(e.poses, n.index, i)), n.alpha, n.tier);
		let o = e.contacts[n.index];
		t.outline(xi(o ? o.pose : ci(e.poses, n.index, r)), n.alpha, n.tier);
	}
}
//#endregion
//#region src/ui/autopilotFeature.ts
var wi = "Dream model not loaded", Ti = {
	takeoff: "Autopilot: taking off",
	transit: "Autopilot: transit at a safe height",
	scout: "Autopilot: scouting the landing site",
	approach: "Autopilot: approach",
	final: "Autopilot: final descent at 1 m/s"
};
function Ei(e) {
	if (e.advisoryS !== null) {
		let t = `${Math.ceil(e.advisoryS)} s`;
		if (e.mode === "autopilot" && e.redesignation) {
			let n = e.redesignation.to - e.redesignation.from;
			return `Hazard on the landing site. Autopilot redesignated ${Math.abs(n).toFixed(0)} m ${n < 0 ? "back" : "ahead"} (${t}).`;
		}
		return `Hazard detected on the landing site: pick another site (${t}).`;
	}
	return e.mode === "autopilot" && e.phase ? Ti[e.phase] : "";
}
var Di = {
	rejected: "255, 236, 210",
	elite: "255, 200, 140",
	chosen: "255, 255, 255"
};
function Oi(e, t) {
	let n = (e, n) => t.camera.toScreen(e, n, t.w, t.h), r = (t, r, i, a, o) => {
		e.save(), e.strokeStyle = `rgba(${Di[i]}, ${r})`, e.lineWidth = a, e.beginPath(), t.forEach(([t, r], i) => {
			let [a, o] = n(t, r);
			i === 0 ? e.moveTo(a, o) : e.lineTo(a, o);
		}), o && e.closePath(), e.stroke(), e.restore();
	};
	return {
		path(e, t, n) {
			if (e.length < 4) return;
			let i = [];
			for (let t = 0; t < e.length; t += 2) i.push([e[t], e[t + 1]]);
			r(i, t, n, n === "chosen" ? 1.5 : 1, !1);
		},
		outline(e, t, n) {
			r(e, t, n, 1, !0);
		}
	};
}
function ki(e) {
	globalThis.__landerPlan = { planStats: () => e.planStats() };
}
function Ai(e) {
	let t = null, n = null, r = null, i = null, a = null, o = !1;
	function s() {
		let n = e.session.state() === "ready" ? e.session.info() : null;
		if (!n) return t &&= (t.end(), null), r?.setAutopilotAvailable(!1, wi), null;
		if (!t) {
			let r = e.session.client;
			t = new gi({
				requester: { request: (e, t, n, i) => r.requestPlan(e, t, n, i) },
				backend: n.backend,
				chainK: n.chainK,
				seed: e.seed ?? (Date.now() >>> 0 || 1),
				onAdopt: e.onAdopt
			}), t.setPaused(o);
		}
		return r?.setAutopilotAvailable(!0, ""), t;
	}
	let c = (e) => {
		Nn(e.key) && n?.flight()?.mode === "autopilot" && n.setMode("manual");
	}, l = {
		get ready() {
			return s() !== null;
		},
		session: () => t,
		planStats: () => t?.planStats() ?? null,
		counted(e) {
			return e.mode === "autopilot" ? t?.display?.pLand ?? null : null;
		},
		mount(t, o) {
			n = o;
			let u = t.root.ownerDocument;
			r = t.controlToggle, a = u.createElement("div"), a.className = "autopilot-status", a.setAttribute("aria-live", "polite"), t.stage.append(a), i = t.canvas, i.addEventListener("keydown", c), s(), e.debugHook && ki(l);
		},
		onFlightStart(e) {
			r?.set(e.mode);
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
			if (l && (e.ghostsOn?.() ?? !0) && Ci(l, Oi(t, i)), a) {
				let e = c.ended ? null : yn(c.world.eventLog, c.world.step);
				a.textContent = Ei({
					mode: c.mode,
					phase: l?.phase ?? null,
					advisoryS: e ? e.remainingS : null,
					redesignation: o?.redesignation ?? null
				});
			}
		},
		destroy() {
			delete globalThis.__landerPlan, t?.end(), t = null, i?.removeEventListener("keydown", c), r?.setAutopilotAvailable(!1, wi), a?.remove();
		}
	};
	return l;
}
//#endregion
//#region src/ui/chainFeature.ts
function ji(e, t) {
	return e.results.map((n, r) => {
		let i = r + 1, a = $t(e.seed, e.baseLevel, i), o = t[r] ?? null;
		if (!n) return {
			hop: i,
			conditions: nn(a.level),
			map: tn[a.tier],
			outcome: "not flown",
			energy: "",
			gap: ""
		};
		let s = o && o.attempts > 1 ? ` (${o.attempts} tries)` : "";
		return {
			hop: i,
			conditions: nn(a.level),
			map: tn[a.tier],
			outcome: `${n.safe ? "landed" : "crashed"}${o ? `, ${o.mode}` : ""}${s}`,
			energy: `${Math.round(100 * n.energyUsed / C)}%`,
			gap: o?.gapM == null ? "" : `${o.gapM.toFixed(1)} m`
		};
	});
}
function Mi(e = {}) {
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
	function u(e, n, i) {
		let a = e.createElement("div");
		a.className = "chain-summary";
		let c = e.createElement("h3"), u = sn(n);
		c.textContent = `Chain: ${u} of 5 hops landed`;
		let d = e.createElement("table");
		for (let t of ji(n, o)) {
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
			d.append(n);
		}
		if (a.append(c, d, l(e, "New chain", () => {
			r && r.startFlight({
				hop: 1,
				seed: t(),
				level: n.baseLevel,
				start: "pad",
				mode: "manual",
				attract: !1
			});
		})), s !== n.seed) {
			s = n.seed;
			try {
				r?.opts.onFlight?.({
					type: "chain",
					flightId: i.flightId,
					landed: u
				});
			} catch (e) {
				console.error("lander: onFlight handler threw", e);
			}
		}
		return a;
	}
	function d(e, t) {
		if (!n || !r) return;
		let a = r.chain(), o = n.endcard.ownerDocument;
		c();
		let s = o.createElement("div");
		if (s.className = "chain-card", t && e.hop >= 5) s.append(u(o, a, e));
		else if (!t) s.append(l(o, "End chain", () => s.replaceChildren(u(o, r.chain(), e))));
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
			let r = o[t.hop - 1];
			r && (o[t.hop - 1] = {
				...r,
				mode: t.mode,
				gapM: e.gap?.()?.metres ?? null
			}), queueMicrotask(() => d(t, n.safe));
		},
		destroy() {
			c();
		}
	};
}
function Ni(e) {
	let t = e.touchdown ? Math.min(30, Math.max(1, Math.ceil(e.touchdown.at))) : 30, n = new Float32Array((t + 1) * 2);
	for (let r = 0; r <= t; r++) {
		let t = J(e.mean, 0, r, 31);
		n[2 * r] = t.x, n[2 * r + 1] = t.y;
	}
	return {
		xy: n,
		last: t
	};
}
var Pi = class {
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
			let t = ci(e.poses, e.chosen, r);
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
function Fi(e) {
	let t = e.records.map((e) => ({
		x: e.state.x,
		y: e.state.y
	}));
	return t.push({
		x: e.state.x,
		y: e.state.y
	}), t;
}
function Ii(e, t) {
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
function Li(e) {
	return `Largest dream-versus-reality gap: ${e.metres.toFixed(1)} m, ${(e.k / 10).toFixed(1)} s into the plan made at t = ${(e.base / 10).toFixed(1)} s`;
}
function Ri(e, t, n, r, i) {
	let a = Infinity, o = -Infinity, s = Infinity, c = -Infinity, l = (e, t) => {
		Number.isFinite(e) && Number.isFinite(t) && (a = Math.min(a, e), o = Math.max(o, e), s = Math.min(s, t), c = Math.max(c, t));
	};
	for (let e of t) l(e.x, e.y);
	for (let t of e) for (let e = 0; e <= t.last; e++) l(t.xy[2 * e], t.xy[2 * e + 1]);
	Number.isFinite(a) || (a = 0, o = 1, s = 0, c = 1);
	let u = Math.max(o - a, 1e-6), d = Math.max(c - s, 1e-6), f = Math.min((n - 2 * i) / u, (r - 2 * i) / d), p = (n - 2 * i - u * f) / 2, m = (r - 2 * i - d * f) / 2;
	return { toScreen: (e, t) => [i + p + (e - a) * f, r - i - m - (t - s) * f] };
}
function zi(e, t, n, r, i, a) {
	let o = Ri(r, i, t, n, 10);
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
function Bi(e, t, n) {
	if (t.length === 0) return [];
	let r = e.ownerDocument, i = r.defaultView?.devicePixelRatio ?? 1, a = r.createElement("canvas");
	a.className = "dvr-overlay", a.width = Math.round(320 * i), a.height = Math.round(160 * i), a.style.width = "320px", a.style.height = "160px", a.setAttribute("role", "img");
	let o = Ii(t, n);
	a.setAttribute("aria-label", o ? Li(o) : "Dream versus reality");
	let s = a.getContext("2d");
	s && (s.scale(i, i), zi(s, 320, 160, t, n, o));
	let c = r.createElement("p");
	return c.className = "dvr-caption", c.textContent = o ? Li(o) : "Dream versus reality", e.append(a, c), [a, c];
}
function Vi(e = {}) {
	let t = new Pi(), n = null, r = null, i = [], a = null, o = () => {
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
				let { xy: n, last: i } = Ni(e);
				t.recordPath(e.anchorStep, n, i);
			});
		},
		onTouchdown(e) {
			let r = t.predictions.slice(), s = Fi(e.world);
			if (a = Ii(r, s), e.attract || !n) return;
			let c = n.endcard;
			queueMicrotask(() => {
				o(), i = Bi(c, r, s);
			});
		},
		destroy() {
			o();
		}
	};
}
//#endregion
//#region src/ui/displayChrome.ts
var Hi = "The main craft is the dream's average prediction: where the craft will be in 1 s, when your newest command reaches it. The ghosts show the spread around it; the inset is the real downlink, 1 s old.", Y = {
	loading: "Dream prediction loading: showing the physics fallback (ignores wind)",
	stale: "Dream prediction stale: showing the physics fallback (ignores wind)",
	late: "Prediction late: carrying the last average forward",
	awaiting: "Touchdown predicted: awaiting confirmation",
	confirmed: "Touchdown confirmed by the downlink",
	handback: "Handing back: physics fallback until the dream's first prediction"
}, Ui = [
	"Weak front rotor",
	"Weak rear rotor",
	"Gust front",
	"Lidar dropout"
];
function Wi(e) {
	return Ui.filter((t, n) => e >> n & 1).map((e) => `${e}: reached the ground 1 s late, the prediction corrects`);
}
function Gi(e) {
	let t = e.root.ownerDocument.createElement("p");
	t.className = "display-note", t.dataset.landerDisplayNote = "", t.textContent = Hi, t.hidden = !0, e.stage.after(t);
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
var Ki = { painted: 0 };
function qi(e, t) {
	t.length !== 0 && (Ki.painted++, e.save(), e.font = "12px system-ui, sans-serif", e.textBaseline = "top", t.forEach((t, n) => {
		let r = 12 + n * 20;
		e.fillStyle = "rgba(24, 14, 6, 0.72)", e.fillRect(12, r - 3, 8 + 6.5 * t.length, 18), e.fillStyle = "rgba(255, 228, 190, 0.95)", e.fillText(t, 16, r);
	}), e.restore());
}
//#endregion
//#region src/ghosts/touch.ts
function Ji(e) {
	return Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.vx) && Number.isFinite(e.vy) && Number.isFinite(e.theta) && Number.isFinite(e.omega) && Number.isFinite(e.sF) && Number.isFinite(e.sR) && Number.isFinite(e.energyEst);
}
function Yi(e, t, n) {
	if (n) return 0;
	for (let n = 0; n < e.length; n++) {
		if (L(e[n], t) >= 1) return n;
		if (n === 0) continue;
		let r = R(e[n], t);
		if (r < 0 && e[n].vy <= 0 && !ot(z(e[n - 1], e[n], ct(R(e[n - 1], t), r)), t)) return n - 1;
	}
	return -1;
}
function Xi(e, t, n, r) {
	let i = Yi(e, t, r);
	if (i < 0) return null;
	let a = lt(e.slice(i), t, n);
	return a ? {
		...a,
		index: a.index + i
	} : null;
}
var Zi = 2.5, Qi = 35;
function $i(e, t, n, r) {
	let i = [];
	for (let t = 0; t < ii; t++) i.push(J(e, 0, t));
	if (!i.every(Ji)) return null;
	let a = Xi(i, t, (e) => e >= 0 && e < 1e3 && n[e] === 2, r);
	return a ? {
		at: a.index - 1 + a.alpha,
		contact: a.contact
	} : null;
}
function ea(e, t, n) {
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
function ta(e, t) {
	let n = Math.min(30, Math.max(0, t)), r = Math.min(29, Math.floor(n));
	return ea(J(e, 0, r), J(e, 0, r + 1), n - r);
}
function na(e, t) {
	if (t > Qi) return null;
	if (e.touchdown && t >= e.touchdown.at) return {
		pose: {
			...ta(e.mean, e.touchdown.at),
			...e.touchdown.contact.pose
		},
		u: t,
		extrapolated: !1,
		touchedDown: !0
	};
	let n, r = !1;
	if (t <= 30) n = ta(e.mean, t);
	else {
		let a = J(e.mean, 0, 30), o = J(e.mean, 0, 29), s = (t - 30) * i, c = (a.x - o.x) / i, l = (a.y - o.y) / i, u = I(a.theta - o.theta) / i;
		n = {
			...a,
			x: a.x + c * s,
			y: a.y + l * s,
			theta: a.theta + u * s
		}, r = !0;
	}
	return Ji(n) ? {
		pose: n,
		u: t,
		extrapolated: r,
		touchedDown: !1
	} : null;
}
var ra = class {
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
		let t = na(this.cur, e - this.cur.anchorStep);
		if (!t) return null;
		let n = (e - this.adoptedAt) / Zi;
		if (n >= 1) return t;
		let r = this.prev ? na(this.prev, e - this.prev.anchorStep)?.pose ?? this.from : this.from;
		return r ? {
			...t,
			pose: ea(r, t.pose, Math.max(0, n))
		} : t;
	}
}, ia = {
	neutral: "255, 236, 210",
	safe: "95, 211, 138",
	crash: "255, 90, 79"
}, aa = {
	path: .14,
	sprite: .32,
	marker: .9
}, oa = .4, sa = 2.5, X = s / 2, Z = 1 / 2, Q = Z + .2, ca = [
	[
		[-X, -Z],
		[X, -Z],
		[X, Z],
		[-X, Z],
		[-X, -Z]
	],
	[[c, Z], [c, Q]],
	[[c - l / 2, Q], [c + l / 2, Q]],
	[[-c, Z], [-c, Q]],
	[[-c - l / 2, Q], [-c + l / 2, Q]],
	[[-1, -Z], [-1, g]],
	[[1, -Z], [1, g]]
], la = { painted: 0 }, ua = (e, t) => `rgba(${e}, ${t})`;
function da(e, t, n) {
	let r = Math.cos(e.theta), i = Math.sin(e.theta), a = t - d, o = n - f;
	return [e.x + a * r - o * i, e.y + a * i + o * r];
}
function fa(e, t, n) {
	for (let r of ca) e.beginPath(), r.forEach(([r, i], a) => {
		let [o, s] = da(n, r, i), [c, l] = t.toScreen(o, s);
		a === 0 ? e.moveTo(c, l) : e.lineTo(c, l);
	}), e.stroke();
}
function pa(e, t, n, r = 1) {
	let i = 30 * r;
	if (!n) return i;
	let a = ai(r);
	for (let r = 1; r <= i; r++) {
		let i = J(e, t, r, a);
		if (Math.abs(i.x - n.pose.x) <= .001 && Math.abs(i.y - n.pose.y) <= .001) return r;
	}
	return i;
}
function ma(e, t) {
	let n = e.k, r = ai(n), i = Math.max(0, t - e.anchorStep);
	if (i > 30 * n) return null;
	let a = [];
	for (let t = 0; t < e.n; t++) {
		let o = e.contacts[t] ?? null, s = pa(e.poses, t, o, n), c = Math.min(i, s), l = Math.floor(c), u = Math.min(l + 1, s), d = ea(J(e.poses, t, l, r), J(e.poses, t, u, r), c - l);
		if (!Ji(d)) continue;
		let f = [d.x, d.y];
		for (let n = l + 1; n <= s; n++) {
			let i = J(e.poses, t, n, r);
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
function ha(e, t, n) {
	la.painted++, e.save(), e.lineWidth = 1, e.lineJoin = "round";
	for (let r of n.ghosts) {
		let n = r.contact ? r.contact.safe ? ia.safe : ia.crash : ia.neutral;
		if (r.path.length >= 4) {
			e.strokeStyle = ua(ia.neutral, aa.path), e.beginPath();
			let [n, i] = t.toScreen(r.path[0], r.path[1]);
			e.moveTo(n, i);
			for (let n = 2; n < r.path.length; n += 2) {
				let [i, a] = t.toScreen(r.path[n], r.path[n + 1]);
				e.lineTo(i, a);
			}
			e.stroke();
		}
		if (e.strokeStyle = ua(r.landed ? n : ia.neutral, aa.sprite), fa(e, t, r.pose), r.contact) {
			let [i, a] = at(r.contact.pose), o = i[1] <= a[1] ? i : a, [s, c] = t.toScreen(o[0], o[1]);
			e.fillStyle = ua(n, aa.marker), e.beginPath(), e.arc(s, c, Math.max(sa, oa * t.pxPerM), 0, 2 * Math.PI), e.fill();
		}
	}
	e.restore();
}
function ga(e, t, n) {
	return {
		toScreen: (r, i) => e.toScreen(r, i, t, n),
		pxPerM: e.scale(t)
	};
}
//#endregion
//#region src/ui/downlinkInset.ts
var $ = {
	w: 176,
	h: 112,
	margin: 12,
	spanM: 60
}, _a = { painted: 0 };
function va(e) {
	return {
		x: e - $.w - $.margin,
		y: $.margin,
		w: $.w,
		h: $.h
	};
}
function ya(e, t) {
	let n = e.w / $.spanM;
	return {
		toScreen: (r, i) => [e.x + e.w / 2 + (r - t.x) * n, e.y + e.h / 2 - (i - t.y) * n],
		pxPerM: n
	};
}
function ba(e) {
	return `Downlink · ${e.toFixed(1)} s old`;
}
function xa(e, t, n, r) {
	_a.painted++;
	let i = va(t), a = ya(i, r.pose);
	e.save(), e.fillStyle = "rgba(24, 14, 6, 0.78)", e.fillRect(i.x, i.y, i.w, i.h), e.beginPath(), e.rect(i.x, i.y, i.w, i.h), e.clip(), e.lineWidth = 1, e.strokeStyle = "rgba(214, 160, 96, 0.9)", e.beginPath();
	let o = r.pose.x - $.spanM / 2;
	for (let t = 0; t * 2 <= $.spanM; t++) {
		let r = o + t * 2, [i, s] = a.toScreen(r, N(n, r));
		t === 0 ? e.moveTo(i, s) : e.lineTo(i, s);
	}
	e.stroke(), e.strokeStyle = "rgba(255, 244, 228, 0.95)", fa(e, a, r.pose), e.restore(), e.save(), e.strokeStyle = "rgba(214, 160, 96, 0.9)", e.strokeRect(i.x, i.y, i.w, i.h), e.fillStyle = "rgba(255, 244, 228, 0.95)", e.font = "11px system-ui, sans-serif", e.textBaseline = "top", e.fillText(ba(r.ageS), i.x + 6, i.y + 5), e.restore();
}
//#endregion
//#region src/ui/ghostChrome.ts
function Sa(e) {
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
var Ca = 10;
function wa(e) {
	return e.mode === "manual" && !e.attract && !e.ended;
}
var Ta = class {
	deps;
	scheduler;
	display = new ra();
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
		let n = t.world, r = $i(e.mean, n.map, Xr(n, e.anchorStep), Qr(n, e.anchorStep)), i = this.lastT ?? n.step - 1 + 10, a = {
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
		this.scheduler = new ri({ requestGhosts: (e, n, r, i, a) => {
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
		if (this.mode === "autopilot" && e.mode === "manual" && (this.handbackAt = t.step, this.floor = e.link.downlinkStep(t.step), this.display.reset(), this.scheduler.restart(), this.lastBits = Zr(t, e.link.downlinkStep(t.step))), e.mode === "autopilot" && this.mode !== "autopilot" && this.deps.session.client.dropPending(), this.mode = e.mode, e.mode === "autopilot" && this.display.reset(), e.mode !== "manual") return;
		let n = Zr(t, e.link.downlinkStep(t.step)), r = n & ~this.lastBits;
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
		let n = this.enabled && this.isCurrent(e) && wa(e) && this.last.show?.source === "predicted" ? this.scheduler.current : null, r = n ? ma(n, t + 10) : null;
		return this.drawn = r ? r.ghosts.length : 0, r;
	}
	insetFrame(e, t) {
		if (!this.isCurrent(e) || this.last.show?.source !== "predicted") return null;
		let n = Math.max(0, t - 10);
		return {
			pose: bn(e.world, n),
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
			modelState: Ur(t),
			failReason: e.failReason,
			backendRequested: e.requestedBackend,
			info: e.info,
			enabled: this.enabled,
			drawnGhosts: this.drawn,
			painted: la.painted,
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
				insetPainted: _a.painted
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
		if (r === "idle" || r === "loading") return wa(e) ? {
			show: null,
			badges: [Y.loading],
			u: null
		} : n;
		if (r !== "ready") return n;
		let a = e.world, o = this.faultNotice && t < this.faultNotice.until ? Wi(this.faultNotice.bits) : [];
		if (a.done && (e.ended || t - 10 >= a.step)) return {
			show: null,
			badges: [...o, Y.confirmed],
			u: null
		};
		if (!wa(e)) return n;
		let s = this.display.at(t + 10);
		return s ? (s.touchedDown ? o.push(Y.awaiting) : s.extrapolated && o.push(Y.late), {
			show: {
				pose: s.pose,
				source: "predicted",
				age: -10 * i
			},
			badges: o,
			u: s.u
		}) : this.handbackAt !== null && !this.display.started && a.step - this.handbackAt < Ca ? {
			show: null,
			badges: [...o, Y.handback],
			u: null
		} : {
			show: null,
			badges: [...o, this.display.started ? Y.stale : Y.loading],
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
};
//#endregion
//#region src/ui/ghostFeature.ts
function Ea() {
	return {
		mountChrome: (e) => Sa(e.ghostsToggle),
		mountDisplayChrome: Gi,
		random: Math.random
	};
}
function Da(e, t) {
	let n = null, r = null, i = null;
	return {
		controller: () => n,
		mount(a, o) {
			let s = t ?? Ea();
			r = s.mountChrome(a), i = s.mountDisplayChrome(a), n = new Ta({
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
			if (!n) return;
			n.noteShown(t.flight, t.display);
			let r = n.frame(t.flight, t.displayStep), a = n.insetFrame(t.flight, t.displayStep);
			i?.setPredicting(n.showing === "predicted"), e.save(), e.setTransform(t.dpr, 0, 0, t.dpr, 0, 0), r && ha(e, ga(t.camera, t.w, t.h), r), a && xa(e, t.w, t.flight.world.map, a), qi(e, n.badges()), e.restore();
		},
		onPause() {
			n?.setPaused(!0);
		},
		onResume() {
			n?.setPaused(!1);
		},
		destroy() {
			n?.detach(), r?.destroy(), i?.destroy(), n = null, r = null, i = null;
		}
	};
}
function Oa(e, t, n) {
	return !e || e.flightId !== n || t - e.atMs > 1500 || !Number.isFinite(e.pSafe) ? null : e;
}
var ka = (e) => `${Math.round(Math.min(1, Math.max(0, e)) * 100)}%`;
function Aa(e) {
	let t = e.hasValue ? Oa(e.value, e.nowMs, e.flightId) : null;
	if (e.mode === "autopilot") {
		let n = e.counted;
		return n && n.n > 0 && Number.isFinite(n.value) ? {
			label: "Landing probability",
			value: ka(n.value),
			source: `from ${n.n} future${n.n === 1 ? "" : "s"}`
		} : t ? {
			label: "Landing probability",
			value: ka(t.pSafe),
			source: "estimated"
		} : null;
	}
	if (!t) return null;
	let n = e.ageS !== null && Number.isFinite(e.ageS) ? `, ${Math.max(0, e.ageS).toFixed(1)} s old` : "";
	return {
		label: "Autopilot could land from here",
		value: ka(t.pSafe),
		source: `estimated from the downlink${n}`
	};
}
function ja(e) {
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
var Ma = {
	front: 0,
	rear: 0
};
function Na(e) {
	let t = e.world;
	return e.mode === "autopilot" ? ei(t, t.step > 0 ? t.records[t.step - 1].cmd : Ma) : ti(t, e.link);
}
//#endregion
//#region src/ui/readoutFeature.ts
var Pa = 5;
function Fa(e) {
	let t = e.now ?? (() => performance.now()), n = e.session.client, r = null, a = null, o = -1, s = -Infinity, c = !1, l = (e) => {
		e.flightId === o && (a = {
			pSafe: e.pSafe,
			tGo: e.tGo,
			atMs: t(),
			flightId: e.flightId,
			anchorStep: e.anchorStep
		});
	}, u = () => e.session.state() === "ready" && (e.session.info()?.hasValue ?? !1);
	return {
		mount(t) {
			r = e.createView ? e.createView(t) : ja(t.root.ownerDocument), t.instruments.append(r.el), n.onValue = l;
		},
		onFlightStart(e) {
			o = e.flightId, a = null, s = -Infinity, r?.update(null);
		},
		afterStep(e) {
			if (c || e.ended || e.flightId !== o || !u()) return;
			let t = e.world.step;
			if (t - s < Pa) return;
			let r = Na(e);
			r && (s = t, n.requestValue({
				...r,
				flightId: e.flightId
			}));
		},
		draw(n, o) {
			let s = o.flight, c = s.mode === "manual" && a && a.anchorStep > s.link.downlinkStep(s.world.step) ? null : a;
			r?.update(Aa({
				mode: s.mode,
				hasValue: u(),
				value: c,
				nowMs: t(),
				flightId: s.flightId,
				counted: s.mode === "autopilot" ? e.counted?.(s) ?? null : null,
				ageS: s.mode === "manual" && c ? (s.world.step - c.anchorStep) * i : null
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
function Ia(e, t) {
	if (typeof IntersectionObserver > "u") return t(), () => {};
	let n = !1, r = new IntersectionObserver((e) => {
		!n && e.some((e) => e.isIntersecting) && (n = !0, r.disconnect(), t());
	});
	return r.observe(e), () => {
		n = !0, r.disconnect();
	};
}
function La(e, t) {
	let n = new URL(e, t).href;
	return n.endsWith("/") ? n : `${n}/`;
}
function Ra(e, t = {}, n) {
	let r = null, i = null, a = null;
	return {
		mount(a, o) {
			t.onMount?.(a, o);
			let s = n ?? {
				observeOnce: Ia,
				baseURI: () => document.baseURI
			}, c = null, l = (e) => {
				let t = Ur(e);
				t !== c && (c = t, o.setModelState(t));
			};
			i = e.onState(l), l(e.state());
			let u = La(t.dreamBase ?? o.opts.assetBase, s.baseURI());
			r = s.observeOnce(a.root, () => {
				e.ensureLoaded(u, { wantValue: t.wantValue ?? !1 });
			});
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
function za() {
	return {
		fetch: (e, t) => fetch(e, t),
		selectBackend: () => Pr(Nr(""))
	};
}
function Ba(e, t = za()) {
	let n = Wr(e, t), r = Da({ session: n }), i = Vi({ meanSource: () => r.controller() }), a = Ai({
		session: n,
		ghostsOn: () => r.controller()?.status().enabled ?? !0,
		onAdopt: i.record
	});
	return [
		Ra(n, { wantValue: !0 }),
		r,
		a,
		qr({ session: n }),
		i,
		Mi({ gap: i.lastGap }),
		Fa({
			session: n,
			counted: (e) => a.counted(e)
		})
	];
}
//#endregion
//#region src/lib/assetBase.ts
function Va(e, t, n = new URL(t).origin) {
	if (typeof e != "string" || e.trim() === "") throw TypeError("lander: opts.assetBase must be the URL of the directory holding lander.js");
	let r = e.trim();
	if (r.includes("?") || r.includes("#")) throw TypeError("lander: opts.assetBase must not carry a query or fragment; version the directory instead");
	let i;
	try {
		i = new URL(r.replace(/\/*$/, "/"), t);
	} catch {
		throw TypeError(`lander: opts.assetBase "${r}" is not a URL`);
	}
	if (i.protocol !== "http:" && i.protocol !== "https:") throw TypeError(`lander: opts.assetBase must be an http(s) URL, got ${i.protocol}`);
	if (i.username || i.password) throw TypeError("lander: opts.assetBase must not carry credentials");
	if (i.origin !== n) throw TypeError(`lander: opts.assetBase must be on this page's origin (${n}), not ${i.origin}: a module worker loads only from the page's own origin, so serve dist/lander from the site`);
	return i.href.replace(/\/+$/, "/");
}
//#endregion
//#region src/lib/debug.ts
var Ha = Symbol.for("lander.debug"), Ua = 16, Wa = class {
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
		for (; this.flights.size > Ua;) this.flights.delete(Math.min(...this.flights.keys()));
		for (; this.chains.size > Ua;) this.chains.delete(Math.min(...this.chains));
	}
}, Ga = /* @__PURE__ */ new WeakSet();
function Ka(e, t, n) {
	let { doc: r } = n;
	if (!e || e.nodeType !== 1) throw TypeError("lander: mount(container) needs an HTMLElement");
	if (!t || typeof t != "object") throw TypeError("lander: mount(container, opts) needs an options object");
	if (t.reducedMotion !== void 0 && typeof t.reducedMotion != "boolean") throw TypeError("lander: opts.reducedMotion must be a boolean when given");
	if (t.onEvent !== void 0 && typeof t.onEvent != "function") throw TypeError("lander: opts.onEvent must be a function when given");
	if (Ga.has(e)) throw Error("lander: this container already holds a mounted lander; await handle.unload() first");
	let i = Va(t.assetBase, r.baseURI, r.location?.origin ?? new URL(r.baseURI).origin), a = r.createElement("div");
	a.dataset.lander = "root", a.style.position = "relative", a.style.width = "100%", a.style.height = "100%", e.appendChild(a), Ga.add(e);
	let o = t.onEvent, s = new Wa((e) => {
		if (o) try {
			o(e);
		} catch (e) {
			console.error("lander: onEvent threw", e);
		}
	}), c;
	try {
		let e = () => n.createWorker(i);
		c = n.createApp(a, {
			assetBase: i,
			reducedMotion: t.reducedMotion,
			manageVisibility: !0,
			createWorker: e,
			onFlight: (e) => s.push(e),
			features: n.features(e)
		});
	} catch (t) {
		throw s.close(), a.remove(), Ga.delete(e), t;
	}
	let l = !1, u = null, d = null, f = {
		pause() {
			u || (l = !0, c.pause());
		},
		resume() {
			u || (l = !1, c.resume());
		},
		unload() {
			return u || (c.pause(), s.close(), d = c.debug(), u = (async () => {
				try {
					await c.destroy();
				} catch (e) {
					console.error("lander: teardown failed", e);
				} finally {
					a.remove(), Ga.delete(e);
				}
			})(), u);
		}
	};
	return Object.defineProperty(f, Ha, {
		enumerable: !1,
		value: () => ({
			...d ?? c.debug(),
			hostPaused: l,
			hidden: r.hidden === !0,
			unloaded: u !== null
		})
	}), f;
}
//#endregion
//#region src/lib/workerFactory.ts
function qa(e) {
	if (!e.endsWith("/")) throw TypeError("lander: worker base must end in \"/\" (pass a normalized assetBase)");
	return new Worker(`${e}lander-worker.js`, { type: "module" });
}
//#endregion
//#region src/index.ts
function Ja(e, t) {
	return Ka(e, t, {
		createApp: Or,
		createWorker: qa,
		features: (e) => Ba(e),
		doc: e?.ownerDocument ?? document
	});
}
//#endregion
export { Ja as mount };

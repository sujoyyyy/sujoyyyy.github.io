// The career track: a 3D ribbon from IIIT Chennai to Gushwork, behind the hero.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

const COLOR = {
	paper: new THREE.Color('#ffffff'),
	accent: new THREE.Color('#2f4bc3'),
	tie: new THREE.Color('#ebf0ff'),
	ink: new THREE.Color('#14182a'),
	marigold: new THREE.Color('#f5ae39'),
};

// Oldest stop far away, today closest to the camera.
const PATH = [
	[8, 0.4, -26], [2.5, 1.1, -20], [7, -0.2, -13.5], [0.5, 0.7, -8],
	[4, -0.1, -2.5], [-1.5, 0.5, 2], [0.5, 0, 7.5],
];
const STOP_T = [0.03, 0.27, 0.5, 0.73, 0.965];

const UP = new THREE.Vector3(0, 1, 0);
const WIDTH = 1.25;
const DEPTH = 0.16;

function frameAt(curve, t) {
	const p = curve.getPointAt(t);
	const tan = curve.getTangentAt(t);
	const side = new THREE.Vector3().crossVectors(tan, UP).normalize();
	const nrm = new THREE.Vector3().crossVectors(side, tan).normalize();
	return { p, tan, side, nrm };
}

// Sweep a flat box section along the curve with hard-edged faces.
function ribbonGeometry(curve, steps) {
	const faces = [
		[[0.5, 0.5], [-0.5, 0.5], [0, 1]],
		[[-0.5, -0.5], [0.5, -0.5], [0, -1]],
		[[0.5, -0.5], [0.5, 0.5], [1, 0]],
		[[-0.5, 0.5], [-0.5, -0.5], [-1, 0]],
	];
	const frames = [];
	for (let i = 0; i <= steps; i++) frames.push(frameAt(curve, i / steps));

	const pos = [], nor = [], idx = [];
	const v = new THREE.Vector3(), n = new THREE.Vector3();
	faces.forEach(([a, b, fn]) => {
		const base = pos.length / 3;
		frames.forEach(({ p, side, nrm }, i) => {
			for (const c of [a, b]) {
				v.copy(p).addScaledVector(side, c[0] * WIDTH).addScaledVector(nrm, c[1] * DEPTH);
				pos.push(v.x, v.y, v.z);
			}
			n.copy(side).multiplyScalar(fn[0]).addScaledVector(nrm, fn[1]).normalize();
			nor.push(n.x, n.y, n.z, n.x, n.y, n.z);
			if (i < steps) {
				const k = base + i * 2;
				idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
			}
		});
	});

	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
	g.setIndex(idx);
	return g;
}

function basisMatrix({ p, side, nrm }, scale, lift) {
	// side × nrm keeps the basis right-handed; a mirrored instance would render inside out and shimmer.
	const fwd = new THREE.Vector3().crossVectors(side, nrm);
	const m = new THREE.Matrix4().makeBasis(side, nrm, fwd);
	m.scale(scale);
	m.setPosition(p.clone().addScaledVector(nrm, lift));
	return m;
}

const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export function createTrack({ canvas, labelsEl, labels, animate = true }) {
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
	renderer.outputColorSpace = THREE.SRGBColorSpace;

	const scene = new THREE.Scene();
	scene.background = COLOR.paper;
	scene.fog = new THREE.Fog(COLOR.paper, 22, 64);

	const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 120);

	scene.add(new THREE.HemisphereLight(0xffffff, 0xc9cfe6, 1.8));
	const sun = new THREE.DirectionalLight(0xffffff, 1.9);
	sun.position.set(-6, 12, 9);
	scene.add(sun);

	const curve = new THREE.CatmullRomCurve3(PATH.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.5);

	// A little self-light keeps the shaded side the page's cobalt instead of navy.
	const ribbonMat = new THREE.MeshStandardMaterial({ color: COLOR.accent, emissive: COLOR.accent, emissiveIntensity: 0.28, roughness: 0.6, metalness: 0.02, side: THREE.DoubleSide });
	scene.add(new THREE.Mesh(ribbonGeometry(curve, 700), ribbonMat));

	// Ties across the ribbon make it read as a track.
	const tieCount = Math.floor(curve.getLength() / 0.62);
	const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: COLOR.tie, roughness: 0.7 }), tieCount);
	const tieScale = new THREE.Vector3(WIDTH * 0.78, 0.05, 0.14);
	for (let i = 0; i < tieCount; i++) {
		ties.setMatrixAt(i, basisMatrix(frameAt(curve, (i + 0.5) / tieCount), tieScale, DEPTH / 2 + 0.025));
	}
	scene.add(ties);

	// Stations: ink pins, with today's in marigold.
	const inkMat = new THREE.MeshStandardMaterial({ color: COLOR.ink, roughness: 0.5 });
	const nowMat = new THREE.MeshStandardMaterial({ color: COLOR.marigold, roughness: 0.4 });
	const stations = STOP_T.map((t, i) => {
		const now = i === STOP_T.length - 1;
		const g = new THREE.Group();
		g.position.copy(curve.getPointAt(t));
		const height = now ? 1.5 : 1.2;
		const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, height, 12), inkMat);
		pole.position.y = height / 2;
		const ball = new THREE.Mesh(new THREE.SphereGeometry(now ? 0.32 : 0.22, 40, 20), now ? nowMat : inkMat);
		ball.position.y = height + (now ? 0.18 : 0.12);
		g.add(pole, ball);
		if (now) {
			const ring = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.045, 12, 64), nowMat);
			ring.rotation.x = Math.PI / 2;
			ring.position.y = DEPTH / 2 + 0.1;
			g.add(ring);
		}
		scene.add(g);
		return { group: g, top: new THREE.Vector3(0, height + (now ? 0.62 : 0.5), 0) };
	});

	// HTML tags pinned to each station.
	const tags = labels.map((l, i) => {
		const el = document.createElement('span');
		el.className = 'tag' + (i === labels.length - 1 ? ' tag--now' : '');
		el.innerHTML = `<b>${l.when}</b>${l.name}`;
		labelsEl.appendChild(el);
		return el;
	});

	const state = {
		heroProgress: 0,
		heroScroll: 0,
		anchorY: 0,
		pointer: new THREE.Vector2(),
		tilt: new THREE.Vector2(),
		width: 0,
		height: 0,
		pos: new THREE.Vector3(),
		look: new THREE.Vector3(),
		viewX: 0,
		visible: true,
		first: true,
	};
	const target = { pos: new THREE.Vector3(), look: new THREE.Vector3(), viewX: 0, viewY: 0 };

	// Below 1100px wide (and on any portrait screen) the track stacks under the intro.
	const stacked = () => state.width < state.height || state.width < 1100;

	function shot() {
		const tilt = state.tilt;
		const s = animate ? state.heroProgress : 0;
		if (stacked()) {
			// Sits in the space under the intro and scrolls up with it.
			target.pos.set(-3 + tilt.x * 0.6, 13, 25);
			target.look.set(3.5, -1, -9);
			target.viewX = 0;
			target.viewY = -(state.anchorY - state.height / 2) + state.heroScroll;
		} else {
			// Seen from the left so the track sweeps across the right of the page and off its bottom edge.
			target.pos.set(-8 + tilt.x * 0.9, 10 + tilt.y * 0.5 - s * 2, 19 - s * 4);
			target.look.set(3.5, -0.5 - s, -9);
			target.viewX = -(state.width < 1360 ? 0.2 : 0.17) * state.width;
			target.viewY = -0.03 * state.height;
		}
	}

	function resize() {
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		if (w === state.width && Math.abs(h - state.height) < 120) return;
		state.width = w;
		state.height = h;
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, w < 768 ? 1.5 : 2));
		renderer.setSize(w, h, false);
		camera.aspect = w / h;
		camera.fov = w < h ? 46 : w < 1100 ? 40 : 34;
		camera.updateProjectionMatrix();
		state.first = true;
	}

	const v = new THREE.Vector3();
	function placeTags() {
		// On portrait the track scrolls with the page, so tags stay until it leaves.
		const fadeFrom = stacked() ? 0.55 : 0;
		const show = THREE.MathUtils.clamp(1 - (state.heroProgress - fadeFrom) * 2.2, 0, 1);
		stations.forEach((st, i) => {
			v.copy(st.top).applyMatrix4(st.group.matrixWorld).project(camera);
			const x = (v.x + 1) / 2 * state.width;
			const y = (1 - v.y) / 2 * state.height;
			const off = v.z > 1 || x < -40 || x > state.width + 40;
			tags[i].style.opacity = off ? 0 : show;
			tags[i].style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
		});
	}

	const clock = new THREE.Clock();
	let raf = 0;

	function frame() {
		raf = requestAnimationFrame(frame);
		if (!state.visible) return;
		const dt = Math.min(clock.getDelta(), 0.05);

		if (animate) {
			state.tilt.x = damp(state.tilt.x, state.pointer.x, 2.5, dt);
			state.tilt.y = damp(state.tilt.y, state.pointer.y, 2.5, dt);
		}
		shot();

		const k = state.first ? 1e3 : 4;
		state.first = false;
		state.pos.x = damp(state.pos.x, target.pos.x, k, dt);
		state.pos.y = damp(state.pos.y, target.pos.y, k, dt);
		state.pos.z = damp(state.pos.z, target.pos.z, k, dt);
		state.look.x = damp(state.look.x, target.look.x, k, dt);
		state.look.y = damp(state.look.y, target.look.y, k, dt);
		state.look.z = damp(state.look.z, target.look.z, k, dt);
		state.viewX = damp(state.viewX, target.viewX, k, dt);

		camera.position.copy(state.pos);
		camera.lookAt(state.look);
		// Stacked layouts lock to the page so the track scrolls with the intro, not after it.
		camera.setViewOffset(state.width, state.height, state.viewX, target.viewY, state.width, state.height);

		renderer.render(scene, camera);
		placeTags();
	}

	resize();
	window.addEventListener('resize', resize);
	if (animate) {
		window.addEventListener('pointermove', (e) => {
			state.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
		}, { passive: true });
	}
	frame();

	return {
		setHeroProgress(p, px) { state.heroProgress = p; state.heroScroll = px; },
		setAnchor(y) { state.anchorY = y; },
		setVisible(on) { state.visible = on; },
		dispose() { cancelAnimationFrame(raf); renderer.dispose(); },
	};
}

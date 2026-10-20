import { makeRow } from './reel.js';

const root = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Mobile menu: a sheet anchored to its button */

const menuButton = document.querySelector('[data-menu-button]');
const menu = document.querySelector('[data-menu]');

function setMenu(open, { restoreFocus = false } = {}) {
	if (open) {
		const b = menuButton.getBoundingClientRect();
		const m = menu.getBoundingClientRect();
		menu.style.setProperty('--origin', `${b.left + b.width / 2 - m.left}px`);
	}
	menu.toggleAttribute('data-open', open);
	menuButton.setAttribute('aria-expanded', String(open));
	if (open) menu.querySelector('a').focus({ preventScroll: true });
	else if (restoreFocus) menuButton.focus({ preventScroll: true });
}

menuButton.addEventListener('click', () => setMenu(!menu.hasAttribute('data-open')));
menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape' && menu.hasAttribute('data-open')) setMenu(false, { restoreFocus: true });
});
document.addEventListener('pointerdown', (e) => {
	if (menu.hasAttribute('data-open') && !menu.contains(e.target) && !menuButton.contains(e.target)) setMenu(false);
});

/* Header shadow once the page moves */

const bar = document.querySelector('[data-bar]');
const onScroll = () => bar.classList.toggle('is-scrolled', window.scrollY > 8);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* Current section in the nav */

const navLinks = [...document.querySelectorAll('.bar__nav a')];
const spy = new IntersectionObserver((entries) => {
	entries.forEach((entry) => {
		if (!entry.isIntersecting) return;
		navLinks.forEach((a) => {
			if (a.getAttribute('href') === `#${entry.target.id}`) a.setAttribute('aria-current', 'true');
			else a.removeAttribute('aria-current');
		});
	});
}, { rootMargin: '-45% 0px -50% 0px' });
['experience', 'receipts', 'words', 'work', 'life', 'contact'].forEach((id) => spy.observe(document.getElementById(id)));

/* Numbers roll once, like an odometer. Each digit sits on its real value; on arrival it
   spins one full turn (its strip holds 0–9 twice) and lands where it started, so a number
   is never wrong at rest, even if the spin never runs. */

document.querySelectorAll('[data-odo]').forEach((el) => {
	const final = el.textContent.trim();
	const sr = document.createElement('span');
	sr.className = 'sr';
	sr.textContent = final;
	el.after(sr);
	el.setAttribute('aria-hidden', 'true');
	if (reduce) return;

	const strips = [];
	el.replaceChildren(...[...final].map((ch) => {
		if (!/\d/.test(ch)) return document.createTextNode(ch);
		const digit = Number(ch);
		const col = document.createElement('span');
		col.className = 'odo__col';
		const sizer = document.createElement('span');
		sizer.className = 'odo__sizer';
		sizer.textContent = ch;
		const strip = document.createElement('span');
		strip.className = 'odo__strip';
		strip.append(...'01234567890123456789'.split('').map((d) => Object.assign(document.createElement('span'), { textContent: d })));
		strip.style.transform = `translateY(-${digit * 5}%)`;
		col.append(sizer, strip);
		strips.push({ strip, digit });
		return col;
	}));

	// Numbers already on screen at load just stay put.
	const rect = el.getBoundingClientRect();
	if (rect.top < window.innerHeight && rect.bottom > 0) return;

	const io = new IntersectionObserver(([entry]) => {
		if (!entry.isIntersecting) return;
		io.disconnect();
		strips.forEach(({ strip, digit }, i) => {
			strip.animate(
				[{ transform: `translateY(-${digit * 5}%)` }, { transform: `translateY(-${(digit + 10) * 5}%)` }],
				{ duration: 1200 + i * 150, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' },
			);
		});
	}, { rootMargin: '0px 0px -8% 0px' });
	io.observe(el);
});

/* The career track, in 3D, behind the hero */

const STOPS = [
	{ when: '2018', name: 'IIIT Chennai' },
	{ when: '2022', name: 'Raaho' },
	{ when: '2024', name: 'Hike' },
	{ when: '2025', name: 'Toddle' },
	{ when: 'Now', name: 'Gushwork' },
];

function webglAvailable() {
	try {
		const c = document.createElement('canvas');
		return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
	} catch {
		return false;
	}
}

async function startTrack() {
	// Without WebGL (or if three.js can't load) the hero shows a still of the track instead.
	if (!webglAvailable()) {
		root.classList.add('no-webgl');
		return;
	}
	let createTrack;
	try {
		({ createTrack } = await import('./track.js'));
	} catch {
		root.classList.add('no-webgl');
		return;
	}

	root.classList.add('is-webgl');
	const scene = createTrack({
		canvas: document.getElementById('stage'),
		labelsEl: document.getElementById('stage-labels'),
		labels: STOPS,
		animate: !reduce,
	});

	const hero = document.querySelector('.hero');
	const stage = hero.querySelector('.hero__stage');

	// On stacked layouts the track is centred on its stage, between the intro and the proof.
	const placeAnchor = () => {
		const r = stage.getBoundingClientRect();
		scene.setAnchor(r.top + window.scrollY + r.height / 2);
	};
	const followHero = () => {
		const y = Math.min(window.scrollY, hero.offsetHeight);
		scene.setHeroProgress(y / hero.offsetHeight, y);
	};
	placeAnchor();
	followHero();
	window.addEventListener('resize', placeAnchor);
	// Web fonts and images can reflow the intro after load; keep the anchor on the stage.
	new ResizeObserver(placeAnchor).observe(hero);
	window.addEventListener('scroll', followHero, { passive: true });

	new IntersectionObserver(([entry]) => scene.setVisible(entry.isIntersecting)).observe(hero);
}

startTrack();

/* Life reel: two endless rows drifting slowly in opposite directions */

if (!reduce) {
	document.querySelectorAll('[data-reel-row]').forEach((row, i) => {
		makeRow(row, { label: `Photos, row ${i + 1} of 2`, speed: 14, direction: row.dataset.reelRow === 'left' ? -1 : 1 });
	});
}

/* Receipts: open a screenshot full size, growing out of its card and returning to it */

const viewer = document.querySelector('[data-viewer]');
if (viewer) {
	const frame = viewer.querySelector('[data-viewer-scroll]');
	const img = viewer.querySelector('[data-viewer-img]');
	const cap = viewer.querySelector('[data-viewer-cap]');
	const ease = 'cubic-bezier(0.25, 1, 0.5, 1)';
	let trigger = null;
	let closing = false;

	const anchorToCard = () => {
		const a = trigger.getBoundingClientRect();
		const b = frame.getBoundingClientRect();
		frame.style.transformOrigin = `${a.left + a.width / 2 - b.left}px ${a.top + a.height / 2 - b.top}px`;
	};

	const fadeBackdrop = (from, to) => {
		try {
			viewer.animate([{ opacity: from }, { opacity: to }], { duration: 260, easing: ease, pseudoElement: '::backdrop' });
		} catch { /* older engines: the backdrop simply appears */ }
	};

	function openViewer(btn) {
		trigger = btn;
		closing = false;
		const thumb = btn.querySelector('img');
		const who = btn.closest('.receipt').querySelector('.receipt__who');
		// Show the already-loaded thumbnail at once, then swap in the full-size file.
		img.src = thumb.currentSrc || thumb.src;
		img.alt = thumb.alt;
		const full = new Image();
		full.src = btn.dataset.zoom;
		full.decode().then(() => { if (trigger === btn) img.src = full.src; }).catch(() => {});

		cap.replaceChildren();
		const name = document.createElement('b');
		name.textContent = who.querySelector('b').textContent;
		const meta = document.createElement('span');
		meta.textContent = ` ${who.lastChild.textContent}`;
		cap.append(name, meta);

		viewer.dataset.kind = btn.dataset.kind || 'slack';
		root.classList.add('viewer-open');
		viewer.showModal();
		frame.scrollTo(0, 0);
		if (!reduce) {
			anchorToCard();
			frame.animate([{ transform: 'scale(0.6)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: ease });
			fadeBackdrop(0, 1);
		}
	}

	function closeViewer() {
		if (!viewer.open || closing) return;
		closing = true;
		const done = () => {
			viewer.close();
			root.classList.remove('viewer-open');
			trigger?.focus({ preventScroll: true });
			closing = false;
		};
		if (reduce) return done();
		anchorToCard();
		fadeBackdrop(1, 0);
		frame.animate([{ transform: 'none', opacity: 1 }, { transform: 'scale(0.6)', opacity: 0 }], { duration: 240, easing: ease, fill: 'forwards' })
			.finished.then((a) => { done(); a.cancel(); });
	}

	document.querySelectorAll('[data-zoom]').forEach((btn) => btn.addEventListener('click', () => openViewer(btn)));
	viewer.querySelector('[data-viewer-close]').addEventListener('click', closeViewer);
	viewer.addEventListener('cancel', (e) => { e.preventDefault(); closeViewer(); });
	viewer.addEventListener('click', (e) => { if (e.target === viewer) closeViewer(); });
}

/* Copy email */

const copyBtn = document.querySelector('[data-copy]');
if (copyBtn) {
	const label = copyBtn.querySelector('[data-copy-label]');
	const status = document.querySelector('[data-copy-status]');
	let timer;
	copyBtn.addEventListener('click', async () => {
		try {
			await navigator.clipboard.writeText(copyBtn.dataset.copy);
			label.textContent = 'Copied';
			status.textContent = 'Email address copied to clipboard';
			navigator.vibrate?.(10);
		} catch {
			label.textContent = 'Copy failed, select it instead';
			status.textContent = 'Could not copy. Select the email address to copy it.';
		}
		clearTimeout(timer);
		timer = setTimeout(() => { label.textContent = 'Copy email'; status.textContent = ''; }, 2400);
	});
}

/* Local time in Bengaluru */

const clockEl = document.querySelector('[data-clock]');
if (clockEl) {
	const fmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true });
	const tick = () => {
		const now = new Date();
		clockEl.textContent = fmt.format(now).toLowerCase();
		clockEl.dateTime = now.toISOString();
	};
	tick();
	setInterval(tick, 30_000);
}

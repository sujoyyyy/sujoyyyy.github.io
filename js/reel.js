// Endless photo rows: each drifts slowly and loops seamlessly. People can grab,
// flick, swipe or arrow through a row; their momentum decays back into the drift.

const easeToward = (v, target, k, dt) => v + (target - v) * (1 - Math.exp(-k * dt));

// speed: px per second; direction: -1 drifts left, 1 drifts right.
export function makeRow(row, { label, speed = 14, direction = -1 }) {
	const viewport = row.parentElement;

	// One copy of the set lets the strip wrap without a seam. Copies stay out of the a11y tree.
	const originals = [...row.children];
	originals.forEach((el) => {
		const copy = el.cloneNode(true);
		copy.setAttribute('aria-hidden', 'true');
		copy.querySelectorAll('img').forEach((img) => { img.alt = ''; });
		row.append(copy);
	});

	// Edge to edge, so the wrap point never shows the gutter.
	row.classList.add('is-endless');
	row.tabIndex = 0;
	row.setAttribute('role', 'group');
	row.setAttribute('aria-label', `${label}. Drag, swipe or use the arrow keys to move it.`);
	row.querySelectorAll('img').forEach((img) => { img.draggable = false; });

	let span = 1;
	let x = 0;
	let vel = direction * speed;
	let dir = direction;
	let hovering = false;
	let focused = false;
	let visible = false;

	const measure = () => { span = Math.max(1, originals.length ? row.children[originals.length].offsetLeft - originals[0].offsetLeft : 1); };
	const wrap = (v) => ((v % span) - span) % span;
	const render = (v) => {
		x = wrap(v);
		row.style.transform = `translate3d(${x}px, 0, 0)`;
	};

	/* Pointer: hysteresis first, then 1:1 tracking from wherever it was grabbed */
	let press = null;
	row.addEventListener('pointerdown', (e) => {
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		press = { id: e.pointerId, x0: e.clientX, y0: e.clientY, origin: x, dragging: false, history: [] };
	});

	row.addEventListener('pointermove', (e) => {
		if (!press || e.pointerId !== press.id) return;
		const dx = e.clientX - press.x0;
		const dy = e.clientY - press.y0;
		if (!press.dragging) {
			if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { press = null; return; }
			if (Math.abs(dx) < 10) return;
			press.dragging = true;
			press.x0 = e.clientX;
			press.origin = x;
			row.setPointerCapture(e.pointerId);
			row.classList.add('is-dragging');
		}
		const now = performance.now();
		press.history.push({ x: e.clientX, t: now });
		while (press.history.length > 2 && now - press.history[0].t > 100) press.history.shift();
		render(press.origin + (e.clientX - press.x0));
	});

	const release = (e) => {
		if (!press || e.pointerId !== press.id) return;
		const { dragging, history } = press;
		press = null;
		if (!dragging) return;
		row.classList.remove('is-dragging');
		// Hand the finger's velocity to the row; it decays back into the drift.
		if (history.length > 1) {
			const a = history[0];
			const b = history[history.length - 1];
			vel = ((b.x - a.x) / Math.max(b.t - a.t, 1)) * 1000;
			if (Math.abs(vel) > 200) dir = Math.sign(vel);
		} else {
			vel = 0;
		}
	};
	row.addEventListener('pointerup', release);
	row.addEventListener('pointercancel', release);

	/* Trackpad: horizontal swipes move the row; vertical ones stay with the page */
	row.addEventListener('wheel', (e) => {
		if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
		e.preventDefault();
		e.stopPropagation();
		render(x - e.deltaX);
		vel = -e.deltaX * 30;
	}, { passive: false });

	/* Keyboard: a push of about one photo */
	row.addEventListener('keydown', (e) => {
		if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
		e.preventDefault();
		vel += e.key === 'ArrowRight' ? -900 : 900;
	});

	row.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hovering = true; });
	row.addEventListener('pointerleave', () => { hovering = false; });
	row.addEventListener('focusin', () => { focused = true; });
	row.addEventListener('focusout', () => { focused = false; });
	new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(viewport);

	let last = 0;
	requestAnimationFrame(function tick(now) {
		requestAnimationFrame(tick);
		const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
		last = now;
		if (!visible || press) return;
		// Hover and focus ease the drift to a stop; a flick's extra speed bleeds off gently.
		const target = hovering || focused ? 0 : dir * speed;
		vel = easeToward(vel, target, Math.abs(vel) > speed * 1.5 ? 2 : 3, dt);
		render(x + vel * dt);
	});

	measure();
	render(direction > 0 ? -span / 2 : 0);
	window.addEventListener('resize', measure);
	row.querySelectorAll('img').forEach((img) => img.complete || img.addEventListener('load', measure, { once: true }));
}

'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, RotateCw } from 'lucide-react';
import gsap from 'gsap';
const candy = [
  '#ff7547',
  '#ffd23f',
  '#3fb8af',
  '#f6a5c0',
  '#4a6fb5',
  '#7fae6b',
  '#ffffff',
  '#e8b04b',
  '#c5b5f5',
];
// One colour per category, handed out from the most common category down.
function candyMap(products) {
  const counts = {};
  for (const p of products) counts[p.category] = (counts[p.category] || 0) + 1;
  const order = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  return (product) =>
    product ? candy[Math.max(order.indexOf(product.category), 0) % candy.length] : YOURS;
}

const BALLS = 12;
// Every fourth ball is an empty slot that invites you to post your own thing.
const YOURS = '#c5b5f5';
function slot(products, i, round) {
  if (!products.length || i % 4 === 3) return null;
  const n = i - Math.floor(i / 4) + round * (BALLS - BALLS / 4);
  return products[n % products.length];
}
const moods = [
  'turn the crank. you know you want to.',
  'ooh. one more?',
  'okay, a little hooked.',
  'Gobble is taking notes.',
  'this is your life now.',
];

// Little gumball physics: gravity, ball-on-ball bumps, and a round glass wall.
function step(balls, R, dt, pointer) {
  for (const b of balls) {
    if (b.gone) continue;
    b.vy += 1500 * dt;
    b.vx *= 0.996;
    b.vy *= 0.996;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.turn += (b.vx * dt) / b.r;
  }
  const live = balls.filter((b) => !b.gone);
  for (let k = 0; k < 3; k++) {
    for (let i = 0; i < live.length; i++)
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i],
          b = live[j];
        const dx = b.x - a.x,
          dy = b.y - a.y,
          d = Math.hypot(dx, dy) || 0.01,
          min = a.r + b.r;
        if (d >= min) continue;
        const nx = dx / d,
          ny = dy / d,
          o = (min - d) / 2;
        a.x -= nx * o;
        a.y -= ny * o;
        b.x += nx * o;
        b.y += ny * o;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel < 0) {
          const hit = (-1.35 * rel) / 2;
          a.vx -= hit * nx;
          a.vy -= hit * ny;
          b.vx += hit * nx;
          b.vy += hit * ny;
        }
      }
    for (const b of live) {
      if (pointer) {
        const dx = b.x - pointer.x,
          dy = b.y - pointer.y,
          d = Math.hypot(dx, dy) || 0.01,
          min = b.r + 16;
        if (d < min) {
          b.x = pointer.x + (dx / d) * min;
          b.y = pointer.y + (dy / d) * min;
          b.vx += pointer.vx * 0.35;
          b.vy += pointer.vy * 0.35;
        }
      }
      const dx = b.x - R,
        dy = b.y - R,
        d = Math.hypot(dx, dy) || 0.01,
        max = R - b.r - 4;
      if (d <= max) continue;
      const nx = dx / d,
        ny = dy / d,
        vn = b.vx * nx + b.vy * ny;
      b.x = R + nx * max;
      b.y = R + ny * max;
      if (vn > 0) {
        b.vx = (b.vx - 1.45 * vn * nx) * 0.97;
        b.vy = (b.vy - 1.45 * vn * ny) * 0.97;
      }
    }
  }
}

export default function SnackMachine({ products, motion, onPick }) {
  const dome = useRef(null),
    crank = useRef(null),
    capsule = useRef(null),
    els = useRef([]),
    balls = useRef([]),
    size = useRef(0),
    pointer = useRef(null),
    frame = useRef(0),
    wake = useRef(() => {});
  const [round, setRound] = useState(0),
    [left, setLeft] = useState(BALLS),
    [prize, setPrize] = useState(null),
    [turns, setTurns] = useState(0);
  const candyFor = useMemo(() => candyMap(products), [products]);
  const picks = Array.from({ length: BALLS }, (_, i) => slot(products, i, round));

  useEffect(() => {
    const box = dome.current;
    const draw = () => {
      for (const b of balls.current) {
        const el = els.current[b.i];
        if (el && !b.gone)
          el.style.transform = `translate(${b.x - b.r}px, ${b.y - b.r}px) rotate(${b.turn}rad)`;
      }
    };
    const place = () => {
      const R = box.clientWidth / 2,
        old = size.current;
      if (!R) return;
      if (old && balls.current.length) {
        for (const b of balls.current) {
          b.x *= R / old;
          b.y *= R / old;
          b.r = R * 0.18;
        }
      } else {
        balls.current = picks.map((_, i) => ({
          i,
          r: R * 0.18,
          x: R + Math.cos(i * 2.4) * R * 0.45,
          y: R * 0.5 + Math.sin(i * 2.4) * R * 0.35,
          vx: 0,
          vy: 0,
          turn: i,
        }));
        for (let n = 0; n < 240; n++) step(balls.current, R, 1 / 60, null);
        for (const b of balls.current) b.vx = b.vy = 0;
      }
      size.current = R;
      draw();
    };
    let last = 0,
      calm = 0;
    const tick = (now) => {
      const dt = Math.min((now - (last || now)) / 1000, 1 / 30) || 1 / 60;
      last = now;
      const R = size.current;
      step(balls.current, R, dt / 2, pointer.current);
      step(balls.current, R, dt / 2, null);
      if (pointer.current) {
        pointer.current.vx *= 0.5;
        pointer.current.vy *= 0.5;
      }
      draw();
      const fast = balls.current.some((b) => !b.gone && Math.hypot(b.vx, b.vy) > 12);
      calm = fast || pointer.current ? 0 : calm + 1;
      if (calm > 40) {
        frame.current = 0;
        last = 0;
        return;
      }
      frame.current = requestAnimationFrame(tick);
    };
    wake.current = () => {
      if (!motion) return draw();
      if (!frame.current) frame.current = requestAnimationFrame(tick);
    };
    size.current = 0;
    place();
    const observer = new ResizeObserver(place);
    observer.observe(box);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
    // picks only change with a refill, which is keyed by round
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, motion]);

  function stir(event) {
    if (!motion) return;
    const rect = dome.current.getBoundingClientRect();
    const x = event.clientX - rect.left,
      y = event.clientY - rect.top,
      p = pointer.current;
    pointer.current = {
      x,
      y,
      vx: p ? (x - p.x) * 30 : 0,
      vy: p ? (y - p.y) * 30 : 0,
    };
    wake.current();
  }

  function shake() {
    for (const b of balls.current) {
      if (b.gone) continue;
      b.vx += (Math.random() - 0.5) * 900;
      b.vy -= 500 + Math.random() * 600;
    }
    if (!motion) {
      for (let n = 0; n < 240; n++) step(balls.current, size.current, 1 / 60, null);
    }
    wake.current();
  }

  function dispense() {
    if (!left) {
      setRound((r) => r + 1);
      setLeft(BALLS);
      setPrize(null);
      return;
    }
    const ball = balls.current.filter((b) => !b.gone).reduce((low, b) => (b.y > low.y ? b : low));
    ball.gone = true;
    setLeft((n) => n - 1);
    setTurns((n) => n + 1);
    const el = els.current[ball.i];
    const reveal = () => {
      // Read the product now, not when the balls were made: products can arrive after the first paint.
      setPrize({ product: picks[ball.i], key: Date.now() });
      shake();
    };
    if (!motion) {
      el.style.visibility = 'hidden';
      return reveal();
    }
    gsap
      .timeline({ onComplete: reveal })
      .to(crank.current, { rotation: '+=360', duration: 0.5, ease: 'back.inOut(1.6)' }, 0)
      .to(el, { y: '+=60', scale: 0.4, opacity: 0, duration: 0.3, ease: 'power2.in' }, 0.15);
  }

  useEffect(() => {
    if (prize && motion && capsule.current)
      gsap.from(capsule.current, {
        y: -46,
        scale: 0.3,
        rotation: -25,
        duration: 0.5,
        ease: 'back.out(2.2)',
        clearProps: 'all',
      });
  }, [prize, motion]);

  const found = prize?.product;
  return (
    <div className="snack-machine">
      <button
        ref={dome}
        className="machine-dome"
        onPointerMove={stir}
        onPointerLeave={() => (pointer.current = null)}
        onClick={shake}
        aria-label={`Shake the snack machine. ${left} snacks left.`}
      >
        {picks.map((p, i) => (
          <span
            key={`${round}-${i}`}
            ref={(el) => (els.current[i] = el)}
            className="gumball"
            aria-hidden="true"
            style={{ backgroundColor: candyFor(p) }}
          />
        ))}
      </button>
      <div className="machine-body">
        <span className="machine-label">Gobble-o-matic</span>
        <button
          className="machine-crank"
          onClick={dispense}
          aria-label={left ? 'Turn the crank for a random find' : 'Refill the snack machine'}
        >
          <span ref={crank}>
            <RotateCw size={20} />
          </span>
        </button>
        <span className="machine-count">{left ? `${left} left` : 'empty!'}</span>
      </div>
      <div className="machine-tray" aria-live="polite">
        {found ? (
          <a
            ref={capsule}
            key={prize.key}
            className="machine-capsule"
            href={`/product/${found.slug}`}
            onClick={(event) => {
              event.preventDefault();
              onPick(found, event.currentTarget);
            }}
          >
            <span className="capsule-art" style={{ backgroundColor: candyFor(found) }} />
            <span className="capsule-name">
              {found.name}
              <small>{found.category}</small>
            </span>
            <ArrowUpRight size={16} />
          </a>
        ) : prize ? (
          <a ref={capsule} key={prize.key} className="machine-capsule" href="/discover?submit=1">
            <span className="capsule-name">Your thing goes here</span>
            <ArrowUpRight size={16} />
          </a>
        ) : (
          <span className="machine-hint">{left ? moods[0] : 'refill me ↻'}</span>
        )}
      </div>
      {turns > 0 && (
        <span className="machine-mood">{moods[Math.min(turns, moods.length - 1)]}</span>
      )}
    </div>
  );
}

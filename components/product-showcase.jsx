'use client';
import { useId, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  Plus,
  Zap,
  MousePointer2,
  MoveRight,
  SlidersHorizontal,
  Undo2,
} from 'lucide-react';
import { Gobble } from './gobble';
import WorkMedia from './work-media';
import { productColors, isArtwork, workImageAlt } from '../lib/product-options.mjs';
import '../app/covers.css';

export const showcaseColors = {
  forms: '#c5b5f5',
  sketch: '#bfdcf5',
  photo: '#f9b7cb',
  design: '#d5f568',
  workflow: '#ffab7d',
  calendar: '#b8dac7',
};
export function productSceneColor(product) {
  return (
    showcaseColors[product.icon] ||
    productColors.find((option) => option.value === product.color)?.hex ||
    '#c5b5f5'
  );
}

// These are original editorial miniatures, not embedded or connected versions of the products.
export function ProductDemo({ product }) {
  const [choice, setChoice] = useState('a side project');
  const [done, setDone] = useState(false);
  const [step, setStep] = useState(0);
  const [value, setValue] = useState(55);
  const id = useId();
  if (product.cover)
    return (
      <figure className={`product-cover-figure ${isArtwork(product) ? 'is-artwork' : ''}`}>
        <WorkMedia
          key={product.cover.id}
          cover={product.cover}
          name={product.name}
          alt={workImageAlt(product)}
        />
        <figcaption>
          {isArtwork(product)
            ? product.owner_name
              ? `Shared by ${product.owner_name}`
              : product.name
            : product.cover.kind === 'capture'
              ? 'Website snapshot'
              : 'Uploaded product cover'}
        </figcaption>
      </figure>
    );
  return (
    <div className={`product-demo demo-${product.icon}`}>
      {product.icon === 'forms' ? (
        <div className="demo-form demo-paper">
          <span className="demo-symbol" aria-hidden="true">
            ≋
          </span>
          {done ? (
            <div className="demo-success">
              <Check size={46} />
              <h4>Excellent taste.</h4>
              <p>Demo complete. Your answer stays here.</p>
              <button onClick={() => setDone(false)}>
                Go again <Undo2 size={15} />
              </button>
            </div>
          ) : (
            <>
              <h4>
                What are
                <br />
                you cooking?
              </h4>
              <div className="demo-choices" role="group" aria-label="Try the illustrated form">
                {['a side project', 'my next big thing', 'literally just pasta'].map((label) => (
                  <button
                    key={label}
                    aria-pressed={choice === label}
                    onClick={() => setChoice(label)}
                  >
                    <span>{choice === label && <Check size={13} />}</span>
                    {label}
                  </button>
                ))}
              </div>
              <button className="demo-submit" onClick={() => setDone(true)}>
                That’s me <ArrowUpRight size={18} />
              </button>
            </>
          )}
          <span className="demo-form-sticker">
            no code.
            <br />
            just questions.
          </span>
        </div>
      ) : product.icon === 'sketch' ? (
        <div className="demo-board">
          <div className="demo-board-tools">
            <MousePointer2 size={19} />
            <span>□</span>
            <span>○</span>
            <span>↗</span>
            <span>Aa</span>
          </div>
          <div className="sketch-bubble bubble-start">that 2am idea</div>
          <svg viewBox="0 0 480 200" className="sketch-connection" aria-hidden="true">
            <path d="M100 45C270-10 170 180 365 138m-25-20 26 22-35 12" />
          </svg>
          <button className="sketch-bubble bubble-end" onClick={() => setStep((v) => (v + 1) % 3)}>
            {['a very good plan', 'a tiny side quest', 'okay, let’s ship it'][step]}
            <Plus size={18} />
          </button>
          <span className="demo-hint">tap the idea. see where it goes.</span>
        </div>
      ) : product.icon === 'photo' ? (
        <div className="demo-editor">
          <div className="demo-editor-top">
            <span>your next masterpiece</span>
            <SlidersHorizontal size={17} />
          </div>
          <div className="photo-composition" style={{ filter: `saturate(${value / 50})` }}>
            <span className="photo-circle" />
            <span className="photo-arch" />
            <span className="photo-word">
              make
              <br />a scene.
            </span>
            <span className="photo-selection">
              <i />
              <i />
              <i />
              <i />
            </span>
          </div>
          <label className="demo-slider" htmlFor={`${id}-color`}>
            A little more color
            <input
              id={`${id}-color`}
              aria-label="Try the color adjustment"
              type="range"
              min="0"
              max="100"
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
            />
          </label>
        </div>
      ) : product.icon === 'design' ? (
        <div className="demo-design">
          <div
            className="design-object"
            style={{ borderRadius: `${value}% ${100 - value}% ${value}% ${100 - value}%` }}
          >
            <Gobble />
            <span>make it yours.</span>
          </div>
          <span className="design-pointer">
            <MousePointer2 size={23} />
            you, designing
          </span>
          <label className="demo-slider" htmlFor={`${id}-shape`}>
            Try a different shape
            <input
              id={`${id}-shape`}
              aria-label="Try the shape adjustment"
              type="range"
              min="5"
              max="85"
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
            />
          </label>
        </div>
      ) : product.icon === 'workflow' ? (
        <div className={`demo-flow ${done ? 'flow-done' : ''}`}>
          <div className="flow-path">
            <div className="flow-node">
              a new idea<span>Trigger</span>
            </div>
            <MoveRight />
            <div className="flow-node flow-zap">
              <Zap size={32} />
              <span>Automate</span>
            </div>
            <MoveRight />
            <div className="flow-node">
              {done ? <Check size={28} /> : 'the good bit'}
              <span>{done ? 'Done!' : 'Result'}</span>
            </div>
          </div>
          <button className="demo-submit" onClick={() => setDone(!done)}>
            {done ? 'Run it again' : 'Try the chain reaction'}
            {done ? <Undo2 size={17} /> : <Zap size={17} />}
          </button>
          <p className="demo-hint" role="status">
            {done
              ? 'Three little steps. One less repetitive job.'
              : 'Click. Connect. Give your tabs a break.'}
          </p>
        </div>
      ) : product.icon === 'calendar' ? (
        <div className="demo-calendar demo-paper">
          <span className="calendar-doodle" aria-hidden="true">
            ✳
          </span>
          <h4>
            A little time
            <br />
            for a good idea.
          </h4>
          <p>Pick a pretend coffee date.</p>
          <div className="demo-dates" role="group" aria-label="Try picking a demo date">
            {['Mon', 'Tue', 'Wed', 'Thu'].map((day, i) => (
              <button key={day} aria-pressed={step === i} onClick={() => setStep(i)}>
                <span>{day}</span>
                <strong>{12 + i}</strong>
              </button>
            ))}
          </div>
          <div className="calendar-confirm" role="status">
            <Check size={18} />
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday'][step]}, 10:00. Coffee’s on you.
          </div>
        </div>
      ) : (
        <div className="demo-generic">
          <Gobble />
          <p>{product.tagline}</p>
        </div>
      )}
      <span className="demo-caption">a tiny taste, illustrated by us</span>
    </div>
  );
}

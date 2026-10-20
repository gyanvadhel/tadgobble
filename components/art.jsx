import {
  Asterisk,
  ArrowUpRight,
  Check,
  MousePointer2,
  Plus,
  Play,
  Zap,
  CalendarDays,
  Image,
  FileText,
  Code2,
} from 'lucide-react';
import { brand } from '../lib/brand.mjs';
import { Gobble } from './gobble';
export function Brand({ light = false, studio = false }) {
  return (
    <a href="/" className={`brand ${light ? 'brand-light' : ''}`}>
      <span className="brand-mark">
        <Gobble width={32} height={32} />
      </span>
      <span>
        {brand.name}
        <span className="brand-dot">.</span>
      </span>
      {studio && <small>STUDIO</small>}
    </a>
  );
}
export function ProductArt({ product, large = false }) {
  const kind = product.icon;
  return (
    <div
      className={`product-art art-${product.color} ${large ? 'art-large' : ''}`}
      aria-label={`${product.name} editorial illustration`}
    >
      {kind === 'forms' ? (
        <div className="art-form">
          <div className="art-form-eyebrow">
            <span /> A LITTLE LESS ADMIN
          </div>
          <h3>
            Good things
            <br />
            start with a hello<span>✳</span>
          </h3>
          <div className="art-field">
            Your name <span>Alex</span>
          </div>
          <div className="art-field">
            What are you working on? <span>Something good.</span>
          </div>
          <div className="art-submit">
            Let’s make it happen <ArrowUpRight size={14} />
          </div>
          <div className="floating-check">
            <Check size={26} />
          </div>
        </div>
      ) : kind === 'sketch' ? (
        <div className="art-sketch">
          <div className="sketch-note note-one">a little idea ✳</div>
          <svg viewBox="0 0 300 160">
            <path
              d="M70 55 Q130 10 155 60 T250 80 M238 69l14 12-18 8"
              fill="none"
              stroke="#655b99"
              strokeWidth="3"
              strokeDasharray="6 4"
            />
            <path d="M140 100Q155 150 230 120" fill="none" stroke="#655b99" strokeWidth="3" />
          </svg>
          <div className="sketch-note note-two">
            something
            <br />
            wonderful.
          </div>
          <MousePointer2 className="art-cursor" size={30} />
        </div>
      ) : kind === 'workflow' ? (
        <div className="art-workflow">
          <div className="workflow-node">
            <FileText />
          </div>
          <span className="workflow-line" />
          <div className="workflow-node middle">
            <Zap />
          </div>
          <span className="workflow-line" />
          <div className="workflow-node">
            <Check />
          </div>
          <div className="workflow-note">less busywork. more possibilities.</div>
        </div>
      ) : kind === 'calendar' ? (
        <div className="art-calendar">
          <div>
            <CalendarDays size={18} />
            <strong>A little time, well spent.</strong>
          </div>
          <div className="calendar-grid">
            {['M', 'T', 'W', 'T', 'F', 12, 13, 14, 15, 16, 19, 20, 21, 22, 23].map((d, i) => (
              <span key={i} className={i === 12 ? 'selected' : ''}>
                {d}
              </span>
            ))}
          </div>
          <span className="calendar-badge">
            <Check size={13} /> You’re booked.
          </span>
        </div>
      ) : kind === 'photo' ? (
        <div className="art-photo">
          <div className="art-photo-toolbar">
            <span />
            <span />
            <span />
            <Image size={14} />
          </div>
          <div className="art-photo-canvas">
            <div className="sun" />
            <div className="mountain one" />
            <div className="mountain two" />
            <div className="photo-selection">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="photo-label">a fresh perspective.</div>
        </div>
      ) : kind === 'design' ? (
        <div className="art-design">
          <div className="design-circle" />
          <div className="design-square" />
          <div className="design-label">
            Room to
            <br />
            <em>create.</em>
          </div>
          <span className="design-cursor">
            <MousePointer2 size={23} /> You
          </span>
        </div>
      ) : (
        <div className="art-generic">
          <Asterisk size={85} />
          <span>{product.name}</span>
        </div>
      )}
      <span className="illustration-label">EDITORIAL ILLUSTRATION</span>
    </div>
  );
}
export function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="hero-mini mini-lilac">
        <span>IDEA NO. 024</span>
        <div className="mini-squiggle">✳</div>
        <strong>A little unexpected.</strong>
      </div>
      <div className="hero-mini mini-green">
        <span>
          <span className="live-dot" /> JUST DISCOVERED
        </span>
        <div className="mini-window">
          <div className="mini-window-top">
            <i />
            <i />
            <i />
          </div>
          <div className="mini-window-content">
            <Asterisk size={39} />
            <div>
              <b>
                Something
                <br />
                worth opening.
              </b>
              <span>Made by a person, for people.</span>
            </div>
          </div>
          <div className="mini-window-bottom">
            <span>Give it a go</span>
            <ArrowUpRight size={18} />
          </div>
        </div>
        <span className="mini-footer">Small products. Big possibilities.</span>
      </div>
      <div className="hero-stamp">
        <Asterisk size={26} />
        <span>
          GOOD FINDS
          <br />
          DAILY
        </span>
      </div>
      <div className="tiny-star">✦</div>
    </div>
  );
}

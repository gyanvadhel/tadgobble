'use client';
import { ArrowDown, Bookmark, Check, MessageCircle } from 'lucide-react';
import { Gobble } from './gobble';
import { scenes } from '../lib/intro-story.mjs';
import '../app/intro-story.css';

// Decorative pictures for each scene. The scene's real meaning lives in its heading and text.
function Art({ id, mood, first }) {
  const name = first?.name || 'your thing?';
  switch (id) {
    case 'rabbit-hole':
      return (
        <>
          <span className="art-chip" style={{ '--r': '-8deg', '--x': '4%', '--y': '8%' }}>
            40 open tabs
          </span>
          <span className="art-chip" style={{ '--r': '6deg', '--x': '58%', '--y': '4%' }}>
            12 saved reels
          </span>
          <span className="art-chip" style={{ '--r': '-4deg', '--x': '8%', '--y': '74%' }}>
            where was that app?
          </span>
          <span className="art-gobble" data-part="gobble">
            <Gobble expression={mood} />
          </span>
        </>
      );
    case 'feed':
      return (
        <>
          <span className="art-ticket" data-part="ticket">
            {name}
          </span>
          <span className="art-gobble" data-part="gobble">
            <Gobble expression={mood} />
          </span>
          <span className="art-card" data-part="card">
            <b>{first ? first.category : 'a fresh find'}</b>
            <i>A little taste before you click.</i>
          </span>
        </>
      );
    case 'stash':
      return (
        <>
          <span className="art-card art-card-big" data-part="card">
            <b>{first?.name || 'Something you will love'}</b>
            <i>peek first, then decide</i>
            <span className="art-bookmark" data-part="bookmark">
              <Bookmark size={22} />
            </span>
          </span>
          <span className="art-bubble" data-part="bubble">
            <MessageCircle size={16} /> okay, this is lovely.
          </span>
          <span className="art-gobble art-gobble-small" data-part="gobble">
            <Gobble expression={mood} />
          </span>
        </>
      );
    case 'post':
      return (
        <>
          <span className="art-ticket art-form" data-part="ticket">
            <b>A photo or video</b>
            <b>A title</b>
            <b>Your website, for apps</b>
          </span>
          <span className="art-receipt" data-part="receipt">
            <Check size={16} /> In the review queue
          </span>
        </>
      );
    default:
      return (
        <>
          <span className="art-gobble" data-part="gobble">
            <Gobble expression={mood} />
          </span>
          <ArrowDown className="art-arrow" size={44} data-part="arrow" />
        </>
      );
  }
}

export default function IntroStory({ products = [] }) {
  const first = products[0];
  return (
    <section className="intro-story" id="how-it-works" aria-labelledby="intro-story-title" data-mode="static">
      <h2 id="intro-story-title" className="sr-only">
        How tadgobble works
      </h2>
      <div className="story-stage">
        <ol className="story-scenes">
          {scenes.map((scene, i) => (
            <li key={scene.id}>
              <article className="story-scene" data-scene={scene.id} style={{ '--scene': scene.color }}>
                <div className="story-copy">
                  <span className="story-step">0{i + 1}</span>
                  <h3>{scene.title}</h3>
                  <p>{scene.body}</p>
                </div>
                <div className="story-art" aria-hidden="true">
                  <Art id={scene.id} mood={scene.mood} first={first} />
                </div>
              </article>
            </li>
          ))}
        </ol>
        <a className="story-skip" href="#fresh-picks">
          Skip the tour <ArrowDown size={16} />
        </a>
      </div>
    </section>
  );
}

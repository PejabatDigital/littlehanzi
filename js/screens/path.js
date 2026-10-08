/* 05 Level path — 8 stations on a trail.
   The Figma trail is a fixed 900x160 landscape vector. It is redrawn here
   instead so the same path can run vertically on a phone. */

import { el, Avatar, StationNode, GoBubble, RoundButton } from '../ui.js';
import * as storage from '../storage.js';
import { getLevelMeta } from '../data.js';
import { STATIONS, stationState, LEVEL_CHECK_STATION } from '../engine/path.js';
import { go } from '../app.js';

/* Fractional positions of each stop inside the path box. */
function layout(wide) {
  return Array.from({ length: STATIONS }, (_, i) => {
    if (wide) {
      return { x: (i + 0.5) / STATIONS, y: i % 2 === 0 ? 0.70 : 0.30 };
    }
    const lane = [0.26, 0.5, 0.74, 0.5][i % 4];
    return { x: lane, y: (i + 0.5) / STATIONS };
  });
}

/* A smooth curve through the stops: quadratic segments anchored at midpoints. */
function trailPath(points) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const mx = (points[i].x + points[i + 1].x) / 2;
    const my = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y} ${mx} ${my}`;
  }
  const last = points[points.length - 1];
  return `${d} L ${last.x} ${last.y}`;
}

export async function render(mount, params) {
  const profileId = await storage.getActiveProfileId();
  const profile = profileId ? await storage.getProfile(profileId) : null;
  if (!profile) { go('profiles'); return; }

  const levelId = params.level || profile.levelId || 'A1';
  const meta = await getLevelMeta(levelId);
  const progress = await storage.getProgress(profile.id, levelId);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'path__trail');
  // A 0-100 viewBox with preserveAspectRatio="none" lets the trail be written
  // in percentages, so nothing has to be measured. non-scaling-stroke keeps
  // the line an even thickness despite the non-uniform scaling.
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  const trail = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  trail.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(trail);

  // Trail and stops share an inner box. On the vertical trail that box
  // starts lower, leaving room for the Go bubble above station 1 so it
  // never sits on the player header.
  const inner = el('div', { class: 'path__inner' }, [svg]);
  const box = el('div', { class: 'path' }, [
    inner,
    el('span', { class: 'path__label', text: meta?.name || `Level ${levelId}` }),
  ]);

  const stops = [];
  for (let n = 1; n <= STATIONS; n += 1) {
    const state = stationState(n, progress);
    const kind = n === LEVEL_CHECK_STATION ? 'check' : 'station';
    const stop = el('div', { class: 'path__stop' }, [
      state === 'current' ? GoBubble() : null,
      StationNode({
        number: n, state, kind,
        onClick: () => go('station', { level: levelId, n: String(n) }),
      }),
    ]);
    stops.push(stop);
    inner.append(stop);
  }

  // Landscape tablets run the trail across; portrait and phones run it down.
  const wideQuery = window.matchMedia('(min-width: 720px) and (min-aspect-ratio: 11/10)');

  function place() {
    box.classList.toggle('path--down', !wideQuery.matches);
    const pts = layout(wideQuery.matches);
    stops.forEach((stop, i) => {
      stop.style.left = `${pts[i].x * 100}%`;
      stop.style.top = `${pts[i].y * 100}%`;
    });
    trail.setAttribute('d', trailPath(pts.map((p) => ({ x: p.x * 100, y: p.y * 100 }))));
  }

  place();
  const onChange = () => place();
  wideQuery.addEventListener('change', onChange);

  mount.append(el('div', { class: 'screen screen--scroll' }, [
    el('div', { class: 'screen__header' }, [
      el('div', { class: 'player' }, [
        Avatar({ ...profile.avatar, size: 'm' }),
        el('span', { class: 'player__name', text: profile.name }),
        el('span', { class: 'level-chip', text: levelId }),
      ]),
      el('div', { class: 'screen__header-side screen__header-side--end' }, [
        RoundButton({
          iconName: 'home', size: 'm', style: 'secondary',
          ariaLabel: 'Switch player',
          onClick: () => go('profiles'),
        }),
      ]),
    ]),
    box,
  ]));

  return () => wideQuery.removeEventListener('change', onChange);
}

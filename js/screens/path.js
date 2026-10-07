/* 05 Level path — 8 stations on a trail.
   The Figma trail is a fixed 900x160 landscape vector. It is redrawn here
   instead so the same path can run vertically on a phone. */

import { el, clear, Avatar, StationNode, GoBubble, RoundButton } from '../ui.js';
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
  svg.setAttribute('preserveAspectRatio', 'none');
  const trail = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  svg.append(trail);

  const box = el('div', { class: 'path' }, [
    svg,
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
    box.append(stop);
  }

  function place() {
    const w = box.clientWidth;
    const h = box.clientHeight;
    if (!w || !h) return;
    // Lay the trail along whichever axis is longer: across on a landscape
    // tablet, down in portrait and on a phone.
    const wide = w / h >= 1.1 && w >= 720;

    const pts = layout(wide).map((p) => ({ x: p.x * w, y: p.y * h }));
    stops.forEach((stop, i) => {
      stop.style.left = `${pts[i].x}px`;
      stop.style.top = `${pts[i].y}px`;
    });
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    trail.setAttribute('d', trailPath(pts));
  }

  const observer = new ResizeObserver(place);

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

  observer.observe(box);
  place();

  return () => observer.disconnect();
}

(() => {
  'use strict';

  const STORAGE = {
    players: 'karte-score.players.v1',
    active: 'karte-score.active.v1',
    history: 'karte-score.history.v1',
    settings: 'karte-score.settings.v1'
  };

  const RULES = {
    treseta: { label: 'Trešeta', basePoints: 11, lowWins: false, declarations: true, teams: true },
    kifameno: { label: 'Kifameno', basePoints: 11, lowWins: true, declarations: true, teams: false, kapot: -11 },
    briskula: { label: 'Briškula', basePoints: null, lowWins: false, declarations: false, teams: true, winnerPerRound: true }
  };

  const defaults = {
    settings: { theme: 'dark', haptics: true, confirmations: true }
  };

  let page = 'home';
  let setupGame = null;
  let setupSelectedPlayers = [];
  let setupTeamMode = false;
  let setupTeamA = [];
  let modalAfterClose = null;

  const app = document.getElementById('app');
  const toastEl = document.getElementById('toast');
  const modalRoot = document.getElementById('modal-root');

  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const nowIso = () => new Date().toISOString();
  const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));

  function load(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getPlayers() { return load(STORAGE.players, []); }
  function setPlayers(v) { save(STORAGE.players, v); }
  function getHistory() { return load(STORAGE.history, []); }
  function setHistory(v) { save(STORAGE.history, v); }
  function getActive() { return load(STORAGE.active, null); }
  function setActive(v) { v ? save(STORAGE.active, v) : localStorage.removeItem(STORAGE.active); }
  function getSettings() { return { ...defaults.settings, ...load(STORAGE.settings, {}) }; }
  function setSettings(v) { save(STORAGE.settings, v); applyTheme(); }

  function applyTheme() {
    const settings = getSettings();
    document.documentElement.classList.toggle('light', settings.theme === 'light');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'light' ? '#f5f5f5' : '#0c0f13');
  }

  function haptic(ms = 20) {
    if (getSettings().haptics && navigator.vibrate) navigator.vibrate(ms);
  }

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.remove('show'), 1700);
  }

  function formatDate(iso) {
    return new Intl.DateTimeFormat('hr-HR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(new Date(iso));
  }

  function playerById(id) { return getPlayers().find(p => p.id === id); }
  function pName(id) { return playerById(id)?.name || 'Igrač'; }

  function getTeamForPlayer(game, playerId) {
    return (game.teams || []).find(t => t.playerIds.includes(playerId));
  }

  function participantName(game, id) {
    if (game.teamMode) return game.teams?.find(t => t.id === id)?.name || 'Tim';
    return pName(id);
  }

  function briskulaParticipants(game) {
    return game.teamMode
      ? (game.teams || []).map(t => ({ id: t.id, name: t.name }))
      : game.playerIds.map(id => ({ id, name: pName(id) }));
  }

  function ensureDraft(game) {
    if (!game.draft) game.draft = { scores: {}, autoAssignedId: null, events: [], winnerId: null };
    if (!game.draft.scores) game.draft.scores = {};
    if (!game.draft.events) game.draft.events = [];
    if (!Object.prototype.hasOwnProperty.call(game.draft, 'winnerId')) game.draft.winnerId = null;
    return game.draft;
  }

  function allEvents(game) {
    return (game.rounds || []).flatMap(r => r.events || []);
  }

  function playerTotal(game, playerId) {
    let total = 0;
    for (const round of game.rounds || []) total += Number(round.scores?.[playerId] ?? 0);
    for (const e of allEvents(game)) {
      if (e.playerId === playerId) total += Number(e.points || 0);
    }
    return total;
  }

  function teamTotal(game, teamId) {
    const team = (game.teams || []).find(t => t.id === teamId);
    if (!team) return 0;
    let total = team.playerIds.reduce((sum, pid) => sum + playerTotal(game, pid), 0);
    for (const e of allEvents(game)) {
      if (e.teamId === teamId && !e.playerId) total += Number(e.points || 0);
    }
    return total;
  }

  function briskulaScoreboard(game) {
    const participants = briskulaParticipants(game);
    const wins = Object.fromEntries(participants.map(p => [p.id, 0]));

    for (const round of game.rounds || []) {
      if (round.winnerId && Object.prototype.hasOwnProperty.call(wins, round.winnerId)) {
        wins[round.winnerId] += 1;
      } else if (!game.teamMode && round.scores) {
        // Podrška za eventualne stare Briškula partije iz prve verzije aplikacije.
        for (const p of participants) wins[p.id] += Number(round.scores[p.id] || 0);
      }
    }

    return participants
      .map(p => ({ id: p.id, name: p.name, score: wins[p.id] || 0 }))
      .sort((a, b) => b.score - a.score);
  }

  function scoreboard(game) {
    if (game.type === 'briskula') return briskulaScoreboard(game);

    const lowWins = RULES[game.type].lowWins;
    const items = game.teamMode
      ? game.teams.map(t => ({ id: t.id, name: t.name, score: teamTotal(game, t.id) }))
      : game.playerIds.map(pid => ({ id: pid, name: pName(pid), score: playerTotal(game, pid) }));

    return items.sort((a, b) => lowWins ? a.score - b.score : b.score - a.score);
  }

  function openModal(content, afterClose = null) {
    modalAfterClose = afterClose;
    modalRoot.innerHTML = `<div class="modal-backdrop" data-modal-close="backdrop"><div class="modal" role="dialog" aria-modal="true">${content}</div></div>`;
  }

  function closeModal() {
    modalRoot.innerHTML = '';
    const fn = modalAfterClose;
    modalAfterClose = null;
    if (fn) fn();
  }

  function confirmAction(title, text, onConfirm, confirmLabel = 'Potvrdi') {
    if (!getSettings().confirmations) return onConfirm();
    openModal(`
      <h2>${esc(title)}</h2>
      <p>${esc(text)}</p>
      <div class="modal-actions">
        <button class="btn" data-modal-close="1">Odustani</button>
        <button class="btn danger" id="confirm-modal-action">${esc(confirmLabel)}</button>
      </div>
    `);
    document.getElementById('confirm-modal-action').onclick = () => {
      closeModal();
      onConfirm();
    };
  }

  function shell(content, activeNav = page) {
    return `<div class="app-shell">
      ${content}
      <nav class="bottom-nav">
        <button class="nav-btn ${activeNav === 'home' ? 'active' : ''}" data-nav="home">Početna</button>
        <button class="nav-btn ${activeNav === 'players' ? 'active' : ''}" data-nav="players">Igrači</button>
        <button class="nav-btn ${activeNav === 'history' ? 'active' : ''}" data-nav="history">Povijest</button>
        <button class="nav-btn ${activeNav === 'settings' ? 'active' : ''}" data-nav="settings">Postavke</button>
      </nav>
    </div>`;
  }

  function topbar(title, meta = '', back = null) {
    return `<div class="topbar">
      <div class="row" style="justify-content:flex-start">
        ${back ? `<button class="icon-btn" data-nav="${esc(back)}" aria-label="Natrag">←</button>` : ''}
        <div class="brand">${esc(title)}${meta ? `<small>${esc(meta)}</small>` : ''}</div>
      </div>
      ${getActive() && page !== 'game' ? `<button class="btn compact" data-nav="game">Partija</button>` : ''}
    </div>`;
  }

  function renderHome() {
    const active = getActive();
    const players = getPlayers();

    app.innerHTML = shell(`
      ${topbar('Karte Score')}

      ${active ? `<button class="btn primary full continue-btn" data-nav="game">Nastavi partiju</button>` : ''}

      <div class="section-title">Nova partija</div>
      <div class="game-grid">
        ${Object.entries(RULES).map(([key, r]) => `
          <button class="game-card" data-start-game="${key}">
            <strong>${r.label}</strong>
          </button>
        `).join('')}
      </div>

      <div class="section-title">Igrači</div>
      <div class="card row">
        <strong>${players.length} spremljenih</strong>
        <button class="btn compact" data-nav="players">Uredi</button>
      </div>
    `, 'home');
  }

  function renderPlayers() {
    const players = getPlayers();
    app.innerHTML = shell(`
      ${topbar('Igrači')}
      <div class="card">
        <form id="add-player-form" class="row">
          <input class="input" name="name" maxlength="24" placeholder="Ime igrača" autocomplete="off" />
          <button class="btn primary" type="submit">Dodaj</button>
        </form>
      </div>

      <div class="section-title">Spremljeni</div>
      ${players.length ? players.map(p => `
        <div class="card row">
          <strong>${esc(p.name)}</strong>
          <div class="row">
            <button class="btn compact" data-rename-player="${p.id}">Preimenuj</button>
            <button class="btn compact danger" data-delete-player="${p.id}">Obriši</button>
          </div>
        </div>
      `).join('') : `<div class="empty">Nema spremljenih igrača.</div>`}
    `, 'players');
  }

  function renderSetup() {
    if (!setupGame) return renderHome();

    const players = getPlayers();
    const rule = RULES[setupGame];
    const selected = setupSelectedPlayers;
    const canTeams = rule.teams && selected.length === 4;
    const validBriskulaCount = setupGame !== 'briskula' || [2, 3, 4].includes(selected.length);
    const canStart = selected.length >= 2 && validBriskulaCount && (!setupTeamMode || setupTeamA.length === 2);

    app.innerHTML = shell(`
      ${topbar(rule.label, '', 'home')}

      <div class="card">
        <strong>Odaberi igrače</strong>
        <div class="player-select" style="margin-top:14px">
          ${players.map(p => `<button class="player-chip ${selected.includes(p.id) ? 'selected' : ''}" data-setup-player="${p.id}">${esc(p.name)}</button>`).join('')}
        </div>
        ${!players.length ? `<div class="empty" style="margin-top:12px">Prvo dodaj igrače.</div><button class="btn full" data-nav="players" style="margin-top:10px">Dodaj igrače</button>` : ''}
      </div>

      ${canTeams ? `
        <div class="section-title">Način igre</div>
        <div class="card">
          <div class="action-row">
            <button class="btn ${!setupTeamMode ? 'primary' : ''}" data-team-mode="0">Pojedinačno</button>
            <button class="btn ${setupTeamMode ? 'primary' : ''}" data-team-mode="1">2 na 2</button>
          </div>
        </div>
      ` : ''}

      ${setupTeamMode && canTeams ? `
        <div class="section-title">Tim 1</div>
        <div class="card">
          <div class="player-select">
            ${selected.map(id => `<button class="player-chip ${setupTeamA.includes(id) ? 'selected' : ''}" data-team-a-player="${id}">${esc(pName(id))}</button>`).join('')}
          </div>
          ${setupTeamA.length === 2 ? `<div class="team-preview">Tim 2: ${selected.filter(id => !setupTeamA.includes(id)).map(pName).join(' + ')}</div>` : ''}
        </div>
      ` : ''}

      <div style="height:14px"></div>
      <button class="btn primary full" id="create-game" ${canStart ? '' : 'disabled'}>Započni partiju</button>
    `, '');
  }

  function createGame() {
    if (getActive()) {
      return confirmAction(
        'Aktivna partija postoji',
        'Nova partija će zamijeniti trenutno aktivnu partiju.',
        () => { setActive(null); createGame(); },
        'Nova partija'
      );
    }

    const teams = setupTeamMode ? [
      { id: uid(), name: 'Tim 1', playerIds: [...setupTeamA] },
      { id: uid(), name: 'Tim 2', playerIds: setupSelectedPlayers.filter(id => !setupTeamA.includes(id)) }
    ] : [];

    const game = {
      id: uid(),
      type: setupGame,
      playerIds: [...setupSelectedPlayers],
      teamMode: setupTeamMode,
      teams,
      rounds: [],
      draft: { scores: {}, autoAssignedId: null, events: [], winnerId: null },
      createdAt: nowIso()
    };

    setActive(game);
    page = 'game';
    setupGame = null;
    render();
    toast('Partija započeta');
  }

  function draftBaseSum(game) {
    const d = ensureDraft(game);
    return Object.values(d.scores).reduce((sum, value) => sum + Number(value || 0), 0);
  }

  function remainingPoints(game) {
    const base = RULES[game.type].basePoints;
    if (base == null) return null;
    return base - draftBaseSum(game);
  }

  function selectableMaxFor(game, playerId) {
    const base = RULES[game.type].basePoints;
    const d = ensureDraft(game);
    const otherSum = Object.entries(d.scores)
      .filter(([id]) => id !== playerId && id !== d.autoAssignedId)
      .reduce((sum, [, value]) => sum + Number(value || 0), 0);
    return Math.max(0, base - otherSum);
  }

  function setDraftScore(playerId, value) {
    const game = getActive();
    if (!game) return;
    const d = ensureDraft(game);

    if (d.autoAssignedId === playerId) {
      return toast('Ovaj rezultat je izračunat automatski.');
    }

    if (d.autoAssignedId && d.autoAssignedId !== playerId) {
      delete d.scores[d.autoAssignedId];
      d.autoAssignedId = null;
    }

    d.scores[playerId] = Number(value);

    const unset = game.playerIds.filter(id => !Object.prototype.hasOwnProperty.call(d.scores, id));
    if (unset.length === 1) {
      const remain = RULES[game.type].basePoints - draftBaseSum(game);
      d.scores[unset[0]] = Math.max(0, remain);
      d.autoAssignedId = unset[0];
    }

    setActive(game);
    haptic();
    renderGame();
  }

  function selectBriskulaWinner(winnerId) {
    const game = getActive();
    if (!game || game.type !== 'briskula') return;
    const d = ensureDraft(game);
    d.winnerId = winnerId;
    setActive(game);
    haptic();
    renderGame();
  }

  function addDraftEvent(event) {
    const game = getActive();
    if (!game) return;
    const d = ensureDraft(game);
    d.events.push({ id: uid(), createdAt: nowIso(), ...event });
    setActive(game);
    haptic();
    renderGame();
  }

  function removeDraftEvent(eventId) {
    const game = getActive();
    if (!game) return;
    const d = ensureDraft(game);
    d.events = d.events.filter(e => e.id !== eventId);
    setActive(game);
    renderGame();
  }

  function scoreEntryHtml(game, pid) {
    const d = ensureDraft(game);
    const selected = Object.prototype.hasOwnProperty.call(d.scores, pid) ? d.scores[pid] : null;
    const isAuto = d.autoAssignedId === pid;
    const max = selectableMaxFor(game, pid);
    const buttons = Array.from({ length: max + 1 }, (_, i) => i)
      .map(v => `<button class="score-btn ${selected === v ? 'selected' : ''} ${isAuto && selected === v ? 'auto' : ''}" data-score-player="${pid}" data-score-value="${v}" ${isAuto ? 'disabled' : ''}>${v}</button>`)
      .join('');

    return `<div class="score-player">
      <div class="score-header">
        <div>
          <div class="score-name">${esc(pName(pid))}</div>
          <div class="muted tiny">Ukupno ${playerTotal(game, pid)}</div>
        </div>
        <div class="big-score">${selected ?? '–'}</div>
      </div>
      <div class="score-buttons">${buttons}</div>
    </div>`;
  }

  function briskulaWinnerHtml(game) {
    const d = ensureDraft(game);
    const participants = briskulaParticipants(game);

    return `<div class="winner-grid">
      ${participants.map(p => `
        <button class="winner-btn ${d.winnerId === p.id ? 'selected' : ''}" data-briskula-winner="${p.id}">
          <span>${esc(p.name)}</span>
          <strong>${scoreboard(game).find(x => x.id === p.id)?.score || 0}</strong>
        </button>
      `).join('')}
    </div>`;
  }

  function currentScoreboardHtml(game) {
    const board = scoreboard(game);
    const label = game.type === 'briskula' ? 'pobjede' : 'bodovi';

    return `<div class="scoreboard">
      ${board.map((x, i) => `
        <div class="scoreboard-item ${i === 0 && game.rounds.length ? 'leader' : ''}">
          <div>
            <div class="name">${esc(x.name)}</div>
            <div class="muted tiny">${label}</div>
          </div>
          <div class="score">${x.score}</div>
        </div>
      `).join('')}
    </div>`;
  }

  function draftEventsHtml(game) {
    const d = ensureDraft(game);
    if (!d.events.length) return '';

    return `<div class="section-title">Dodano</div>
      ${d.events.map(e => `
        <div class="card row">
          <div>
            <strong>${esc(e.label)}</strong>
            <div class="muted tiny">${e.points > 0 ? '+' : ''}${e.points} · ${e.playerId ? esc(pName(e.playerId)) : esc(game.teams.find(t => t.id === e.teamId)?.name || '')}</div>
          </div>
          <button class="btn compact danger" data-remove-event="${e.id}">Obriši</button>
        </div>
      `).join('')}`;
  }

  function roundHistoryHtml(game) {
    const rounds = [...(game.rounds || [])].reverse();
    if (!rounds.length) return `<div class="empty">Nema spremljenih rundi.</div>`;

    return rounds.map((r, revIndex) => {
      const realIndex = game.rounds.length - 1 - revIndex;

      if (game.type === 'briskula') {
        return `<div class="history-round">
          <div class="row"><strong>Runda ${realIndex + 1}</strong><span class="muted tiny">${formatDate(r.createdAt)}</span></div>
          <div class="round-winner">${esc(participantName(game, r.winnerId))}</div>
          <div class="action-row" style="margin-top:10px">
            <button class="btn" data-edit-round="${r.id}">Uredi</button>
            <button class="btn danger" data-delete-round="${r.id}">Obriši</button>
          </div>
        </div>`;
      }

      return `<div class="history-round">
        <div class="row"><strong>Runda ${realIndex + 1}</strong><span class="muted tiny">${formatDate(r.createdAt)}</span></div>
        <div class="history-grid">${game.playerIds.map(pid => `<span>${esc(pName(pid))}</span><strong>${Number(r.scores?.[pid] ?? 0)}</strong>`).join('')}</div>
        ${(r.events || []).map(e => `<div class="history-event">${esc(e.label)} · ${e.points > 0 ? '+' : ''}${e.points}${e.playerId ? ` · ${esc(pName(e.playerId))}` : ''}</div>`).join('')}
        <div class="action-row" style="margin-top:10px">
          <button class="btn" data-edit-round="${r.id}">Uredi</button>
          <button class="btn danger" data-delete-round="${r.id}">Obriši</button>
        </div>
      </div>`;
    }).join('');
  }

  function renderGame() {
    const game = getActive();
    if (!game) {
      page = 'home';
      return renderHome();
    }

    const rule = RULES[game.type];
    const d = ensureDraft(game);
    const isBriskula = game.type === 'briskula';
    const remain = remainingPoints(game);

    const allSet = game.playerIds.every(id => Object.prototype.hasOwnProperty.call(d.scores, id));
    const validRound = isBriskula
      ? Boolean(d.winnerId)
      : allSet && draftBaseSum(game) === rule.basePoints;

    app.innerHTML = shell(`
      ${topbar(rule.label, `Runda ${(game.rounds?.length || 0) + 1}`, 'home')}
      ${currentScoreboardHtml(game)}

      ${isBriskula ? `
        <div class="section-title">Pobjednik runde</div>
        ${briskulaWinnerHtml(game)}
      ` : `
        <div class="remaining ${remain === 0 ? 'ok' : ''}">
          <span>Preostalo</span>
          <strong>${remain} / ${rule.basePoints}</strong>
        </div>
        <div>${game.playerIds.map(pid => scoreEntryHtml(game, pid)).join('')}</div>

        <div class="section-title">Dodaci</div>
        <div class="action-row">
          ${rule.declarations ? `<button class="btn" id="add-declaration">Zvanje</button>` : ''}
          <button class="btn" id="add-manual">Ručni bodovi</button>
        </div>
        ${game.type === 'kifameno' ? `<button class="btn danger full" id="add-kapot" style="margin-top:10px">Kapot -11</button>` : ''}
        ${draftEventsHtml(game)}
      `}

      <div class="section-title">Runda</div>
      <button class="btn primary full" id="save-round" ${validRound ? '' : 'disabled'}>Spremi rundu</button>
      <button class="btn ghost full" id="clear-draft" style="margin-top:8px">Očisti unos</button>

      <div class="section-title">Povijest rundi</div>
      ${roundHistoryHtml(game)}

      <div class="section-title">Partija</div>
      <div class="action-row">
        <button class="btn primary" id="finish-game">Završi partiju</button>
        <button class="btn danger" id="abandon-game">Obriši partiju</button>
      </div>
    `, '');
  }

  function saveRound() {
    const game = getActive();
    if (!game) return;
    const d = ensureDraft(game);

    if (game.type === 'briskula') {
      if (!d.winnerId) return toast('Odaberi pobjednika runde.');
      game.rounds.push({
        id: uid(),
        createdAt: nowIso(),
        winnerId: d.winnerId,
        scores: {},
        events: []
      });
    } else {
      const rule = RULES[game.type];
      const valid = game.playerIds.every(id => Object.prototype.hasOwnProperty.call(d.scores, id)) && draftBaseSum(game) === rule.basePoints;
      if (!valid) return toast('Runda nije ispravno popunjena.');
      game.rounds.push({
        id: uid(),
        createdAt: nowIso(),
        scores: { ...d.scores },
        events: [...d.events]
      });
    }

    game.draft = { scores: {}, autoAssignedId: null, events: [], winnerId: null };
    setActive(game);
    haptic(35);
    renderGame();
    toast('Runda spremljena');
  }

  function clearDraft() {
    const game = getActive();
    if (!game) return;
    game.draft = { scores: {}, autoAssignedId: null, events: [], winnerId: null };
    setActive(game);
    renderGame();
  }

  function declarationModal() {
    const game = getActive();
    if (!game) return;

    openModal(`
      <h2>Zvanje</h2>
      <p>Odaberi igrača.</p>
      <div class="option-list">
        ${game.playerIds.map(pid => `<button class="option" data-declaration-player="${pid}">${esc(pName(pid))}</button>`).join('')}
      </div>
      <button class="btn ghost full" data-modal-close="1" style="margin-top:10px">Odustani</button>
    `);
  }

  function declarationChoice(playerId) {
    openModal(`
      <h2>Zvanje · ${esc(pName(playerId))}</h2>
      <label class="field">Naziv zvanja (opcionalno)
        <input class="input" id="declaration-label" maxlength="40" placeholder="Zvanje" />
      </label>
      <div class="section-title modal-section">Bodovi</div>
      <div class="points-grid">
        ${Array.from({ length: 11 }, (_, i) => i + 1).map(points => `<button class="score-btn" data-declaration-points="${points}">+${points}</button>`).join('')}
      </div>
      <input type="hidden" id="declaration-points" value="3" />
      <div class="modal-actions">
        <button class="btn" data-modal-close="1">Odustani</button>
        <button class="btn primary" id="save-declaration" data-player="${playerId}">Dodaj +3</button>
      </div>
    `);

    const defaultBtn = document.querySelector('[data-declaration-points="3"]');
    defaultBtn?.classList.add('selected');
  }

  function manualPointsModal() {
    const game = getActive();
    if (!game) return;

    const targets = [
      ...game.playerIds.map(pid => ({ kind: 'player', id: pid, name: pName(pid) })),
      ...(game.teamMode ? game.teams.map(t => ({ kind: 'team', id: t.id, name: t.name })) : [])
    ];

    openModal(`
      <h2>Ručni bodovi</h2>
      <label class="field">Kome
        <select class="input" id="manual-target">${targets.map(t => `<option value="${t.kind}:${t.id}">${esc(t.name)}</option>`).join('')}</select>
      </label>
      <label class="field" style="margin-top:10px">Bodovi
        <input class="input" id="manual-points" type="number" inputmode="numeric" value="1" />
      </label>
      <label class="field" style="margin-top:10px">Naziv (opcionalno)
        <input class="input" id="manual-label" placeholder="Ručni bodovi" />
      </label>
      <div class="modal-actions">
        <button class="btn" data-modal-close="1">Odustani</button>
        <button class="btn primary" id="save-manual">Dodaj</button>
      </div>
    `);
  }

  function kapotModal() {
    const game = getActive();
    if (!game) return;

    openModal(`
      <h2>Kapot</h2>
      <p>Odaberi igrača.</p>
      <div class="option-list">
        ${game.playerIds.map(pid => `<button class="option" data-kapot-player="${pid}">${esc(pName(pid))}<strong style="float:right">-11</strong></button>`).join('')}
      </div>
      <button class="btn ghost full" data-modal-close="1" style="margin-top:10px">Odustani</button>
    `);
  }

  function editRound(roundId) {
    const game = getActive();
    if (!game) return;
    const idx = game.rounds.findIndex(r => r.id === roundId);
    if (idx < 0) return;

    const round = game.rounds[idx];
    const doEdit = () => {
      game.rounds.splice(idx, 1);
      game.draft = game.type === 'briskula'
        ? { scores: {}, autoAssignedId: null, events: [], winnerId: round.winnerId || null }
        : { scores: { ...round.scores }, autoAssignedId: null, events: [...(round.events || [])], winnerId: null };
      setActive(game);
      renderGame();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast('Runda vraćena u unos');
    };

    const d = ensureDraft(game);
    const hasDraft = Object.keys(d.scores).length || d.events.length || d.winnerId;
    if (hasDraft) {
      confirmAction('Zamijeniti trenutni unos?', 'Trenutni nespremljeni unos će biti zamijenjen.', doEdit, 'Uredi');
    } else {
      doEdit();
    }
  }

  function deleteRound(roundId) {
    confirmAction('Obrisati rundu?', 'Ukupni rezultat će se ponovno izračunati.', () => {
      const game = getActive();
      game.rounds = game.rounds.filter(r => r.id !== roundId);
      setActive(game);
      renderGame();
      toast('Runda obrisana');
    }, 'Obriši');
  }

  function finishGame() {
    const game = getActive();
    if (!game || !game.rounds.length) return toast('Prvo spremi barem jednu rundu.');
    const board = scoreboard(game);

    openModal(`
      <h2>Kraj partije</h2>
      <div class="scoreboard" style="margin-top:14px">
        ${board.map((x, i) => `<div class="scoreboard-item ${i === 0 ? 'leader' : ''}"><div class="name">${esc(x.name)}</div><div class="score">${x.score}</div></div>`).join('')}
      </div>
      <div class="modal-actions">
        <button class="btn" data-modal-close="1">Vrati se</button>
        <button class="btn primary" id="archive-game">Spremi i završi</button>
      </div>
    `);

    document.getElementById('archive-game').onclick = () => {
      const g = getActive();
      g.finishedAt = nowIso();
      g.finalBoard = scoreboard(g);
      const history = getHistory();
      history.unshift(g);
      setHistory(history);
      setActive(null);
      closeModal();
      page = 'history';
      render();
      toast('Partija spremljena');
    };
  }

  function renderHistory() {
    const history = getHistory();

    app.innerHTML = shell(`
      ${topbar('Povijest')}
      ${history.length ? history.map(g => {
        const winner = g.finalBoard?.[0];
        return `<div class="card history-game">
          <div class="row">
            <div>
              <strong>${esc(RULES[g.type]?.label || g.type)}</strong>
              <div class="muted tiny">${formatDate(g.finishedAt || g.createdAt)} · ${g.rounds?.length || 0} rundi</div>
            </div>
            <button class="btn compact danger" data-delete-history="${g.id}">Obriši</button>
          </div>
          ${winner ? `<div class="history-winner">${esc(winner.name)} <strong>${winner.score}</strong></div>` : ''}
          <div class="divider"></div>
          ${(g.finalBoard || []).map((x, i) => `<div class="row result-row"><span>${i + 1}. ${esc(x.name)}</span><strong>${x.score}</strong></div>`).join('')}
        </div>`;
      }).join('') : `<div class="empty">Nema završenih partija.</div>`}

      <div class="section-title">Statistika</div>
      ${statsHtml()}
    `, 'history');
  }

  function statsHtml() {
    const players = getPlayers();
    const history = getHistory();
    if (!players.length || !history.length) return `<div class="empty">Nema statistike.</div>`;

    return players.map(p => {
      const games = history.filter(g => g.playerIds?.includes(p.id));
      const wins = games.filter(g => {
        if (g.teamMode) {
          const team = (g.teams || []).find(t => t.playerIds.includes(p.id));
          return g.finalBoard?.[0]?.id === team?.id;
        }
        return g.finalBoard?.[0]?.id === p.id;
      }).length;
      const kapots = games.flatMap(g => allEvents(g)).filter(e => e.type === 'kapot' && e.playerId === p.id).length;
      const calls = games.flatMap(g => allEvents(g)).filter(e => e.type === 'declaration' && e.playerId === p.id).length;

      return `<div class="card row">
        <div>
          <strong>${esc(p.name)}</strong>
          <div class="muted tiny">${games.length} partija · ${wins} pobjeda</div>
        </div>
        <div class="tiny stats-right">Zvanja ${calls}<br>Kapot ${kapots}</div>
      </div>`;
    }).join('');
  }

  function renderSettings() {
    const s = getSettings();

    app.innerHTML = shell(`
      ${topbar('Postavke')}
      <div class="card">
        <div class="switch-row">
          <strong>Svijetla tema</strong>
          <label class="switch"><input type="checkbox" data-setting="theme" ${s.theme === 'light' ? 'checked' : ''}><span></span></label>
        </div>
        <div class="switch-row">
          <strong>Vibracija</strong>
          <label class="switch"><input type="checkbox" data-setting="haptics" ${s.haptics ? 'checked' : ''}><span></span></label>
        </div>
        <div class="switch-row">
          <strong>Potvrda prije brisanja</strong>
          <label class="switch"><input type="checkbox" data-setting="confirmations" ${s.confirmations ? 'checked' : ''}><span></span></label>
        </div>
      </div>

      <div class="section-title">Aplikacija</div>
      <button class="btn full" id="check-update">Provjeri novu verziju</button>

      <div class="section-title">Podaci</div>
      <button class="btn danger full" id="wipe-data">Obriši sve podatke</button>
    `, 'settings');
  }

  function render() {
    applyTheme();
    if (page === 'home') renderHome();
    else if (page === 'players') renderPlayers();
    else if (page === 'setup') renderSetup();
    else if (page === 'game') renderGame();
    else if (page === 'history') renderHistory();
    else if (page === 'settings') renderSettings();
    else renderHome();
  }

  document.addEventListener('click', (e) => {
    const close = e.target.closest('[data-modal-close]');
    if (close && (close.dataset.modalClose !== 'backdrop' || e.target.classList.contains('modal-backdrop'))) {
      closeModal();
      return;
    }

    const nav = e.target.closest('[data-nav]');
    if (nav) {
      page = nav.dataset.nav;
      render();
      return;
    }

    const start = e.target.closest('[data-start-game]');
    if (start) {
      setupGame = start.dataset.startGame;
      setupSelectedPlayers = [];
      setupTeamMode = false;
      setupTeamA = [];
      page = 'setup';
      render();
      return;
    }

    const setupP = e.target.closest('[data-setup-player]');
    if (setupP) {
      const id = setupP.dataset.setupPlayer;
      if (setupSelectedPlayers.includes(id)) {
        setupSelectedPlayers = setupSelectedPlayers.filter(x => x !== id);
        setupTeamA = setupTeamA.filter(x => x !== id);
      } else {
        if (setupGame === 'briskula' && setupSelectedPlayers.length >= 4) return toast('Briškula: najviše 4 igrača.');
        setupSelectedPlayers.push(id);
      }
      if (setupSelectedPlayers.length !== 4) {
        setupTeamMode = false;
        setupTeamA = [];
      }
      renderSetup();
      return;
    }

    const teamMode = e.target.closest('[data-team-mode]');
    if (teamMode) {
      setupTeamMode = teamMode.dataset.teamMode === '1';
      setupTeamA = [];
      renderSetup();
      return;
    }

    const teamAP = e.target.closest('[data-team-a-player]');
    if (teamAP) {
      const id = teamAP.dataset.teamAPlayer;
      if (setupTeamA.includes(id)) setupTeamA = setupTeamA.filter(x => x !== id);
      else if (setupTeamA.length < 2) setupTeamA.push(id);
      renderSetup();
      return;
    }

    if (e.target.closest('#create-game')) return createGame();

    const scoreBtn = e.target.closest('[data-score-player]');
    if (scoreBtn) return setDraftScore(scoreBtn.dataset.scorePlayer, Number(scoreBtn.dataset.scoreValue));

    const briskulaWinner = e.target.closest('[data-briskula-winner]');
    if (briskulaWinner) return selectBriskulaWinner(briskulaWinner.dataset.briskulaWinner);

    if (e.target.closest('#add-declaration')) return declarationModal();

    const decPlayer = e.target.closest('[data-declaration-player]');
    if (decPlayer) return declarationChoice(decPlayer.dataset.declarationPlayer);

    const decPoints = e.target.closest('[data-declaration-points]');
    if (decPoints) {
      const points = Number(decPoints.dataset.declarationPoints);
      document.getElementById('declaration-points').value = String(points);
      document.querySelectorAll('[data-declaration-points]').forEach(btn => btn.classList.remove('selected'));
      decPoints.classList.add('selected');
      const saveBtn = document.getElementById('save-declaration');
      if (saveBtn) saveBtn.textContent = `Dodaj +${points}`;
      return;
    }

    const saveDeclaration = e.target.closest('#save-declaration');
    if (saveDeclaration) {
      const playerId = saveDeclaration.dataset.player;
      const points = Number(document.getElementById('declaration-points').value);
      const customLabel = document.getElementById('declaration-label').value.trim();
      if (!Number.isFinite(points) || points <= 0) return;
      closeModal();
      addDraftEvent({
        type: 'declaration',
        playerId,
        points,
        label: customLabel || 'Zvanje'
      });
      return;
    }

    if (e.target.closest('#add-manual')) return manualPointsModal();

    const saveManual = e.target.closest('#save-manual');
    if (saveManual) {
      const [kind, id] = document.getElementById('manual-target').value.split(':');
      const points = Number(document.getElementById('manual-points').value);
      const label = document.getElementById('manual-label').value.trim() || 'Ručni bodovi';
      if (!Number.isFinite(points)) return;
      closeModal();
      addDraftEvent({ type: 'manual', points, label, ...(kind === 'player' ? { playerId: id } : { teamId: id }) });
      return;
    }

    if (e.target.closest('#add-kapot')) return kapotModal();

    const kapotP = e.target.closest('[data-kapot-player]');
    if (kapotP) {
      const pid = kapotP.dataset.kapotPlayer;
      closeModal();
      addDraftEvent({ type: 'kapot', playerId: pid, points: RULES.kifameno.kapot, label: 'Kapot' });
      return;
    }

    const removeEvent = e.target.closest('[data-remove-event]');
    if (removeEvent) return removeDraftEvent(removeEvent.dataset.removeEvent);

    if (e.target.closest('#save-round')) return saveRound();
    if (e.target.closest('#clear-draft')) return confirmAction('Očistiti unos?', 'Briše se samo nespremljeni unos trenutne runde.', clearDraft, 'Očisti');

    const editR = e.target.closest('[data-edit-round]');
    if (editR) return editRound(editR.dataset.editRound);

    const delR = e.target.closest('[data-delete-round]');
    if (delR) return deleteRound(delR.dataset.deleteRound);

    if (e.target.closest('#finish-game')) return finishGame();
    if (e.target.closest('#abandon-game')) {
      return confirmAction('Obrisati aktivnu partiju?', 'Ovo se ne može vratiti.', () => {
        setActive(null);
        page = 'home';
        render();
      }, 'Obriši');
    }

    const rename = e.target.closest('[data-rename-player]');
    if (rename) {
      const p = playerById(rename.dataset.renamePlayer);
      openModal(`
        <h2>Preimenuj igrača</h2>
        <input class="input" id="rename-input" maxlength="24" value="${esc(p?.name || '')}">
        <div class="modal-actions">
          <button class="btn" data-modal-close="1">Odustani</button>
          <button class="btn primary" id="save-rename">Spremi</button>
        </div>
      `);
      document.getElementById('save-rename').onclick = () => {
        const name = document.getElementById('rename-input').value.trim();
        if (!name) return;
        const list = getPlayers();
        const item = list.find(x => x.id === rename.dataset.renamePlayer);
        if (item) item.name = name;
        setPlayers(list);
        closeModal();
        renderPlayers();
      };
      return;
    }

    const delP = e.target.closest('[data-delete-player]');
    if (delP) {
      return confirmAction('Obrisati igrača?', 'Igrač će biti maknut iz spremljenog popisa.', () => {
        setPlayers(getPlayers().filter(p => p.id !== delP.dataset.deletePlayer));
        renderPlayers();
      }, 'Obriši');
    }

    const delH = e.target.closest('[data-delete-history]');
    if (delH) {
      return confirmAction('Obrisati zapis?', 'Briše se ova završena partija.', () => {
        setHistory(getHistory().filter(g => g.id !== delH.dataset.deleteHistory));
        renderHistory();
      }, 'Obriši');
    }

    if (e.target.closest('#check-update')) {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration()
          .then(reg => reg?.update())
          .then(() => toast('Provjera završena.'));
      } else {
        toast('Update nije dostupan.');
      }
      return;
    }

    if (e.target.closest('#wipe-data')) {
      return confirmAction('Obrisati sve podatke?', 'Brišu se igrači, aktivna partija, povijest i postavke na ovom uređaju.', () => {
        Object.values(STORAGE).forEach(k => localStorage.removeItem(k));
        page = 'home';
        applyTheme();
        render();
        toast('Podaci obrisani');
      }, 'Obriši sve');
    }
  });

  document.addEventListener('submit', (e) => {
    if (e.target.id !== 'add-player-form') return;
    e.preventDefault();

    const input = e.target.elements.name;
    const name = input.value.trim();
    if (!name) return;

    const players = getPlayers();
    players.push({ id: uid(), name, createdAt: nowIso() });
    setPlayers(players);
    input.value = '';
    renderPlayers();
    toast('Igrač dodan');
  });

  document.addEventListener('change', (e) => {
    const setting = e.target.dataset.setting;
    if (!setting) return;

    const s = getSettings();
    if (setting === 'theme') s.theme = e.target.checked ? 'light' : 'dark';
    else s[setting] = e.target.checked;
    setSettings(s);
    renderSettings();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
        await reg.update();
      } catch (err) {
        console.warn('PWA registracija nije uspjela:', err);
      }
    });
  }

  applyTheme();
  render();
})();

(() => {
  'use strict';

  const STORAGE = {
    players: 'karte-score.players.v1',
    active: 'karte-score.active.v1',
    history: 'karte-score.history.v1',
    settings: 'karte-score.settings.v1'
  };

  const RULES = {
    treseta: { label: 'Trešeta', emoji: '♣️', basePoints: 11, lowWins: false, declarations: true, teams: true },
    kifameno: { label: 'Kifameno', emoji: '💀', basePoints: 11, lowWins: true, declarations: true, teams: false, kapot: -11 },
    briskula: { label: 'Briškula', emoji: '🃏', basePoints: null, lowWins: false, declarations: false, teams: true }
  };

  const DECLARATIONS = [
    { id: 'napola-dinari', label: 'Napola dinari', points: 3 },
    { id: 'napola-kupe', label: 'Napola kupe', points: 3 },
    { id: 'napola-spade', label: 'Napola špade', points: 3 },
    { id: 'napola-bate', label: 'Napola bate', points: 3 }
  ];

  const defaults = {
    settings: { theme: 'dark', haptics: true, sound: false, confirmations: true }
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
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.theme === 'light' ? '#f4f6f8' : '#0b0e13');
  }

  function haptic(ms = 25) {
    if (getSettings().haptics && navigator.vibrate) navigator.vibrate(ms);
  }

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  function formatDate(iso) {
    return new Intl.DateTimeFormat('hr-HR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(new Date(iso));
  }

  function playerById(id) { return getPlayers().find(p => p.id === id); }
  function pName(id) { return playerById(id)?.name || 'Igrač'; }

  function activeParticipants(game) {
    return game.playerIds.map(id => playerById(id)).filter(Boolean);
  }

  function getTeamForPlayer(game, playerId) {
    return (game.teams || []).find(t => t.playerIds.includes(playerId));
  }

  function ensureDraft(game) {
    if (!game.draft) game.draft = { scores: {}, autoAssignedId: null, events: [] };
    if (!game.draft.scores) game.draft.scores = {};
    if (!game.draft.events) game.draft.events = [];
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
    const team = game.teams.find(t => t.id === teamId);
    if (!team) return 0;
    let total = team.playerIds.reduce((sum, pid) => sum + playerTotal(game, pid), 0);
    for (const e of allEvents(game)) if (e.teamId === teamId && !e.playerId) total += Number(e.points || 0);
    return total;
  }

  function scoreboard(game) {
    const lowWins = RULES[game.type].lowWins;
    const items = game.teamMode
      ? game.teams.map(t => ({ id:t.id, name:t.name, score:teamTotal(game, t.id) }))
      : game.playerIds.map(pid => ({ id:pid, name:pName(pid), score:playerTotal(game, pid) }));
    return items.sort((a,b) => lowWins ? a.score-b.score : b.score-a.score);
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

  function confirmAction(title, text, onConfirm, confirmLabel='Potvrdi') {
    if (!getSettings().confirmations) return onConfirm();
    openModal(`
      <h2>${esc(title)}</h2>
      <p>${esc(text)}</p>
      <div class="modal-actions">
        <button class="btn" data-modal-close="1">Odustani</button>
        <button class="btn danger" id="confirm-modal-action">${esc(confirmLabel)}</button>
      </div>
    `);
    document.getElementById('confirm-modal-action').onclick = () => { closeModal(); onConfirm(); };
  }

  function shell(content, activeNav = page) {
    return `<div class="app-shell">
      ${content}
      <nav class="bottom-nav">
        <button class="nav-btn ${activeNav==='home'?'active':''}" data-nav="home">⌂<br>Početna</button>
        <button class="nav-btn ${activeNav==='players'?'active':''}" data-nav="players">♟<br>Igrači</button>
        <button class="nav-btn ${activeNav==='history'?'active':''}" data-nav="history">◷<br>Povijest</button>
        <button class="nav-btn ${activeNav==='settings'?'active':''}" data-nav="settings">⚙<br>Postavke</button>
      </nav>
    </div>`;
  }

  function topbar(title, subtitle='', back=null) {
    return `<div class="topbar">
      <div class="row" style="justify-content:flex-start">
        ${back ? `<button class="icon-btn" data-nav="${esc(back)}">←</button>` : ''}
        <div class="brand">${esc(title)}${subtitle ? `<small>${esc(subtitle)}</small>` : ''}</div>
      </div>
      ${getActive() ? `<button class="icon-btn" data-nav="game" title="Aktivna partija">▶</button>` : ''}
    </div>`;
  }

  function renderHome() {
    const active = getActive();
    const players = getPlayers();
    const body = `
      ${topbar('Karte Score', 'Briškula · Trešeta · Kifameno')}
      <section class="hero">
        <h1>Bez papira.<br>Samo bodovi.</h1>
        <p>Brzi scorekeeper za ekipu. Sve se automatski sprema na ovom uređaju.</p>
      </section>

      ${active ? `<button class="btn primary full" data-nav="game">▶ Nastavi: ${esc(RULES[active.type].label)} · runda ${(active.rounds?.length||0)+1}</button>` : ''}

      <div class="section-title">Nova partija</div>
      <div class="game-grid">
        ${Object.entries(RULES).map(([key,r]) => `
          <button class="game-card" data-start-game="${key}">
            <span class="emoji">${r.emoji}</span>
            <strong>${r.label}</strong>
            <span>${key==='kifameno'?'Manje je bolje':key==='treseta'?'11 punata po rundi':'Brzi ručni unos'}</span>
          </button>`).join('')}
      </div>

      <div class="section-title">Ekipa</div>
      <div class="card row">
        <div><strong>${players.length} spremljenih igrača</strong><div class="muted tiny">Imena upisuješ samo jednom.</div></div>
        <button class="btn" data-nav="players">Uredi</button>
      </div>
    `;
    app.innerHTML = shell(body, 'home');
  }

  function renderPlayers() {
    const players = getPlayers();
    app.innerHTML = shell(`
      ${topbar('Igrači', 'Spremljeni na ovom uređaju')}
      <div class="card">
        <form id="add-player-form" class="row">
          <input class="input" name="name" maxlength="24" placeholder="Ime igrača" autocomplete="off" />
          <button class="btn primary" type="submit">Dodaj</button>
        </form>
      </div>
      <div class="section-title">Spremljeni igrači</div>
      ${players.length ? players.map(p => `
        <div class="card row">
          <div><strong>${esc(p.name)}</strong><div class="muted tiny">${getHistory().filter(g=>g.playerIds?.includes(p.id)).length} završenih partija</div></div>
          <div class="row">
            <button class="btn" data-rename-player="${p.id}">Preimenuj</button>
            <button class="btn danger" data-delete-player="${p.id}">Obriši</button>
          </div>
        </div>`).join('') : `<div class="empty">Dodaj igrače jednom i poslije ih samo odabireš.</div>`}
    `, 'players');
  }

  function renderSetup() {
    if (!setupGame) return renderHome();
    const players = getPlayers();
    const rule = RULES[setupGame];
    const selected = setupSelectedPlayers;
    const canTeams = rule.teams && selected.length === 4;
    const canStart = selected.length >= 2 && (setupGame !== 'briskula' || selected.length === 2 || selected.length === 4) && (!setupTeamMode || setupTeamA.length === 2);

    app.innerHTML = shell(`
      ${topbar(rule.label, 'Nova partija', 'home')}
      <div class="card">
        <strong>1. Odaberi igrače</strong>
        <p class="muted tiny">Za Briškulu odaberi 2 ili 4 igrača. Za ostale najmanje 2.</p>
        <div class="player-select">
          ${players.map(p => `<button class="player-chip ${selected.includes(p.id)?'selected':''}" data-setup-player="${p.id}">${esc(p.name)}</button>`).join('')}
        </div>
        ${!players.length ? `<div class="empty" style="margin-top:12px">Prvo dodaj igrače.</div><button class="btn full" data-nav="players" style="margin-top:10px">Dodaj igrače</button>` : ''}
      </div>

      ${canTeams ? `<div class="section-title">Način igre</div>
        <div class="card">
          <div class="action-row">
            <button class="btn ${!setupTeamMode?'primary':''}" data-team-mode="0">Pojedinačno</button>
            <button class="btn ${setupTeamMode?'primary':''}" data-team-mode="1">2 na 2</button>
          </div>
        </div>` : ''}

      ${setupTeamMode && canTeams ? `<div class="section-title">Tim 1 — odaberi 2 igrača</div>
        <div class="card"><div class="player-select">
          ${selected.map(id => `<button class="player-chip ${setupTeamA.includes(id)?'selected':''}" data-team-a-player="${id}">${esc(pName(id))}</button>`).join('')}
        </div>
        <div class="divider"></div>
        <div class="muted tiny">Tim 2 će automatski biti: ${selected.filter(id=>!setupTeamA.includes(id)).map(pName).join(' + ') || '—'}</div>
        </div>` : ''}

      <div style="height:14px"></div>
      <button class="btn primary full" id="create-game" ${canStart?'':'disabled'}>Započni partiju</button>
    `, '');
  }

  function createGame() {
    if (getActive()) {
      return confirmAction('Aktivna partija postoji', 'Pokretanjem nove partije obrisat ćeš trenutno aktivnu nezavršenu partiju.', () => {
        setActive(null); createGame();
      }, 'Pokreni novu');
    }
    const teams = setupTeamMode ? [
      { id:uid(), name:'Tim 1', playerIds:[...setupTeamA] },
      { id:uid(), name:'Tim 2', playerIds:setupSelectedPlayers.filter(id=>!setupTeamA.includes(id)) }
    ] : [];
    const game = {
      id: uid(),
      type: setupGame,
      playerIds: [...setupSelectedPlayers],
      teamMode: setupTeamMode,
      teams,
      rounds: [],
      draft: { scores:{}, autoAssignedId:null, events:[] },
      createdAt: nowIso()
    };
    setActive(game);
    page = 'game';
    setupGame = null;
    render();
    toast('Partija je započela');
  }

  function draftBaseSum(game) {
    const d = ensureDraft(game);
    return Object.values(d.scores).reduce((s,v) => s + Number(v || 0), 0);
  }

  function remainingPoints(game) {
    const base = RULES[game.type].basePoints;
    if (base == null) return null;
    return base - draftBaseSum(game);
  }

  function selectableMaxFor(game, playerId) {
    const base = RULES[game.type].basePoints;
    const d = ensureDraft(game);
    // Ako je zadnji igrac bio automatski popunjen, njegov rezultat nije
    // ogranicenje za promjenu ranijeg igraca: pri promjeni se on ponovno izracuna.
    const otherSum = Object.entries(d.scores)
      .filter(([id]) => id !== playerId && id !== d.autoAssignedId)
      .reduce((s,[,v]) => s + Number(v||0), 0);
    return Math.max(0, base - otherSum);
  }

  function setDraftScore(playerId, value) {
    const game = getActive();
    if (!game) return;
    const d = ensureDraft(game);

    if (d.autoAssignedId === playerId) return toast('Ovaj rezultat je automatski izračunat. Promijeni neki prethodni unos.');
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

  function addDraftEvent(event) {
    const game = getActive();
    const d = ensureDraft(game);
    d.events.push({ id:uid(), createdAt:nowIso(), ...event });
    setActive(game);
    haptic();
    renderGame();
  }

  function removeDraftEvent(eventId) {
    const game = getActive();
    const d = ensureDraft(game);
    d.events = d.events.filter(e=>e.id!==eventId);
    setActive(game);
    renderGame();
  }

  function scoreEntryHtml(game, pid) {
    const d = ensureDraft(game);
    const selected = Object.prototype.hasOwnProperty.call(d.scores, pid) ? d.scores[pid] : null;
    const isAuto = d.autoAssignedId === pid;
    const max = selectableMaxFor(game, pid);
    const buttons = Array.from({length:max+1},(_,i)=>i).map(v=>`<button class="score-btn ${selected===v?'selected':''} ${isAuto && selected===v?'auto':''}" data-score-player="${pid}" data-score-value="${v}" ${isAuto?'disabled':''}>${v}</button>`).join('');
    return `<div class="score-player">
      <div class="score-header">
        <div><div class="score-name">${esc(pName(pid))}</div><div class="muted tiny">Ukupno: ${playerTotal(game,pid)}${isAuto?' · automatski':''}</div></div>
        <div class="big-score">${selected ?? '–'}</div>
      </div>
      <div class="score-buttons">${buttons}</div>
    </div>`;
  }

  function briskulaEntryHtml(game, pid) {
    const d = ensureDraft(game);
    const value = Object.prototype.hasOwnProperty.call(d.scores,pid) ? d.scores[pid] : '';
    return `<div class="score-player">
      <div class="score-header"><div><div class="score-name">${esc(pName(pid))}</div><div class="muted tiny">Ukupno: ${playerTotal(game,pid)}</div></div></div>
      <input class="input" type="number" inputmode="numeric" min="-99" max="999" placeholder="Bodovi ove runde" value="${value}" data-briskula-score="${pid}" />
    </div>`;
  }

  function currentScoreboardHtml(game) {
    const board = scoreboard(game);
    return `<div class="scoreboard">${board.map((x,i)=>`<div class="scoreboard-item ${i===0 && game.rounds.length?'leader':''}"><div><div class="name">${i===0 && game.rounds.length?'🥇 ':''}${esc(x.name)}</div><div class="muted tiny">${RULES[game.type].lowWins?'manje je bolje':'ukupno'}</div></div><div class="score">${x.score}</div></div>`).join('')}</div>`;
  }

  function draftEventsHtml(game) {
    const d = ensureDraft(game);
    if (!d.events.length) return '';
    return `<div class="section-title">Dodano ovoj rundi</div>${d.events.map(e=>`<div class="card row"><div><strong>${esc(e.label)}</strong><div class="muted tiny">${e.points>0?'+':''}${e.points} · ${e.playerId?esc(pName(e.playerId)):esc(game.teams.find(t=>t.id===e.teamId)?.name||'')}</div></div><button class="btn danger" data-remove-event="${e.id}">×</button></div>`).join('')}`;
  }

  function roundHistoryHtml(game) {
    const rounds = [...(game.rounds||[])].reverse();
    if (!rounds.length) return `<div class="empty">Još nema spremljenih rundi.</div>`;
    return rounds.map((r,revIndex)=>{
      const realIndex = game.rounds.length - 1 - revIndex;
      return `<div class="history-round">
        <div class="row"><strong>Runda ${realIndex+1}</strong><span class="muted tiny">${formatDate(r.createdAt)}</span></div>
        <div class="history-grid">${game.playerIds.map(pid=>`<span>${esc(pName(pid))}</span><strong>${Number(r.scores?.[pid]??0)}</strong>`).join('')}</div>
        ${(r.events||[]).map(e=>`<div class="history-event">${esc(e.label)} · ${e.points>0?'+':''}${e.points}${e.playerId?` · ${esc(pName(e.playerId))}`:''}</div>`).join('')}
        <div class="action-row" style="margin-top:10px"><button class="btn" data-edit-round="${r.id}">Uredi</button><button class="btn danger" data-delete-round="${r.id}">Obriši</button></div>
      </div>`;
    }).join('');
  }

  function renderGame() {
    const game = getActive();
    if (!game) { page='home'; return renderHome(); }
    const rule = RULES[game.type];
    const d = ensureDraft(game);
    const base = rule.basePoints;
    const remain = remainingPoints(game);
    const allSet = game.playerIds.every(id => Object.prototype.hasOwnProperty.call(d.scores,id));
    const validBase = base == null
      ? game.playerIds.every(id => Object.prototype.hasOwnProperty.call(d.scores,id) && Number.isFinite(Number(d.scores[id])))
      : allSet && draftBaseSum(game) === base;

    app.innerHTML = shell(`
      ${topbar(rule.label, `Runda ${(game.rounds?.length||0)+1}`, 'home')}
      ${currentScoreboardHtml(game)}

      ${base != null ? `<div class="remaining ${remain===0?'ok':''}"><span>Preostalo</span><strong>${remain} / ${base}</strong></div>` : `<div class="section-title">Unos nove runde</div>`}

      <div>
        ${game.playerIds.map(pid => base != null ? scoreEntryHtml(game,pid) : briskulaEntryHtml(game,pid)).join('')}
      </div>

      ${rule.declarations ? `<div class="section-title">Dodaci</div><div class="action-row"><button class="btn secondary" id="add-declaration">+ Zvanje</button><button class="btn" id="add-manual">± Ručni bodovi</button></div>` : `<div class="section-title">Dodaci</div><button class="btn full" id="add-manual">± Ručni bodovi</button>`}
      ${game.type==='kifameno' ? `<button class="btn danger full" id="add-kapot" style="margin-top:10px">🔥 KAPOT (-11)</button>` : ''}

      ${draftEventsHtml(game)}

      <div class="section-title">Runda</div>
      <button class="btn primary full" id="save-round" ${validBase?'':'disabled'}>Spremi rundu</button>
      <button class="btn ghost full" id="clear-draft" style="margin-top:8px">Očisti unos runde</button>

      <div class="section-title">Povijest rundi</div>
      ${roundHistoryHtml(game)}

      <div class="section-title">Partija</div>
      <div class="action-row"><button class="btn primary" id="finish-game">Završi partiju</button><button class="btn danger" id="abandon-game">Obriši partiju</button></div>
    `, '');

    document.querySelectorAll('[data-briskula-score]').forEach(input => {
      input.addEventListener('input', e => {
        const g = getActive();
        const draft = ensureDraft(g);
        const raw = e.target.value;
        if (raw === '') delete draft.scores[e.target.dataset.briskulaScore];
        else draft.scores[e.target.dataset.briskulaScore] = Number(raw);
        setActive(g);
        const saveBtn = document.getElementById('save-round');
        if (saveBtn) saveBtn.disabled = !g.playerIds.every(id => Object.prototype.hasOwnProperty.call(draft.scores,id));
      });
    });
  }

  function saveRound() {
    const game = getActive();
    if (!game) return;
    const d = ensureDraft(game);
    const rule = RULES[game.type];
    const valid = rule.basePoints == null
      ? game.playerIds.every(id => Object.prototype.hasOwnProperty.call(d.scores,id))
      : game.playerIds.every(id => Object.prototype.hasOwnProperty.call(d.scores,id)) && draftBaseSum(game) === rule.basePoints;
    if (!valid) return toast('Runda nije ispravno popunjena.');
    game.rounds.push({ id:uid(), createdAt:nowIso(), scores:{...d.scores}, events:[...d.events] });
    game.draft = { scores:{}, autoAssignedId:null, events:[] };
    setActive(game);
    haptic(40);
    renderGame();
    toast('Runda spremljena');
  }

  function clearDraft() {
    const game = getActive();
    game.draft = { scores:{}, autoAssignedId:null, events:[] };
    setActive(game);
    renderGame();
  }

  function declarationModal() {
    const game = getActive();
    openModal(`
      <h2>+ Zvanje</h2><p>Tko je zvao?</p>
      <div class="option-list">${game.playerIds.map(pid=>`<button class="option" data-declaration-player="${pid}">${esc(pName(pid))}${game.teamMode?` · ${esc(getTeamForPlayer(game,pid)?.name||'')}`:''}</button>`).join('')}</div>
      <button class="btn ghost full" data-modal-close="1" style="margin-top:10px">Odustani</button>
    `);
  }

  function declarationChoice(playerId) {
    openModal(`
      <h2>${esc(pName(playerId))}</h2><p>Odaberi zvanje</p>
      <div class="option-list">
        ${DECLARATIONS.map(d=>`<button class="option" data-declaration-choice="${d.id}" data-player="${playerId}">${esc(d.label)} <strong style="float:right">+${d.points}</strong></button>`).join('')}
        <button class="option" data-custom-declaration="${playerId}">Drugo / ručni iznos</button>
      </div>
      <button class="btn ghost full" data-modal-close="1" style="margin-top:10px">Odustani</button>
    `);
  }

  function customDeclaration(playerId) {
    openModal(`
      <h2>Drugo zvanje</h2>
      <label class="field">Naziv<input class="input" id="custom-dec-label" placeholder="npr. Zvanje" /></label>
      <label class="field" style="margin-top:10px">Bodovi<input class="input" id="custom-dec-points" type="number" inputmode="numeric" value="3" /></label>
      <div class="modal-actions"><button class="btn" data-modal-close="1">Odustani</button><button class="btn primary" id="save-custom-dec">Dodaj</button></div>
    `);
    document.getElementById('save-custom-dec').onclick = () => {
      const label = document.getElementById('custom-dec-label').value.trim() || 'Zvanje';
      const points = Number(document.getElementById('custom-dec-points').value);
      if (!Number.isFinite(points)) return;
      closeModal();
      addDraftEvent({ type:'declaration', playerId, points, label });
    };
  }

  function manualPointsModal() {
    const game = getActive();
    const targets = [
      ...game.playerIds.map(pid=>({kind:'player',id:pid,name:pName(pid)})),
      ...(game.teamMode ? game.teams.map(t=>({kind:'team',id:t.id,name:t.name})) : [])
    ];
    openModal(`
      <h2>± Ručni bodovi</h2>
      <label class="field">Kome<select class="input" id="manual-target">${targets.map(t=>`<option value="${t.kind}:${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
      <label class="field" style="margin-top:10px">Bodovi<input class="input" id="manual-points" type="number" inputmode="numeric" value="1" /></label>
      <label class="field" style="margin-top:10px">Razlog<input class="input" id="manual-label" placeholder="npr. Bonus / kazna" /></label>
      <div class="modal-actions"><button class="btn" data-modal-close="1">Odustani</button><button class="btn primary" id="save-manual">Dodaj</button></div>
    `);
    document.getElementById('save-manual').onclick = () => {
      const [kind,id] = document.getElementById('manual-target').value.split(':');
      const points = Number(document.getElementById('manual-points').value);
      const label = document.getElementById('manual-label').value.trim() || 'Ručni bodovi';
      if (!Number.isFinite(points)) return;
      closeModal();
      addDraftEvent({ type:'manual', points, label, ...(kind==='player'?{playerId:id}:{teamId:id}) });
    };
  }

  function kapotModal() {
    const game = getActive();
    openModal(`
      <h2>🔥 KAPOT</h2><p>Tko je napravio kapot? Igraču će se dodati -11.</p>
      <div class="option-list">${game.playerIds.map(pid=>`<button class="option" data-kapot-player="${pid}">${esc(pName(pid))}<strong style="float:right">-11</strong></button>`).join('')}</div>
      <button class="btn ghost full" data-modal-close="1" style="margin-top:10px">Odustani</button>
    `);
  }

  function editRound(roundId) {
    const game = getActive();
    const idx = game.rounds.findIndex(r=>r.id===roundId);
    if (idx < 0) return;
    const round = game.rounds[idx];
    const doEdit = () => {
      game.rounds.splice(idx,1);
      game.draft = { scores:{...round.scores}, autoAssignedId:null, events:[...(round.events||[])] };
      setActive(game);
      renderGame();
      window.scrollTo({top:0, behavior:'smooth'});
      toast('Runda je vraćena u unos');
    };
    const d = ensureDraft(game);
    if (Object.keys(d.scores).length || d.events.length) {
      confirmAction('Zamijeniti trenutni unos?', 'Trenutni nespremljeni unos runde bit će zamijenjen odabranom rundom.', doEdit, 'Uredi rundu');
    } else doEdit();
  }

  function deleteRound(roundId) {
    confirmAction('Obrisati rundu?', 'Ukupni rezultat će se automatski ponovno izračunati.', () => {
      const game = getActive();
      game.rounds = game.rounds.filter(r=>r.id!==roundId);
      setActive(game); renderGame(); toast('Runda obrisana');
    }, 'Obriši');
  }

  function finishGame() {
    const game = getActive();
    if (!game || !game.rounds.length) return toast('Prvo spremi barem jednu rundu.');
    const board = scoreboard(game);
    openModal(`
      <h2>🏆 Kraj partije</h2>
      <p>${esc(RULES[game.type].label)} · ${game.rounds.length} rundi</p>
      <div class="scoreboard">${board.map((x,i)=>`<div class="scoreboard-item ${i===0?'leader':''}"><div class="name">${i===0?'🥇 ':''}${esc(x.name)}</div><div class="score">${x.score}</div></div>`).join('')}</div>
      <div class="modal-actions"><button class="btn" data-modal-close="1">Vrati se</button><button class="btn primary" id="archive-game">Spremi i završi</button></div>
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
      page='history';
      render();
      toast('Partija spremljena u povijest');
    };
  }

  function renderHistory() {
    const history = getHistory();
    app.innerHTML = shell(`
      ${topbar('Povijest', 'Završene partije')}
      ${history.length ? history.map(g=>{
        const winner = g.finalBoard?.[0];
        return `<div class="card">
          <div class="row"><div><span class="pill">${RULES[g.type]?.emoji||'🃏'} ${esc(RULES[g.type]?.label||g.type)}</span><h3 style="margin:10px 0 3px">${winner?`🏆 ${esc(winner.name)}`:'Završena partija'}</h3><div class="muted tiny">${formatDate(g.finishedAt||g.createdAt)} · ${g.rounds?.length||0} rundi</div></div><button class="btn danger" data-delete-history="${g.id}">Obriši</button></div>
          <div class="divider"></div>
          ${(g.finalBoard||[]).map((x,i)=>`<div class="row"><span>${i+1}. ${esc(x.name)}</span><strong>${x.score}</strong></div>`).join('')}
        </div>`;
      }).join('') : `<div class="empty">Kad završiš partiju, ovdje će ostati rezultat i pobjednik.</div>`}

      <div class="section-title">Statistika</div>
      ${statsHtml()}
    `, 'history');
  }

  function statsHtml() {
    const players = getPlayers();
    const history = getHistory();
    if (!players.length || !history.length) return `<div class="empty">Statistika će se pojaviti nakon prvih završenih partija.</div>`;
    return players.map(p=>{
      const games = history.filter(g=>g.playerIds?.includes(p.id));
      const wins = games.filter(g=>{
        if (g.teamMode) {
          const team = (g.teams||[]).find(t=>t.playerIds.includes(p.id));
          return g.finalBoard?.[0]?.id === team?.id;
        }
        return g.finalBoard?.[0]?.id === p.id;
      }).length;
      const kapots = games.flatMap(g=>allEvents(g)).filter(e=>e.type==='kapot' && e.playerId===p.id).length;
      const calls = games.flatMap(g=>allEvents(g)).filter(e=>e.type==='declaration' && e.playerId===p.id).length;
      return `<div class="card row"><div><strong>${esc(p.name)}</strong><div class="muted tiny">${games.length} partija · ${wins} pobjeda · ${games.length?Math.round(wins/games.length*100):0}%</div></div><div class="tiny" style="text-align:right">Zvanja: <strong>${calls}</strong><br>Kapot: <strong>${kapots}</strong></div></div>`;
    }).join('');
  }

  function renderSettings() {
    const s = getSettings();
    app.innerHTML = shell(`
      ${topbar('Postavke', 'Aplikacija i podaci')}
      <div class="card">
        <div class="switch-row"><div><strong>Svijetla tema</strong><div class="muted tiny">Inače je tamna.</div></div><label class="switch"><input type="checkbox" data-setting="theme" ${s.theme==='light'?'checked':''}><span></span></label></div>
        <div class="switch-row"><div><strong>Vibracija</strong><div class="muted tiny">Kratka potvrda kod unosa.</div></div><label class="switch"><input type="checkbox" data-setting="haptics" ${s.haptics?'checked':''}><span></span></label></div>
        <div class="switch-row"><div><strong>Potvrde brisanja</strong><div class="muted tiny">Štiti od slučajnog brisanja.</div></div><label class="switch"><input type="checkbox" data-setting="confirmations" ${s.confirmations?'checked':''}><span></span></label></div>
      </div>
      <div class="section-title">Pravila</div>
      <div class="card stack">
        <div class="row"><span>Trešeta</span><strong>11 bodova / runda</strong></div>
        <div class="row"><span>Kifameno</span><strong>11 bodova · manje je bolje</strong></div>
        <div class="row"><span>Kapot</span><strong>-11</strong></div>
        <div class="row"><span>Zvanje “napola”</span><strong>+3</strong></div>
      </div>
      <div class="section-title">Ažuriranja</div>
      <div class="card"><strong>Automatski update je uključen</strong><p class="muted tiny">Kad objaviš novu verziju na GitHub Pagesu, aplikacija će pri sljedećem online otvaranju uzeti novi kod. Ne moraš je ponovno dodavati na Home Screen.</p><button class="btn full" id="check-update">Provjeri update sada</button></div>
      <div class="section-title">Podaci</div>
      <button class="btn danger full" id="wipe-data">Obriši sve lokalne podatke</button>
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
    if (close && (close.dataset.modalClose !== 'backdrop' || e.target.classList.contains('modal-backdrop'))) return closeModal();

    const nav = e.target.closest('[data-nav]');
    if (nav) { page = nav.dataset.nav; render(); return; }

    const start = e.target.closest('[data-start-game]');
    if (start) {
      setupGame = start.dataset.startGame;
      setupSelectedPlayers = [];
      setupTeamMode = false;
      setupTeamA = [];
      page = 'setup'; render(); return;
    }

    const setupP = e.target.closest('[data-setup-player]');
    if (setupP) {
      const id = setupP.dataset.setupPlayer;
      if (setupSelectedPlayers.includes(id)) {
        setupSelectedPlayers = setupSelectedPlayers.filter(x=>x!==id);
        setupTeamA = setupTeamA.filter(x=>x!==id);
      } else setupSelectedPlayers.push(id);
      if (setupSelectedPlayers.length !== 4) { setupTeamMode=false; setupTeamA=[]; }
      renderSetup(); return;
    }

    const teamMode = e.target.closest('[data-team-mode]');
    if (teamMode) { setupTeamMode = teamMode.dataset.teamMode === '1'; setupTeamA=[]; renderSetup(); return; }

    const teamAP = e.target.closest('[data-team-a-player]');
    if (teamAP) {
      const id = teamAP.dataset.teamAPlayer;
      if (setupTeamA.includes(id)) setupTeamA = setupTeamA.filter(x=>x!==id);
      else if (setupTeamA.length < 2) setupTeamA.push(id);
      renderSetup(); return;
    }

    if (e.target.closest('#create-game')) return createGame();

    const scoreBtn = e.target.closest('[data-score-player]');
    if (scoreBtn) return setDraftScore(scoreBtn.dataset.scorePlayer, Number(scoreBtn.dataset.scoreValue));

    if (e.target.closest('#add-declaration')) return declarationModal();
    const decPlayer = e.target.closest('[data-declaration-player]');
    if (decPlayer) return declarationChoice(decPlayer.dataset.declarationPlayer);
    const decChoice = e.target.closest('[data-declaration-choice]');
    if (decChoice) {
      const dec = DECLARATIONS.find(d=>d.id===decChoice.dataset.declarationChoice);
      closeModal();
      if (dec) addDraftEvent({ type:'declaration', playerId:decChoice.dataset.player, points:dec.points, label:dec.label });
      return;
    }
    const customDec = e.target.closest('[data-custom-declaration]');
    if (customDec) return customDeclaration(customDec.dataset.customDeclaration);

    if (e.target.closest('#add-manual')) return manualPointsModal();
    if (e.target.closest('#add-kapot')) return kapotModal();
    const kapotP = e.target.closest('[data-kapot-player]');
    if (kapotP) {
      const pid = kapotP.dataset.kapotPlayer;
      closeModal();
      addDraftEvent({ type:'kapot', playerId:pid, points:RULES.kifameno.kapot, label:'🔥 KAPOT' });
      return;
    }

    const removeEvent = e.target.closest('[data-remove-event]');
    if (removeEvent) return removeDraftEvent(removeEvent.dataset.removeEvent);
    if (e.target.closest('#save-round')) return saveRound();
    if (e.target.closest('#clear-draft')) return confirmAction('Očistiti unos?', 'Brišu se samo nespremljeni bodovi trenutne runde.', clearDraft, 'Očisti');

    const editR = e.target.closest('[data-edit-round]');
    if (editR) return editRound(editR.dataset.editRound);
    const delR = e.target.closest('[data-delete-round]');
    if (delR) return deleteRound(delR.dataset.deleteRound);

    if (e.target.closest('#finish-game')) return finishGame();
    if (e.target.closest('#abandon-game')) return confirmAction('Obrisati aktivnu partiju?', 'Ovo se ne može vratiti.', () => { setActive(null); page='home'; render(); }, 'Obriši');

    const rename = e.target.closest('[data-rename-player]');
    if (rename) {
      const p = playerById(rename.dataset.renamePlayer);
      openModal(`<h2>Preimenuj igrača</h2><input class="input" id="rename-input" maxlength="24" value="${esc(p?.name||'')}"><div class="modal-actions"><button class="btn" data-modal-close="1">Odustani</button><button class="btn primary" id="save-rename">Spremi</button></div>`);
      document.getElementById('save-rename').onclick = () => {
        const name = document.getElementById('rename-input').value.trim();
        if (!name) return;
        const list=getPlayers(); const item=list.find(x=>x.id===rename.dataset.renamePlayer); if(item)item.name=name; setPlayers(list); closeModal(); renderPlayers();
      };
      return;
    }

    const delP = e.target.closest('[data-delete-player]');
    if (delP) return confirmAction('Obrisati igrača?', 'Stare završene partije ostaju spremljene, ali ime možda neće biti dostupno za nove prikaze.', () => { setPlayers(getPlayers().filter(p=>p.id!==delP.dataset.deletePlayer)); renderPlayers(); }, 'Obriši');

    const delH = e.target.closest('[data-delete-history]');
    if (delH) return confirmAction('Obrisati zapis?', 'Briše se ova završena partija iz povijesti.', () => { setHistory(getHistory().filter(g=>g.id!==delH.dataset.deleteHistory)); renderHistory(); }, 'Obriši');

    if (e.target.closest('#check-update')) {
      if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration().then(reg => reg?.update()).then(()=>toast('Provjera završena — najnovija verzija će se učitati pri otvaranju.'));
      else toast('Service worker nije dostupan.');
      return;
    }

    if (e.target.closest('#wipe-data')) return confirmAction('Obrisati SVE?', 'Brišu se igrači, aktivna partija, povijest i postavke na ovom uređaju.', () => {
      Object.values(STORAGE).forEach(k=>localStorage.removeItem(k));
      page='home'; applyTheme(); render(); toast('Podaci su obrisani');
    }, 'Obriši sve');
  });

  document.addEventListener('submit', (e) => {
    if (e.target.id === 'add-player-form') {
      e.preventDefault();
      const input = e.target.elements.name;
      const name = input.value.trim();
      if (!name) return;
      const players = getPlayers();
      players.push({ id:uid(), name, createdAt:nowIso() });
      setPlayers(players);
      input.value='';
      renderPlayers();
      toast('Igrač dodan');
    }
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

  // PWA: uvijek provjeri postoji li novija verzija service workera.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache:'none' });
        await reg.update();
      } catch (err) {
        console.warn('PWA registracija nije uspjela:', err);
      }
    });
  }

  applyTheme();
  render();
})();

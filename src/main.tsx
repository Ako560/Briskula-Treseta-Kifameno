import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import { generateBoard, rollDice, type Board, type Terrain } from "./engine";
import { load, save, remove, type Game, type Player } from "./storage";
import { tr, type Lang } from "./i18n";
type Screen =
  | "home"
  | "generator"
  | "board"
  | "setup"
  | "game"
  | "modes"
  | "stats"
  | "saved"
  | "settings"
  | "history";
const terrainMeta: Record<Terrain, [string, string, string]> = {
  forest: ["Forest", "Wood", "♠"],
  pasture: ["Pasture", "Sheep", "◌"],
  fields: ["Fields", "Wheat", "≋"],
  hills: ["Hills", "Brick", "▰"],
  mountains: ["Mountains", "Ore", "▲"],
  desert: ["Desert", "No production", "☀"],
};
function BoardView({ board, zoom = 1 }: { board: Board; zoom?: number }) {
  const size = board.type === "standard" ? 38 : 32;
  const pts = "0,-1 .866,-.5 .866,.5 0,1 -.866,.5 -.866,-.5";
  const positions = board.tiles.map((t) => ({
    t,
    x: Math.sqrt(3) * (t.q + t.r / 2) * size,
    y: 1.5 * t.r * size,
  }));
  const minX = Math.min(...positions.map((p) => p.x)) - size * 1.4,
    maxX = Math.max(...positions.map((p) => p.x)) + size * 1.4,
    minY = Math.min(...positions.map((p) => p.y)) - size * 1.4,
    maxY = Math.max(...positions.map((p) => p.y)) + size * 1.4;
  return (
    <div className="board-scroll">
      <svg
        className="board"
        style={{ transform: `scale(${zoom})` }}
        viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
        role="img"
        aria-label={`${board.type} island board`}
      >
        <defs>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity=".35" />
          </filter>
        </defs>
        {positions.map(({ t, x, y }) => (
          <g
            key={`${t.q},${t.r}`}
            transform={`translate(${x} ${y})`}
            className={`tile ${t.terrain}`}
          >
            <polygon
              points={pts
                .split(" ")
                .map((p) =>
                  p
                    .split(",")
                    .map(Number)
                    .map((n) => n * size)
                    .join(","),
                )
                .join(" ")}
              filter="url(#shadow)"
            />
            <text className="terrain-icon" y="-7">
              {terrainMeta[t.terrain][2]}
            </text>
            {t.number && (
              <g>
                <circle r="13" cy="11" />
                <text className={[6, 8].includes(t.number) ? "hot" : ""} y="15">
                  {t.number}
                </text>
                <text className="dots" y="23">
                  {"•".repeat(
                    (
                      {
                        2: 1,
                        3: 2,
                        4: 3,
                        5: 4,
                        6: 5,
                        8: 5,
                        9: 4,
                        10: 3,
                        11: 2,
                        12: 1,
                      } as Record<number, number>
                    )[t.number],
                  )}
                </text>
              </g>
            )}
            <title>
              {terrainMeta[t.terrain][0]} · {terrainMeta[t.terrain][1]}{" "}
              {t.number ? `· ${t.number}` : ""}
            </title>
          </g>
        ))}
      </svg>
    </div>
  );
}
function App() {
  const [lang, setLang] = useState<Lang>(
    () => (load("settings", { lang: "en" }).lang as Lang) || "en",
  );
  const T = tr[lang];
  const [screen, setScreen] = useState<Screen>("home");
  const [board, setBoard] = useState<Board | null>(null);
  const [history, setHistory] = useState<Board[]>([]);
  const [game, setGame] = useState<Game | null>(() =>
    load("currentGame", null),
  );
  const [saved, setSaved] = useState<(Board & { name?: string })[]>(() =>
    load("savedBoards", []),
  );
  const [zoom, setZoom] = useState(1);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const f = () => setOnline(navigator.onLine);
    addEventListener("online", f);
    addEventListener("offline", f);
    return () => {
      removeEventListener("online", f);
      removeEventListener("offline", f);
    };
  }, []);
  useEffect(() => {
    if (game) save("currentGame", game);
  }, [game]);
  const nav = (s: Screen) => (setScreen(s), scrollTo(0, 0));
  const newBoard = (type: Board["type"], seed?: string) => {
    try {
      const b = generateBoard(type, seed);
      if (board) setHistory((h) => [board, ...h].slice(0, 10));
      setBoard(b);
      nav("board");
    } catch {
      alert("Couldn't generate a valid board. Try again.");
    }
  };
  const Home = () => (
    <main className="home">
      <section className="hero">
        <span className="eyebrow">HEX-BASED TABLETOP TOOLKIT</span>
        <h1>
          HEX<span>MATE</span>
        </h1>
          <p>{T.tagline}</p>
        <small>{T.subtitle}</small>
      </section>
      <section className="menu">
        <button className="primary" onClick={() => nav("generator")}>
          <b>⬡</b>
          <span>
            {T.generate}
            <small>Legal, balanced, seeded</small>
          </span>
        </button>
        <button onClick={() => (board ? nav("setup") : nav("generator"))}>
          <b>◷</b>
          <span>
            {T.start}
            <small>Players, timer & dice</small>
          </span>
        </button>
        <button onClick={() => nav("modes")}>
          <b>✦</b>
          <span>
            {T.modes}
            <small>Unofficial house rules</small>
          </span>
        </button>
        <button onClick={() => nav("stats")}>
          <b>▥</b>
          <span>
            {T.stats}
            <small>Roll distribution</small>
          </span>
        </button>
        <button disabled={!game} onClick={() => game && nav("game")}>
          <b>↻</b>
          <span>
            {T.continue}
            <small>
              {game ? "Game saved on this device" : "No active game"}
            </small>
          </span>
        </button>
        <button onClick={() => nav("saved")}>
          <b>★</b>
          <span>
            {T.saved}
            <small>{saved.length} boards</small>
          </span>
        </button>
      </section>
      <footer>
        <i className={!online ? "off" : ""}>●</i> {T.offline}
      </footer>
    </main>
  );
  const Generator = () => (
    <Page title={T.generate}>
      <div className="choice">
        <button onClick={() => newBoard("standard")}>
          <Mini type="standard" />
          <strong>{T.standard}</strong>
          <span>3–4 {T.players} · 19 hexes</span>
        </button>
        <button onClick={() => newBoard("extended")}>
          <Mini type="extended" />
          <strong>{T.extended}</strong>
          <span>5–6 {T.players} · 30 hexes</span>
        </button>
      </div>
      <div className="seed-load">
        <label>Board seed</label>
        <input id="seed" placeholder="HXM-7F3K92" />
        <button
          onClick={() => {
            const el = document.querySelector<HTMLInputElement>("#seed");
            if (el?.value)
              newBoard(
                el.value.length > 9 ? "extended" : "standard",
                el.value.toUpperCase(),
              );
          }}
        >
          Load Seed
        </button>
      </div>
    </Page>
  );
  const BoardScreen = () =>
    board && (
      <Page
        title={
          board.type === "standard" ? "3–4 Player Board" : "5–6 Player Board"
        }
      >
        <div className="board-top">
          <div>
            <span>SEED</span>
            <button
              className="seed"
              onClick={() => navigator.clipboard?.writeText(board.seed)}
            >
              {board.seed}
            </button>
          </div>
          <div className={`badge ${board.rating.toLowerCase()}`}>
            <span>{board.score}/100</span>
            {board.rating}
          </div>
        </div>
        <BoardView board={board} zoom={zoom} />
        <div className="zoom">
          <button onClick={() => setZoom((z) => Math.max(0.7, z - 0.1))}>
            −
          </button>
          <button onClick={() => setZoom(1)}>Reset</button>
          <button onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}>
            ＋
          </button>
        </div>
        <div className="actions">
          <button className="primary full" onClick={() => newBoard(board.type)}>
            ↻ {T.shuffle}
          </button>
          <button onClick={() => newBoard(board.type)}>⌗ {T.numbers}</button>
          <button onClick={() => newBoard(board.type)}>⬡ {T.terrain}</button>
          <button
            disabled={!history.length}
            onClick={() => {
              const [b, ...rest] = history;
              if (b) {
                setHistory(rest);
                setBoard(b);
              }
            }}
          >
            ↶ {T.previous}
          </button>
          <button
            onClick={() => {
              const n = [...saved, board];
              setSaved(n);
              save("savedBoards", n);
            }}
          >
            ★ {T.save}
          </button>
          <button
            onClick={() =>
              alert(
                `${T.balance}: ${board.score}/100 — ${board.rating}\n\nResource clustering, production weights and high-probability placement are included. This is not an official CATAN rating.`,
              )
            }
          >
            ⚖ {T.analyze}
          </button>
          <button className="gold full" onClick={() => nav("setup")}>
            ▶ {T.startGame}
          </button>
        </div>
      </Page>
    );
  const Setup = () =>
    board && (
      <SetupView
        board={board}
        onStart={(g) => {
          setGame(g);
          nav("game");
        }}
      />
    );
  const GameScreen = () =>
    game && (
      <GameView
        game={game}
        setGame={setGame}
        onStats={() => nav("stats")}
        onEnd={() => {
          const hist = load<any[]>("gameHistory", []);
          save("gameHistory", [{ ...game, ended: Date.now() }, ...hist]);
          remove("currentGame");
          setGame(null);
          nav("home");
        }}
      />
    );
  const Saved = () => (
    <Page title={T.saved}>
      {saved.length ? (
        <div className="saved-list">
          {saved.map((b, i) => (
            <article key={b.seed}>
              <BoardView board={b} />
              <div>
                <strong>{b.name || b.seed}</strong>
                <span>
                  {b.type} · {b.score}/100
                </span>
              </div>
              <button
                onClick={() => {
                  setBoard(b);
                  nav("board");
                }}
              >
                Open
              </button>
              <button
                onClick={() => {
                  const n = saved.filter((_, j) => j !== i);
                  setSaved(n);
                  save("savedBoards", n);
                }}
              >
                Delete
              </button>
            </article>
          ))}
        </div>
      ) : (
        <Empty text="No saved boards yet." />
      )}
    </Page>
  );
  const Modes = () => (
    <Page title="Game Modes">
      <p className="notice">
        Unofficial HexMate game modes. The table enforces its own house rules.
      </p>
      <div className="mode-grid">
        {[
          ["⚡", "Blitz", "30-second turns with pace statistics."],
          ["✹", "Chaos Island", "Unusual clustering; Mild or Absolute."],
          ["▽", "Scarcity", "One resource receives weaker numbers."],
          ["★", "Golden Number", "A special roll triggers your agreed bonus."],
          ["☠", "Robber Panic", "Dramatic 7 tracking and robber streaks."],
          ["✦", "Random Events", "Optional event card every 3 rounds."],
          ["⚙", "Custom Game", "Build and save your own preset."],
        ].map((x) => (
          <button
            key={x[1]}
            onClick={() =>
              alert(
                `${x[1]}\n\n${x[2]}\nSelect this rule at the table, then generate a board or start a game.`,
              )
            }
          >
            <b>{x[0]}</b>
            <strong>{x[1]}</strong>
            <span>{x[2]}</span>
          </button>
        ))}
      </div>
    </Page>
  );
  const Stats = () => (
    <Page title={T.stats}>
      <StatsView rolls={game?.rolls || []} />
    </Page>
  );
  const Settings = () => (
    <Page title={T.settings}>
      <div className="settings">
        <label>
          Language
          <select
            value={lang}
            onChange={(e) => {
              const v = e.target.value as Lang;
              setLang(v);
              save("settings", { lang: v });
            }}
          >
            <option value="en">English</option>
            <option value="hr">Hrvatski</option>
          </select>
        </label>
        {[
          "Sounds",
          "Vibration",
          "Animations",
          "Color Blind Mode",
          "Keep Screen Awake",
          "Confirm End Game",
        ].map((x) => (
          <label key={x}>
            {x}
            <input
              type="checkbox"
              defaultChecked={!["Color Blind Mode"].includes(x)}
            />
          </label>
        ))}
        <label>
          Turn timer
          <select>
            <option>30 sec</option>
            <option>45 sec</option>
            <option selected>60 sec</option>
            <option>90 sec</option>
            <option>120 sec</option>
            <option>Unlimited</option>
          </select>
        </label>
      </div>
      <p className="legal">
        HexMate is an unofficial tabletop companion and is not affiliated with
        or endorsed by CATAN GmbH or its publishers.
      </p>
    </Page>
  );
  const Page = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <main>
      <header>
        <button onClick={() => nav("home")} aria-label="Home">
          ‹
        </button>
        <h2>{title}</h2>
        <i>⬡</i>
      </header>
      {children}
    </main>
  );
  return (
    <>
      {screen === "home" && <Home />}
      {screen === "generator" && <Generator />}
      {screen === "board" && <BoardScreen />}
      {screen === "setup" && <Setup />}
      {screen === "game" && <GameScreen />}
      {screen === "modes" && <Modes />}
      {screen === "stats" && <Stats />}
      {screen === "saved" && <Saved />}
      {screen === "settings" && <Settings />}
      {screen !== "home" && (
        <nav>
          <button onClick={() => nav("home")}>⌂</button>
          <button onClick={() => nav("generator")}>⬡</button>
          <button onClick={() => nav("modes")}>✦</button>
          <button onClick={() => nav("stats")}>▥</button>
          <button onClick={() => nav("settings")}>⚙</button>
        </nav>
      )}
    </>
  );
}
function Mini({ type }: { type: Board["type"] }) {
  return (
    <div className="mini">
      <BoardView board={generateBoard(type, `HXM-PRE${type[0]}`)} />
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <b>⬡</b>
      <p>{text}</p>
    </div>
  );
}
function SetupView({
  board,
  onStart,
}: {
  board: Board;
  onStart: (g: Game) => void;
}) {
  const max = board.type === "standard" ? 4 : 6,
    min = board.type === "standard" ? 3 : 5;
  const [count, setCount] = useState(min);
  const colors = [
    "#c84b42",
    "#3971a8",
    "#db842e",
    "#e8e2d4",
    "#4e8059",
    "#74513d",
  ];
  const [names, setNames] = useState(
    Array.from({ length: 6 }, (_, i) => `Player ${i + 1}`),
  );
  return (
    <main>
      <header>
        <button onClick={() => history.back()}>‹</button>
        <h2>Player Setup</h2>
        <i>⬡</i>
      </header>
      <section className="setup">
        <h3>How many players?</h3>
        <div className="segments">
          {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
            <button
              className={count === n ? "active" : ""}
              onClick={() => setCount(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <h3>Names & colors</h3>
        {names.slice(0, count).map((n, i) => (
          <label className="player" key={i}>
            <i style={{ background: colors[i] }} />
            <input
              value={n}
              onChange={(e) =>
                setNames((a) => a.map((x, j) => (j === i ? e.target.value : x)))
              }
            />
          </label>
        ))}
        <button
          className="gold full"
          onClick={() => {
            const ps: Player[] = names
              .slice(0, count)
              .map((name, i) => ({
                name: name.trim() || `Player ${i + 1}`,
                color: colors[i],
              }));
            const start = Math.floor(Math.random() * count);
            onStart({
              board,
              players: ps,
              current: start,
              turn: 1,
              started: Date.now(),
              timer: 60,
              turnStarted: Date.now(),
              rolls: [],
              events: [],
              paused: false,
            });
          }}
        >
          🎲 Randomize & Start
        </button>
      </section>
    </main>
  );
}
function GameView({
  game,
  setGame,
  onStats,
  onEnd,
}: {
  game: Game;
  setGame: (g: Game) => void;
  onStats: () => void;
  onEnd: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [dice, setDice] = useState<[number, number] | null>(null);
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(i);
  }, []);
  const elapsed = Math.floor((now - game.turnStarted) / 1000),
    left = game.timer - elapsed,
    over = left < 0;
  const p = game.players[game.current],
    round = Math.floor((game.turn - 1) / game.players.length) + 1;
  const endTurn = () =>
    setGame({
      ...game,
      current: (game.current + 1) % game.players.length,
      turn: game.turn + 1,
      turnStarted: Date.now(),
    });
  const roll = () => {
    setTimeout(() => {
      const d = rollDice(),
        total = d[0] + d[1];
      setDice(d);
      setGame({
        ...game,
        rolls: [...game.rolls, { total, player: p.name, at: Date.now() }],
        events: [
          ...game.events,
          `Turn ${game.turn} – ${p.name} – rolled ${total}`,
        ],
      });
    }, 550);
  };
  return (
    <main className="game">
      <div
        className="turn"
        style={{ "--player": p.color } as React.CSSProperties}
      >
        <span>
          ROUND {round} · TURN {game.turn}
        </span>
        <h2>{p.name}'S TURN</h2>
        <div
          className={`timer ${left <= 5 ? "danger" : left <= 15 ? "warn" : ""}`}
        >
          {over
            ? `+${String(-left).padStart(2, "0")}`
            : `${String(Math.max(0, left)).padStart(2, "0")}`}
          <small>{over ? "OVERTIME" : "SECONDS"}</small>
        </div>
      </div>
      <div className="order">
        {game.players.map((x, i) => (
          <i
            className={i === game.current ? "active" : ""}
            style={{ background: x.color }}
            title={x.name}
          >
            {x.name[0]}
          </i>
        ))}
      </div>
      <section className="dice">
        <button onClick={roll}>⚄ {dice ? "ROLL AGAIN" : "ROLL DICE"}</button>
        {dice && (
          <div>
            <b>{dice[0]}</b>
            <span>＋</span>
            <b>{dice[1]}</b>
            <strong>TOTAL {dice[0] + dice[1]}</strong>
          </div>
        )}
      </section>
      <button className="gold end" onClick={endTurn}>
        END TURN →
      </button>
      <div className="game-links">
        <button onClick={onStats}>▥ Stats</button>
        <button
          onClick={() => {
            if (confirm("End this game?")) onEnd();
          }}
        >
          End Game
        </button>
      </div>
    </main>
  );
}
function StatsView({ rolls }: { rolls: { total: number }[] }) {
  const counts = useMemo(
    () =>
      Object.fromEntries(
        Array.from({ length: 11 }, (_, i) => [
          i + 2,
          rolls.filter((r) => r.total === i + 2).length,
        ]),
      ),
    [rolls],
  );
  const max = Math.max(1, ...Object.values(counts));
  let since = 0;
  for (let i = rolls.length - 1; i >= 0 && rolls[i].total !== 7; i--) since++;
  return (
    <section className="stats">
      <div className="stat-head">
        <div>
          <b>{rolls.length}</b>
          <span>Total rolls</span>
        </div>
        <div>
          <b>{counts[7]}</b>
          <span>Sevens</span>
        </div>
        <div>
          <b>{since}</b>
          <span>Since a 7</span>
        </div>
      </div>
      <div className="chart">
        {Object.entries(counts).map(([n, c]) => (
          <div>
            <span>{n}</span>
            <i style={{ height: `${Math.max(3, (c / max) * 100)}%` }} />
            <b>{c}</b>
          </div>
        ))}
      </div>
      <div className="mood">
        <b>
          ROBBER MOOD:{" "}
          {since > 9 ? "DANGEROUS" : since > 4 ? "RESTLESS" : "CALM"}
        </b>
        <span>
          {since} turns since last 7. Just for fun—this does not predict a roll.
        </span>
      </div>
    </section>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

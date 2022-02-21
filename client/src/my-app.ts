import { bound } from '@aurelia/kernel';
import { customElement, IPlatform, observable } from '@aurelia/runtime-html';
import * as d3 from 'd3';
import { Margin } from './Margin';
import template from './my-app.html';
import { Player } from './Player';
import { Session } from './Session';

const playerStorageKey = 'planning-poker:player';
const endpoint = 'https://immense-reaches-14965.herokuapp.com'; // 'http://localhost:3000';

const margin = new Margin(20, 30, 50, 10);
const width = 300;
const height = 200;

type $HTMLDialogElement = HTMLDialogElement & { showModal(): void; close(): void; };

@customElement({ name: 'my-app', template })
export class MyApp {
  private source: EventSource = null!;
  private session: Session;
  @observable
  private player: Player = null!;
  private readonly sessionDialog: $HTMLDialogElement;
  private readonly playerDialog: $HTMLDialogElement;
  private readonly errorDialog: $HTMLDialogElement;
  private readonly result: HTMLDivElement;
  private error: string;
  private readonly joinSessionPromise: Promise<void> = Promise.resolve();
  private reveal: boolean = false;
  private deck: ReadonlyArray<number> = Object.freeze([0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100]);
  private svg!: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
  private meanEstimate: number | null = null;

  public constructor(
    @IPlatform private readonly platform: IPlatform,
  ) {
    const parts = platform.location.pathname.split('/').filter(fragment => fragment);
    // /id
    if (parts.length === 1) {
      this.joinSessionPromise = this.joinSession(parts[0]);
    }
  }

  private showSessionDialog() {
    this.cleanup();
    this.sessionDialog.showModal();
  }

  private cleanup() {
    this.session = null;
    this.source?.close();
    this.player = null;
  }

  private async handleSessionDialogClose(name: string | null) {
    if (name === null) {
      this.sessionDialog.close();
      return;
    }
    if (!name) { return; }
    const session = this.session = new Session(name);
    this.sessionDialog.close();

    const response = await fetch(`${endpoint}/start`, {
      method: 'POST',
      body: JSON.stringify(this.session)
    });
    const status = response.status;
    if (status < 200 || status > 299) {
      this.showError('Cannot start the session');
      return;
    }
    const platform = this.platform;
    const url = new URL(platform.location.href);
    url.pathname = session.id;
    platform.history.replaceState(null, '', url);
    this.startPlayerInitialization();
  }

  private async joinSession(sessionId: string) {
    const response = await fetch(`${endpoint}/join?${new URLSearchParams({ id: sessionId })}`, { method: 'POST' });
    const status = response.status;
    if (status < 200 || status > 299) {
      this.showError(
        status === 404
          ? 'Session not found. You can start a new session instead.'
          : 'Cannot join the session');
      return;
    }
    const data: Partial<Session> = await response.json();
    const session = this.session = new Session(data.name, data.id);
    session.addPlayers(data.players);
    this.startPlayerInitialization();
  }

  private startPlayerInitialization() {
    let playerRaw = localStorage.getItem(playerStorageKey);
    if (!playerRaw) {
      this.playerDialog.showModal();
      return;
    }
    const playerJson: Partial<Player> = JSON.parse(playerRaw);
    this.player = new Player(playerJson.name, playerJson.id);
  }

  private closePlayerDialog(name: string) {
    if (name === null) {
      this.sessionDialog.close();
      return;
    }
    if (!name) { return; }
    const player = new Player(name);
    this.playerDialog.close();
    localStorage.setItem(playerStorageKey, JSON.stringify(player));
    this.player = player;
  }

  private playerChanged(player: Player, old: Player | null): void {
    if (!player || old !== null) return;
    this.session.addPlayer(player);
    const query = new URLSearchParams({ session_id: this.session.id, player_id: player.id, player_name: player.name });
    const source = this.source = new EventSource(`${endpoint}/join-player?${query}`);
    source.addEventListener('open', () => { console.log('You are now connected'); });
    source.addEventListener('player-joined', this.playerJoined);
    source.addEventListener('player-left', this.playerLeft);
    source.addEventListener('set-estimate', this.setEstimate);
    source.addEventListener('reveal', this.revealCards);
    source.addEventListener('clear', this.clear);
  }

  @bound
  private playerJoined(event: MessageEvent) {
    this.session.addPlayer(JSON.parse(event.data));
  }

  @bound
  private playerLeft(event: MessageEvent) {
    this.session.removePlayer(JSON.parse(event.data));
  }

  @bound
  private setEstimate(event: MessageEvent) {
    console.log('setEstimate');
    this.session.setEstimate(JSON.parse(event.data));
  }

  @bound
  private revealCards() {
    this.reveal = true;

    //#region drawing
    const dataset = this.session.players.reduce(
      (acc, player) => {
        const estimate = player.estimate;
        let item = acc.find(i => i.estimate === estimate);
        if (item == null) {
          item = new EstimationFrequency(estimate, 1);
          acc.push(item);
        } else {
          item.frequency++;
        }
        return acc;
      },
      [] as EstimationFrequency[]
    );
    dataset.sort((a, b) => a.estimate - b.estimate);

    // this part needs more love to handle it the d3 way
    const svg = this.svg = d3.select(this.result)
      .insert('svg', '#meanContainer')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('height', height)
      .attr('width', width);
    const xAxis = svg.append("g")
      .classed('x-axis', true)
      .attr('transform', `translate(0, ${height - margin.bottom})`);
    const xScale = d3.scaleBand()
      .domain(dataset.map((d) => d.estimate.toString()))
      .rangeRound([margin.left, width - margin.right])
      .paddingInner(0.5);
    const yScale = d3.scaleLinear()
      .domain([d3.max(dataset, (d) => d.frequency), 0] as [number, number])
      .range([height - margin.bottom, margin.top]);

    const rects = this.svg.selectAll('rect').data(dataset, (x: EstimationFrequency) => x.estimate);
    rects.exit().remove();
    rects.enter()
      .append('rect')
      .attr('x', (d) => xScale(d.estimate.toString())!)
      .attr("y", (d) => height - yScale(d.frequency) - margin.bottom)
      .attr("width", xScale.bandwidth())
      .attr("height", (d) => yScale(d.frequency))
      .merge(rects as any);
    xAxis.call(d3.axisBottom(xScale));
    xAxis.select('.domain').attr('opacity', '0');
    const ticks = xAxis.selectAll('g.tick');
    ticks.selectAll('line').attr('opacity', '0');
    ticks.selectAll('text').attr('font-size', '150%');
    ticks.append('text')
      .text(function (_, i) {
        const freq = dataset[i].frequency;
        return `${freq.toString()} vote${freq === 1 ? '' : 's'}`;
      })
      .attr('fill', 'currentColor')
      .attr('y', '35');
    //#endregion

    this.meanEstimate = Math.ceil(d3.mean(this.session.players, x => x.estimate) * 100) / 100;
  }

  @bound
  private clear() {
    this.session.clearAllEstimates();
    this.reveal = false;
    this.meanEstimate = null;
    this.svg.remove();
  }

  private async toggleEstimate(estimate: number) {
    const player = this.player;
    if (player.estimate === estimate) {
      player.estimate = null;
    } else {
      player.estimate = estimate;
    }
    // TODO: handle non-ok response
    await fetch(`${endpoint}/put-estimate`, {
      method: 'PUT',
      body: JSON.stringify({
        sessionId: this.session.id,
        playerId: player.id,
        estimate: player.estimate,
      } as PutEstimationContract)
    });
  }

  private async requestReveal() {
    await fetch(`${endpoint}/reveal?${new URLSearchParams({ id: this.session.id })}`, { method: 'POST' });
  }

  private async requestClear() {
    await fetch(`${endpoint}/clear?${new URLSearchParams({ id: this.session.id })}`, { method: 'DELETE' });
  }

  private showError(error: string) {
    this.error = error;
    this.errorDialog.showModal();
  }
}

interface PutEstimationContract {
  readonly sessionId: string;
  readonly playerId: string;
  readonly estimate: number;
}

class EstimationFrequency {
  public constructor(
    public readonly estimate: number,
    public frequency: number,
  ) { }
}
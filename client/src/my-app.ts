import { customElement, IPlatform, observable } from '@aurelia/runtime-html';
import template from './my-app.html';
import { Player } from './Player';
import { Session } from './Session';

const playerStorageKey = 'planning-poker:player';
const endpoint = 'http://localhost:3000';
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
  private error: string;
  private readonly joinSessionPromise: Promise<void> = Promise.resolve();

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
    this.sessionDialog.showModal();
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
    this.session = new Session(data.name, data.id);
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
    const query = new URLSearchParams({ session_id: this.session.id, player_id: player.id, player_name: player.name });
    const source = this.source = new EventSource(`${endpoint}/join-player?${query}`);
    source.addEventListener('open', () => { console.log('player is now connected'); });
    //TODO: added listeners for SSEs
  }

  private showError(error: string) {
    this.error = error;
    this.errorDialog.showModal();
  }

  // public initiateSse() {
  //   if (!this.source) {
  //     const source = this.source = new EventSource(`http://localhost:3000/sse?clientId=${Math.random()}`);
  //     source.addEventListener("message", (event) => {
  //       console.log("message rcvd", event);
  //       this.eventLog.push(event.data);
  //     });
  //     source.addEventListener("awesome-possum", (event: MessageEvent) => {
  //       console.log("awesome-possum rcvd", event);
  //       this.eventLog.push(event.data);
  //     });
  //     source.addEventListener("open", (event) => {
  //       console.log("connection opened");
  //       console.log(event);
  //     });
  //   }
  // }
}

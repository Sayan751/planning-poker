import { v4 } from 'uuid';
import { Player } from './Player';

export class Session {
  public readonly players: ReadonlyArray<Player> = [];
  public constructor(
    public readonly name: string,
    public readonly id: string = v4(),
  ) { }

  public addPlayers(players: readonly Partial<Player>[]) {
    for (const player of players) {
      this.addPlayer(player);
    }
  }

  public addPlayer(player: Partial<Player>) {
    const players = this.players as Player[];
    if (players.find(p => p.id === player.id) !== undefined) return;
    players.push(
      player instanceof Player
        ? player
        : new Player(player.name, player.id, player.estimate)
    );
  }

  public removePlayer(player: Partial<Player>) {
    const players = this.players as Player[];
    const idx = players.findIndex(p => p.id === player.id);
    if (idx === -1) return;
    players.splice(idx, 1);
  }

  public setEstimate(player: Partial<Player>) {
    const existingPlayer = this.players.find(p => p.id === player.id);
    if (existingPlayer === undefined) return;
    existingPlayer.estimate = player.estimate;
  }

  public clearAllEstimates() {
    for (const player of this.players) {
      player.estimate = null;
    }
  }

  public get estimateCount(): number {
    return this.players.filter(p => p.estimate !== null).length;
  }
}

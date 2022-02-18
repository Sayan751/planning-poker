import { v4 } from 'uuid';

export class Player {
  public constructor(
    public readonly name: string,
    public readonly id: string = v4(),
  ) { }
}

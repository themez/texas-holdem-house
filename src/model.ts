import EventEmitter = require('events')
import _ = require('lodash')

/**
 * s = spade ♠
 * h = heart ♥
 * c = clube ♣
 * d = diamond ♦
 */
export type Card =
  | '2s'
  | '2h'
  | '2c'
  | '2d'
  | '3s'
  | '3h'
  | '3c'
  | '3d'
  | '4s'
  | '4h'
  | '4c'
  | '4d'
  | '5s'
  | '5h'
  | '5c'
  | '5d'
  | '6s'
  | '6h'
  | '6c'
  | '6d'
  | '7s'
  | '7h'
  | '7c'
  | '7d'
  | '8s'
  | '8h'
  | '8c'
  | '8d'
  | '9s'
  | '9h'
  | '9c'
  | '9d'
  | 'Ts'
  | 'Th'
  | 'Tc'
  | 'Td'
  | 'Js'
  | 'Jh'
  | 'Jc'
  | 'Jd'
  | 'Qs'
  | 'Qh'
  | 'Qc'
  | 'Qd'
  | 'Ks'
  | 'Kh'
  | 'Kc'
  | 'Kd'
  | 'As'
  | 'Ah'
  | 'Ac'
  | 'Ad'

export type Role = 'BB' | 'SB' | 'D' | null

// export type eventState = { stack: number; chips: number; pot: number }
export interface PlayerPublicState {
  playerName: string
  role: Role
  bet: number
  folded: boolean
}
export class PlayerState implements PlayerPublicState {
  public pocket?: [Card, Card]
  public role: Role = null
  public bet: number = 0
  public folded: boolean = false
  constructor(public playerId: string, public playerName: string, public chips: number) {}
}

export class Table extends EventEmitter {
  pot = 0
  playerPublicStates: PlayerPublicState[] = []
  board: Card[] = []
  setPlayerStates(playStates: PlayerState[]) {
    this.playerPublicStates = _.map(playStates, state =>
      _.pick(state, ['playerName', 'bet', 'role', 'folded']),
    )
  }
}

export interface GameEvent {
  name:
    | 'call'
    | 'raise'
    | 'fold'
    | 'bet'
    | 'check'
    | 'allin'
    | 'role'
    | 'blind'
    | 'settle'
    | 'flop'
    | 'turn'
    | 'river'
    | 'evaluate'
  tableState: Table
}

export class BlindEvent implements GameEvent {
  name = 'blind' as const
  constructor(public tableState: Table, public roles: { name: string; role: Role }[]) {}
}

export class ActionEvent implements GameEvent {
  name: 'call' | 'raise' | 'fold' | 'bet' | 'allin' | 'check'
  constructor(public tableState: Table, public action: Action) {
    this.name = action.action
  }
}

export class SettleEvent implements GameEvent {
  name = 'settle' as const
  constructor(public tableState: Table, public winners: { name: string }[]) {}
}

export class DrawEvent implements GameEvent {
  constructor(public tableState: Table, public name: 'flop' | 'turn' | 'river', cards: Card[]) {}
}

export class EvaluateEvent implements GameEvent {
  name = 'evaluate' as const
  constructor(public tableState: Table, public pockets: ([Card, Card] | null)[]) {}
}

export interface Action {
  action: 'call' | 'raise' | 'fold' | 'bet' | 'check'
  amount?: number
}

/**
 * For watching game and do action
 */
export abstract class Player {
  _id?: string
  constructor(public name: string) {}
  abstract join(event: EventEmitter, position: number): void
  abstract deal(cards: [Card, Card]): void
  abstract async action(actionList: Action[]): Promise<Action>
}

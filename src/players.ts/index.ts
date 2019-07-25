import { Player, Card, Action } from '../model'
import { EventEmitter } from 'events'
import { run } from '../engine'
import _ = require('lodash')
import Debug = require('debug')

const debug = Debug('players:CallPlayer')
export class CallPlayer implements Player {
  deal(cards: [Card, Card]): void {}
  join(event: EventEmitter, position: number): void {}
  async action(actionList: Action[]): Promise<Action> {
    debug('available actions %O', actionList)
    const callAction = _.find(actionList, action => action.action === 'call')
    if (callAction) {
      return callAction
    }
    const betAction = _.find(actionList, action => action.action === 'bet')
    if (betAction) {
      return betAction
    }
    const checkAction = _.find(actionList, action => action.action === 'check')
    if (checkAction) {
      return checkAction
    }
    return { action: 'fold' }
  }
  constructor(public name: string) {}
}

export class RandomPlayer implements Player {
  deal(cards: [Card, Card]): void {}
  join(event: EventEmitter, position: number): void {}
  async action(actionList: Action[]): Promise<Action> {
    debug('available actions %O', actionList)
    return _.sample(actionList)!
  }
  constructor(public name: string) {}
}

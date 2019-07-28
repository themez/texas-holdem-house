import texas = require('node-texas-evaluator')
import {
  Action,
  Player,
  Card,
  Role,
  Table,
  PlayerState,
  BlindEvent,
  ActionEvent,
  SettleEvent,
  DrawEvent,
  EvaluateEvent,
} from './model'
import _ = require('lodash')
import util = require('util')

import readline = require('readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const question = util.promisify(rl.question.bind(rl)) as (q: string) => Promise<string>

class Croupier {
  deck: string[]
  constructor(
    private tableState: Table,
    private players: Player[],
    private playerStates: PlayerState[],
  ) {
    this.deck = texas.deck(texas.abbr)
  }

  deal() {
    this.players.forEach((player, i) => {
      const playerState = this.playerStates[i]
      playerState.pocket = [this.deck.shift() as Card, this.deck.shift() as Card]
      player.deal(_.cloneDeep(playerState.pocket))
    })
    console.log('finished deal')
  }

  async doAction(playerIndex: number, shouldBet: boolean) {
    const playerState = this.playerStates[playerIndex]
    if (playerState.folded) {
      return null
    }
    const player = this.players[playerIndex]
    const actions: Action[] = [{ action: 'fold' }]

    // CALLed or ALL-INed
    const currentBet = _.max(this.playerStates.map(state => state.bet))!
    if (playerState.chips === 0 || currentBet === playerState.bet) {
      actions.push({ action: 'check' })
    } else if (playerState.chips > 0 && currentBet - playerState.bet > 0 && !shouldBet) {
      actions.push({
        action: 'call',
        amount: Math.min(currentBet - playerState.bet, playerState.chips),
      })
    }

    if (shouldBet && playerState.chips > 0) {
      actions.push({ action: 'bet', amount: Math.min(BLIND * 2, playerState.chips) })
    }

    if (playerState.chips > 0 && !shouldBet) {
      actions.push({ action: 'raise', amount: Math.min(BLIND * 2, playerState.chips) })
    }

    let action = await player.action(actions)

    // validate
    if (actions.map(action => action.action).indexOf(action.action) === -1) {
      console.log('force fold for invalid action %O %O', action, playerState)
      action = { action: 'fold' }
    }
    if (action.amount && action.amount > playerState.chips) {
      console.log('force fold for invalid action %O %O', action, playerState)
      action = { action: 'fold' }
    }
    if (
      action.action === 'bet' &&
      action.amount! % (BLIND * 2) !== 0 &&
      action.amount !== playerState.chips
    ) {
      console.log('force fold for invalid action %O %O', action, playerState)
      action = { action: 'fold' }
    }
    if (
      action.action === 'raise' &&
      action.amount! % (BLIND * 2) !== 0 &&
      action.amount !== playerState.chips
    ) {
      console.log('force fold for invalid action %O %O', action, playerState)
      action = { action: 'fold' }
    }

    switch (action.action) {
      case 'fold':
        playerState.folded = true
        break
      case 'bet':
      case 'call':
      case 'raise':
        playerState.bet += action.amount!
        playerState.chips -= action.amount!
        // this.tableState.pot += action.amount!
        break
      case 'check':
      default:
    }
    console.log(
      `${player.name} act ${action.action} ${action.amount || ''} bet ${playerState.bet} chips ${
        playerState.chips
      }`,
    )

    this.tableState.emit('event', new ActionEvent(this.tableState, action))
    return action
  }

  collectBet() {
    let playersToCollect = this.playerStates.filter(state => state.bet > 0)
    let leastPlayer = _.minBy(playersToCollect, state => state.bet)

    // some one betted
    while (leastPlayer) {
      const leastBet = leastPlayer!.bet
      let lastPot = _.last(this.tableState.pots)
      if (
        !lastPot ||
        // last pot should be sealed if some one ALLIN-ed last round
        (lastPot.contributors.length !== 0 && lastPot.contributors.length > playersToCollect.length)
      ) {
        lastPot = { amount: 0, contributors: [] }
        this.tableState.pots.push(lastPot)
      }
      lastPot.amount += leastBet * playersToCollect.length
      lastPot.contributors = playersToCollect.map(state => state.playerPosition)
      playersToCollect.forEach(state => (state.bet -= leastBet))

      this.tableState.pot += leastBet * playersToCollect.length

      playersToCollect = this.playerStates.filter(state => state.bet > 0)
      leastPlayer = _.minBy(playersToCollect, state => state.bet)
    }
    console.log('current pot', this.tableState.pot, this.tableState.pots)
    // broadcast
    this.tableState.setPlayerStates(this.playerStates)
  }
  async bet(firstIndex: number) {
    let startIndex = firstIndex
    const playerCnt = this.playerStates.length

    for (let i = 0; i < playerCnt; i++) {
      const playerIndex = (i + startIndex) % playerCnt
      const action = await this.doAction(
        playerIndex,
        playerIndex === startIndex && this.tableState.board.length > 0,
      )
      if (!action) {
        continue
      }
      // if raised continue round
      if (action.action === 'raise') {
        startIndex = playerIndex
        i = 0
      }
      // if fold check winning
      if (action.action === 'fold') {
        if (this.playerStates.filter(state => !state.folded).length === 1) {
          this.collectBet()
          this.splitPot(this.playerStates.filter(state => !state.folded))
          return true
        }
      }
    }
    this.collectBet()
    return false
  }

  shutdown() {
    const alivePlayers = this.playerStates.filter(state => !state.folded)
    const results = alivePlayers.map(state => {
      return texas.evaluate([...state.pocket!, ...this.tableState.board])
    })
    const maxScore = _.maxBy(results, it => it.value)!.value
    const winners: PlayerState[] = []
    console.log('board: ', this.tableState.board.map(texas.unicode).join(' '))
    results.forEach((result, i) => {
      console.log(
        `${alivePlayers[i].playerName} result: ${alivePlayers[i]
          .pocket!.map(texas.unicode)
          .join(' ')} ${result.name} ${result.value}`,
      )
      if (result.value === maxScore) {
        winners.push(alivePlayers[i])
      }
    })
    this.tableState.emit(
      'event',
      new EvaluateEvent(
        this.tableState,
        this.playerStates.map(state => {
          if (state.folded) {
            return null
          }
          return state.pocket!
        }),
      ),
    )
    this.splitPot(winners)
  }

  private splitPot(winners: PlayerState[]) {
    const winnerPositions = winners.map(winner => winner.playerPosition)
    let currentPot = this.tableState.pots.shift()
    while (currentPot) {
      const sharePositions = _.intersection(winnerPositions, currentPot.contributors)
      if (sharePositions.length) {
        const share = currentPot.amount / sharePositions.length
        sharePositions.forEach(pos => {
          this.playerStates[pos].chips += share
        })
      } else {
        // return bet
        currentPot.contributors.forEach(pos => {
          this.playerStates[pos].chips += currentPot!.amount / currentPot!.contributors.length
        })
      }
      currentPot = this.tableState.pots.shift()
    }

    this.tableState.setPlayerStates(this.playerStates)

    console.log(`${_.map(winners, 'playerName').join(', ')} win`)
    console.log(
      _.map(this.playerStates, state => `${state.playerName}[${state.chips}]`).join(' '),
      '\n\n',
    )
    this.tableState.emit(
      'event',
      new SettleEvent(this.tableState, winners.map(winner => ({ name: winner.playerName }))),
    )
  }

  draw(type: 'flop' | 'turn' | 'river') {
    const count = { flop: 3, turn: 1, river: 1 }[type]
    const cards: Card[] = []
    for (let i = 0; i < count; i++) {
      cards.push(this.deck.shift() as Card)
    }
    console.log(`Draw card ${cards.map(texas.unicode).join(' ')}`)
    this.tableState.board.push(...cards)
    this.tableState.emit('event', new DrawEvent(this.tableState, type, cards))
  }

  moveDealer(round: number) {
    this.cleanTable()

    const playerCnt = this.players.length
    const roles = _.fill<Role>(new Array(playerCnt), null)

    if (playerCnt > 2) {
      roles[round % playerCnt] = 'D'
    }
    roles[(round + 1) % playerCnt] = 'SB'
    roles[(round + 2) % playerCnt] = 'BB'
    this.playerStates.forEach((state, i) => (state.role = roles[i]))
    console.log(
      'Game started ',
      _.sumBy(this.playerStates, state => state.chips),
      this.playerStates
        .map(
          state => `${state.playerName}${state.role ? '(' + state.role + ')' : ''}[${state.chips}]`,
        )
        .join(' '),
    )
    return roles
  }
  cleanTable() {
    this.deck = texas.deck(texas.abbr)
    this.tableState.board = []
    this.tableState.pot = 0
    this.tableState.pots = []

    _.remove(this.players, (_player, i) => this.playerStates[i].chips === 0)
    _.remove(this.playerStates, state => state.chips === 0)
    this.players.forEach((player, i) => (player.position = i))
    this.playerStates.forEach((state, i) => (state.playerPosition = i))

    this.playerStates.forEach(state => {
      state.folded = false
      state.pocket = undefined
    })
  }
}

const CHIPS = 2000
const BLIND = 50

let STEP = process.env.STEP

export async function run(players: Player[]) {
  const playerCnt = players.length
  if (playerCnt < 2 || playerCnt > 10) {
    console.log('Too many or too less players')
    return
  }

  const tableState = new Table()

  players = _.shuffle(players)
  // init players
  players.forEach((player, i) => {
    player.position = i
    player.name = player.name || `player-${i}`
    player.join(tableState, i)
  })
  const playerStates = players.map(player => new PlayerState(player.position!, player.name, CHIPS))

  const croupier = new Croupier(tableState, players, playerStates)
  let round = 0

  while (playerStates.filter(state => state.chips > 0).length > 1) {
    croupier.moveDealer(round)
    // blinds
    players.forEach((player, i) => {
      const playerState = playerStates[i]
      const playerRole = playerState.role
      let bet
      switch (playerRole) {
        case 'D':
          playerState.role = 'D'
          break
        case 'SB':
          bet = Math.min(BLIND, playerState.chips)
          playerState.chips -= bet
          playerState.bet += bet
          break
        case 'BB':
          bet = Math.min(BLIND * 2, playerState.chips)
          playerState.chips -= bet
          playerState.bet += bet
          break
        default:
          playerState.role = null
      }
      tableState.setPlayerStates(playerStates)
      tableState.emit(
        'event',
        new BlindEvent(
          tableState,
          playerStates.map(state => ({ name: state.playerName, role: state.role })),
        ),
      )
    })

    // deal
    croupier.deal()

    // first round betting start from the one next to BB
    const sbPlayerIndex = _.findIndex(playerStates, state => state.role === 'SB')
    const bbPlayerIndex = _.findIndex(playerStates, state => state.role === 'BB')
    let shutdown = await croupier.bet((bbPlayerIndex + 1) % playerCnt)

    if (shutdown) {
      round += 1
      continue
    }

    // flop
    croupier.draw('flop')

    // second round betting
    shutdown = await croupier.bet(sbPlayerIndex)
    if (shutdown) {
      round += 1
      continue
    }

    // the turn
    croupier.draw('turn')

    // third round betting
    shutdown = await croupier.bet(sbPlayerIndex)
    if (shutdown) {
      round += 1
      continue
    }
    // the river
    croupier.draw('river')

    // fourth round betting
    shutdown = await croupier.bet(sbPlayerIndex)
    if (shutdown) {
      round += 1
      continue
    }
    // shutdown this round
    croupier.shutdown()
    round += 1
    if (STEP) {
      const control = await question('continue?').catch(e => e)
      if (control === 'a') {
        STEP = undefined
      }
    }
  }
  croupier.cleanTable()
  console.log('winner is', playerStates[0].playerName, playerStates[0].chips)

  // return winner
  return players[0]
}

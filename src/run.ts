import { startGame, CallPlayer, RandomPlayer } from './index'
import _ = require('lodash')

startGame(
  _.range(0, 8).map((i: number) =>
    i < 4 ? new CallPlayer(`CallPlayer-${i}`) : new RandomPlayer(`RandomPlayer-${i}`),
  ),
)

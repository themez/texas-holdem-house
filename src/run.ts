import { startGame, CallPlayer } from './index'
import _ = require('lodash')
import { SimpleStratetyPlayer } from './players.ts'

async function test() {
  let call = 0
  let simple = 0
  for (let i = 0; i < 1; i++) {
    const winner = await startGame(
      _.range(0, 8).map((i: number) =>
        i < 4
          ? new CallPlayer(`CallPlayer-${i}`)
          : new SimpleStratetyPlayer(`SimpleStratetyPlayer-${i}`),
      ),
    )
    if (winner) {
      if (winner instanceof CallPlayer) {
        call += 1
      } else if (winner instanceof SimpleStratetyPlayer) {
        simple += 1
      }
    }
  }
  console.log(call, simple)
}

test()

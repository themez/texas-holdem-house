# Texas-holdem-house

A texas hold'em game engine for bot players

```
➜ npm i texas-holdem-house
```

## Start Game

```ts
import { startGame, Player, CallPlayer, RandomPlayer } from 'texas-holdem-house'

const builtInPlayers = _.range(0, 7).map(i =>
  i < 4 ? new CallPlayer(`CallPlayer-${i}`) : new RandomPlayer(`RandomPlayer-${i}`),
)

// write your own bot
class MyPlayer implements Player {
  constructor(public name: string) {}
  // join the game with an event emitter to listen to game event
  join(event: EventEmitter, position: number): void {
    // your code
  }
  // deal two card to you
  deal(cards: [Card, Card]): void {
    // your code
  }
  // your turn to action
  async action(actionList: Action[]): Promise<Action> {
    // your code
    ...
  }
}

startGame([...builtInPlayers, new MyPlayer('MySeasonedPlayer')])
```

## Texas hold'em rules

- For clockwise direction dealder followed by small blind, big blind
- deal from small blind
- first round betting start from the one next to big blind, big blind is the last one to action, second/third/fourth round betting start from small blind
- player can only raise multiple to previous bet

## 德州扑克规则

- 顺时针，dealer 左边依次是小盲，大盲
- 从小盲开始发牌
- 第一轮从大盲左边一位开始行动，到大盲最后一个 call/raise，后面轮次从小盲开始行动
- 每轮 raise 必须是 bet 的整数倍

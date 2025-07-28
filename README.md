
## ✨ Key Features

### Gameplay Mechanics
* **Target Sniping:** The main objective is to have a transaction mined in a precise target block.
* **Variable Difficulty:** Players can choose their difficulty by selecting a "window size" (1, 5, or 10 blocks), creating a risk/reward trade-off.
* **Dynamic Entry Fees:** The entry fee for a specific block target increases with each failed attempt, making unpopular targets cheaper to try.
* **Fair Wins:** A winner always receives their initial bet back, plus their winnings from the prize pool.

### Economic Features
* **Player-Funded Pools:** All prize pools in the game are funded by the players themselves. When a player misses a target, their wager is added to that block's prize pool for a future winner to claim.
* **Automatic Bonus Funding:** When a player misses a target, the amount of their bet is automatically collected and distributed into different bonus pools at a rate of: 35% for Hard, 25% for Normal, 25% for Easy, and 15% for application fees. This makes the game self-funding.

### Player Features & UX
* **Player Profiles:** Players can create a unique username associated with their wallet address.
* **Profile Modal:** A detailed profile view shows the player's username, address, STT balance, and a history of their personal game actions.
* **Hall of Fame:** The contract tracks and the UI displays two all-time records: the "Biggest Win" (largest single prize) and the "Biggest Bettor" (greatest total amount wagered).
* **Polished UI:** The frontend is built with React and features toast notifications, loading states, and a clean, themed interface.

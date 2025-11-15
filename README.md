# Cocorido (Multiplayer Card Game)

This is a real-time multiplayer web game inspired by the popular Italian game "Cocorido" (which is similar to Cards Against Humanity).

It's built from scratch using Node.js, Express, and Socket.io, allowing multiple players to join a game lobby, play rounds, and score points, all in real-time.

## 🚀 Live Demo

**You can play the live version here:**
**[https://multiplayer-card-game-hkqb.onrender.com](https://multiplayer-card-game-hkqb.onrender.com)**

## ✨ Features

* **Real-time Multiplayer:** Uses Socket.io to keep all players in sync.
* **Game Lobby:** Players can join, set their name, and wait for the Host to start the game.
* **Join in Progress:** New players can join an ongoing game and will be added as "spectators" until the next round begins.
* **In-Game Name Editing:** Players can edit their name directly in the lobby before the game starts.
* **Dynamic "Card Master" Role:** The winner of each round becomes the new Master.
* **Interactive Reveal Phase:** The Master reveals the played cards one by one by clicking on them.
* **Score Tracking:** The game tracks each player's points in the sidebar.

## 💻 Tech Stack

* **Backend:** Node.js, Express
* **Real-time Communication:** Socket.io
* **Frontend:** Vanilla HTML, CSS, and JavaScript (no frameworks)
* **Card Data:** JSON

---

## 🚀 How to Run Locally

To run this project on your own computer:

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/yokxi/multiplayer-card-game.git
    cd multiplayer-card-game
    ```

2.  **Install dependencies:**
    (You only need to do this once)

    ```bash
    npm install
    ```

3.  **Start the server:**

    ```bash
    node server.js
    ```

4.  **Play!**
    Open your browser and go to `http://localhost:3000`. Open multiple tabs or incognito windows to simulate multiple players.

---

## 🃏 How to Customize the Cards

This project is designed to be easily customized! All cards are loaded from simple JSON files, not hard-coded into the server.

**To change the cards, you must edit the files inside the `/decks/` folder.**

* **Black Cards (Prompts):**
    Open `/decks/black_cards.json`. This is a simple list of strings. You can add, remove, or edit any of the "question" cards here.

* **White Cards (Answers):**
    Open `/decks/white_cards.json`. This is a list of all the "answer" cards. You can add, remove, or edit them.

After you have saved your changes to the `.json` files, you just need to **restart the server** (`node server.js`) for the new decks to be loaded.

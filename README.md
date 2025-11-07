# 🃏 Gioco di Carte (Stile Umamity)

Questo progetto è un gioco di carte multiplayer in stile "Cards Against Humanity", costruito con Node.js e Socket.io.

## 📝 Stato del Progetto

Attualmente, il progetto è nella sua fase iniziale. Abbiamo un server funzionante che accetta connessioni dai client (pagine web), ma la logica del gioco (carte, round, punteggi) deve ancora essere implementata.

---

## 🚀 Come Eseguire il Gioco (Per l'Host/Sviluppatore)

Questi passaggi servono a te per **avviare il server** sul tuo computer.

### Requisiti

* [Node.js](https://nodejs.org/) (versione LTS) installato.

### Installazione

1.  Apri un terminale (come Command Prompt o il terminale di VS Code) nella cartella di questo progetto.
2.  Esegui questo comando *solo la prima volta* per installare le dipendenze necessarie:
    ```bash
    npm install
    ```

### Avvio del Server

1.  Dal tuo terminale, esegui questo comando per avviare il server:
    ```bash
    node server.js
    ```
2.  Dovresti vedere il messaggio: `🚀 Server in ascolto sulla porta 3000`.
3.  Apri il tuo browser e visita `http://localhost:3000` per connetterti al gioco come primo giocatore.

---

## 🤝 Come Far Giocare i Tuoi Amici (da un altro PC)

Questo è il punto cruciale! I tuoi amici **non possono** usare l'indirizzo `http://localhost:3000`. Quell'indirizzo funziona *solo* sulla tua macchina.

Per farli connettere al server che gira sul tuo PC, devi esporre il tuo server a Internet.

### Opzione 1: Sulla Stessa Rete Wi-Fi (Facile, ma limitato)

Se i tuoi amici sono a casa tua, connessi alla tua stessa rete Wi-Fi.

1.  **Tu (Host):** Trova il tuo "Indirizzo IP Locale".
    * Su **Windows**: Apri Command Prompt e digita `ipconfig`. Cerca l'indirizzo "IPv4 Address" (qualcosa come `192.168.1.10`).
    * Su **Mac/Linux**: Apri il terminale e digita `ifconfig | grep inet`.
2.  **Tu (Host):** Avvia il server come al solito (`node server.js`).
3.  **I tuoi Amici:** Dal loro PC o telefono (sulla stessa Wi-Fi), devono visitare `http://<IL_TUO_IP_LOCALE>:3000` (es. `http://192.168.1.10:3000`).

**Attenzione:** A volte, il Firewall di Windows blocca queste connessioni. Potresti dover dare un'autorizzazione quando te lo chiede.

### Opzione 2: Tramite Internet (La soluzione migliore per testare)

Questa è la soluzione migliore per giocare con amici che non sono a casa tua. Useremo uno strumento fantastico e gratuito chiamato **ngrok**.

`ngrok` crea un "tunnel" sicuro dal tuo `localhost` (la porta 3000) a un indirizzo pubblico su Internet.

1.  **Tu (Host):** Avvia il server. Lascialo in esecuzione nel tuo terminale (`node server.js`).
2.  **Tu (Host):** Scarica `ngrok` dal sito ufficiale: [ngrok.com](https://ngrok.com/download). È un singolo file eseguibile, non serve installarlo.
3.  **Tu (Host):** Apri un **SECONDO** terminale (lasciando il primo con il server attivo!).
4.  **Tu (Host):** Naviga in quel terminale fino alla cartella dove hai scaricato `ngrok` (o sposta `ngrok.exe` nella cartella del tuo progetto).
5.  **Tu (Host):** Esegui questo comando:
    ```bash
    # Su Windows (se ngrok è nella stessa cartella)
    ngrok.exe http 3000
    
    # Su Mac/Linux (se ngrok è nella stessa cartella)
    ./ngrok http 3000
    ```
6.  `ngrok` si avvierà e ti mostrerà una schermata. Cerca la riga **"Forwarding"** che inizia con `httpss://`. Sarà qualcosa come `httpss://a1b2-c3d4-e5f6.ngrok-free.app`.
7.  **Tu (Host):** Copia quell'indirizzo `httpss://...` e **invialo ai tuoi amici**.
8.  **I tuoi Amici:** Aprendo quel link, si collegheranno direttamente al server in esecuzione sul tuo PC!

---

## 📋 Prossimi Passaggi (To-Do List)

* [ ] Creare i mazzi di carte (nere e bianche) sul server (`server.js`).
* [ ] Implementare la logica di "Inizio Partita":
    * [ ] Aspettare un numero minimo di giocatori.
    * [ ] Eleggere il primo "Master".
    * [ ] Distribuire 10 carte bianche a ogni giocatore (tranne il Master).
* [ ] Implementare la logica del Round:
    * [ ] Mostrare la carta nera a tutti.
    * [ ] Permettere ai giocatori di inviare una carta bianca (in modo anonimo).
    * [ ] Mostrare al Master tutte le carte bianche giocate.
* [ ] Implementare la logica di Fine Round:
    * [ ] Permettere al Master di scegliere la carta vincente.
    * [ ] Rivelare il vincitore.
    * [ ] Assegnare il punto.
    * [ ] Passare il ruolo di Master al vincitore.
    * [ ] Far pescare a tutti una nuova carta bianca (tranne il nuovo Master).
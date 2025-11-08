const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname));
app.use('/style', express.static(__dirname + '/style'));
app.use('/img', express.static(__dirname + '/img')); 

// Variabili di stato del gioco
let giocatori = [];
let hostID = null;
let partitaInCorso = false;
let carteNere = require('./decks/black_cards.json');
let carteBianche = require('./decks/white_cards.json');

let mazzoCarteNere = [...carteNere];
let mazzoCarteBianche = [...carteBianche];
let carteNeraCorrente = '';
let carteBiancheGiocate = []; // { giocatoreID, carta, nome }
let masterCorrenteID = null;
let roundAttuale = 0;
const MAX_CARTE_MANO = 7;
const NUM_CARTE_MASTER = 1; // Quante carte il master dovrebbe avere (0 o 1)
const PUNTEGGIO_PER_VINCERE = 5; // Punteggio per vincere la partita

// Funzioni helper
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function pescaCartaNera() {
    if (mazzoCarteNere.length === 0) {
        mazzoCarteNere = shuffle([...carteNere]); // Ricarica e mescola se finite
    }
    return mazzoCarteNere.pop();
}

function pescaCartaBianca(numero = 1) {
    if (mazzoCarteBianche.length < numero) {
        mazzoCarteBianche = shuffle([...carteBianche]); // Ricarica e mescola se finite
    }
    const pescate = [];
    for (let i = 0; i < numero; i++) {
        pescate.push(mazzoCarteBianche.pop());
    }
    return pescate;
}

function getGiocatore(id) {
    return giocatori.find(g => g.id === id);
}

function getNomeGiocatore(id) {
    const giocatore = getGiocatore(id);
    return giocatore ? giocatore.nome : "Unkown Player"; // Default per disconnessioni
}

function aggiornaStatoLobby() {
    io.emit('aggiorna-lista-giocatori', {
        giocatori: giocatori.map(g => ({
            id: g.id,
            nome: g.nome,
            punti: g.punti,
            inAttesa: g.inAttesa,
            haGiocato: g.haGiocato
        })),
        hostID: hostID,
        partitaInCorso: partitaInCorso
    });
}

function inviaMessaggioChatSistema(messaggio) {
    io.emit('nuovo-messaggio-chat', {
        nome: "System",
        messaggio: messaggio,
        isSystem: true
    });
}


function distribuisciCarteIniziali() {
    giocatori.forEach(g => {
        g.mano = pescaCartaBianca(MAX_CARTE_MANO);
        g.punti = 0;
        g.haGiocato = false;
        g.inAttesa = false;
    });
}

function iniziaNuovoTurno() {
    roundAttuale++;
    carteBiancheGiocate = [];
    
    // Assegna il prossimo Master
    if (giocatori.length > 0) {
        const masterIndex = (giocatori.findIndex(g => g.id === masterCorrenteID) + 1) % giocatori.length;
        masterCorrenteID = giocatori[masterIndex].id;
    } else {
        masterCorrenteID = null; // Nessun giocatore, nessun master
    }

    carteNeraCorrente = pescaCartaNera();

    giocatori.forEach(g => {
        g.haGiocato = false;
        if (g.inAttesa) { // Se un giocatore era in attesa, lo reintegriamo
            g.inAttesa = false;
            // Se si reintegra nel gioco, assicurati che abbia un nome
            if (!g.nome.startsWith("Player")) { // Controllo se è ancora un nome di default
                 inviaMessaggioChatSistema(`${g.nome} is now playing!`);
            }
        }
        if (g.id !== masterCorrenteID) {
            // Assicurati che ogni giocatore non master abbia MAX_CARTE_MANO carte
            const carteDaPescare = MAX_CARTE_MANO - g.mano.length;
            if (carteDaPescare > 0) {
                g.mano.push(...pescaCartaBianca(carteDaPescare));
            }
        } else {
            // Il master non pesca carte bianche in mano
            // Ma gli diamo comunque una mano vuota per coerenza
            g.mano = []; // Il master non ha carte bianche in mano per questo gioco
        }
    });

    io.emit('nuovo-turno', {
        cartaNera: carteNeraCorrente,
        masterID: masterCorrenteID,
        round: roundAttuale
    });

    giocatori.forEach(g => {
        io.to(g.id).emit('aggiorna-mano', g.mano);
        io.to(g.id).emit('aggiorna-stato-ruolo', { isMaster: g.id === masterCorrenteID });
    });
    aggiornaStatoLobby(); // Aggiorna lo stato dei giocatori (es. master corrente)
}

function terminaPartita() {
    partitaInCorso = false;
    masterCorrenteID = null;
    giocatori.forEach(g => {
        g.mano = [];
        g.punti = 0;
        g.haGiocato = false;
        g.inAttesa = false; // Tutti tornano a essere attivi
        io.to(g.id).emit('aggiorna-mano', []); // Svuota la mano sul client
    });
    inviaMessaggioChatSistema("The game has ended. Returning to lobby.");
    aggiornaStatoLobby();
}

io.on('connection', (socket) => {
    console.log(`User ${socket.id} connected`);

    // Assegna nome di default e aggiungi al pool
    let playerName = `Player${giocatori.length + 1}`;
    giocatori.push({
        id: socket.id,
        nome: playerName,
        punti: 0,
        mano: [],
        haGiocato: false,
        inAttesa: false // In attesa di unirsi alla prossima partita se una è in corso
    });

    // Se è il primo giocatore, diventa host
    if (giocatori.length === 1) {
        hostID = socket.id;
    }

    // Invia al client il suo nome di default
    socket.emit('imposta-nome-default', playerName);

    // Notifica l'unione in chat
    inviaMessaggioChatSistema(`${playerName} has joined the lobby!`);

    aggiornaStatoLobby();

    socket.on('imposta-nome', (nuovoNome) => {
        const giocatore = getGiocatore(socket.id);
        if (giocatore) {
            const oldName = giocatore.nome;
            giocatore.nome = nuovoNome.substring(0, 20); // Limita la lunghezza del nome
            inviaMessaggioChatSistema(`${oldName} changed their name to ${giocatore.nome}.`);
            aggiornaStatoLobby();
        }
    });

    socket.on('inizia-partita', () => {
        if (socket.id === hostID && giocatori.length >= 2 && !partitaInCorso) {
            partitaInCorso = true;
            shuffle(giocatori); // Mescola l'ordine dei giocatori per il primo master
            distribuisciCarteIniziali();
            inviaMessaggioChatSistema("The game is starting!");
            iniziaNuovoTurno();
        } else {
            socket.emit('errore', 'You cannot start the game.');
        }
    });

    socket.on('gioca-carta', (cartaScelta) => {
        const giocatore = getGiocatore(socket.id);
        if (giocatore && !giocatore.haGiocato && giocatore.id !== masterCorrenteID && partitaInCorso) {
            const indiceCarta = giocatore.mano.indexOf(cartaScelta);
            if (indiceCarta > -1) {
                giocatore.mano.splice(indiceCarta, 1);
                carteBiancheGiocate.push({
                    giocatoreID: socket.id,
                    nome: giocatore.nome,
                    carta: cartaScelta,
                    ordine: Math.random() // Per mescolare l'ordine di visualizzazione
                });
                giocatore.haGiocato = true;
                io.to(socket.id).emit('aggiorna-mano', giocatore.mano); // Aggiorna la mano del giocatore
                aggiornaStatoLobby(); // Aggiorna lo stato "ha giocato"

                const nonMasterPlayers = giocatori.filter(g => g.id !== masterCorrenteID && !g.inAttesa);
                const tuttiHannoGiocato = nonMasterPlayers.every(g => g.haGiocato);

                if (tuttiHannoGiocato) {
                    // Tutti i giocatori hanno giocato, inizia la fase di rivelazione
                    io.emit('inizia-fase-rivelazione', { numCarte: carteBiancheGiocate.length });
                    io.to(masterCorrenteID).emit('sei-pronto-a-rivelare');
                }
            }
        }
    });
    
    socket.on('rivolgi-carta', (data) => {
        if (socket.id === masterCorrenteID && partitaInCorso) {
            const index = parseInt(data.index);
            if (index >= 0 && index < carteBiancheGiocate.length) {
                const cartaRivelata = shuffle(carteBiancheGiocate.filter(c => !c.rivelata))[0]; // Riveliamo una carta non ancora rivelata
                if (cartaRivelata) {
                    cartaRivelata.rivelata = true;
                    // Trova l'indice della carta appena rivelata nell'array originale mescolato
                    const actualIndex = carteBiancheGiocate.findIndex(c => c === cartaRivelata);

                    io.emit('carta-rivelata', {
                        index: actualIndex, // Invia l'indice della carta nel suo ordine mescolato
                        testoCarta: cartaRivelata.carta
                    });

                    const tutteRivelate = carteBiancheGiocate.every(c => c.rivelata);
                    if (tutteRivelate) {
                        io.to(masterCorrenteID).emit('mostra-pulsante-scegli');
                        io.emit('attendi-scelta-finale'); // Notifica agli altri che il master sta scegliendo
                    }
                }
            }
        }
    });

    socket.on('scegli-vincitore', (cartaVincitriceTesto) => {
        if (socket.id === masterCorrenteID && partitaInCorso) {
            const cartaVincitriceObj = carteBiancheGiocate.find(c => c.carta === cartaVincitriceTesto);
            if (cartaVincitriceObj) {
                const vincitore = getGiocatore(cartaVincitriceObj.giocatoreID);
                if (vincitore) {
                    vincitore.punti++;
                    io.emit('annuncia-vincitore', {
                        vincitoreID: vincitore.id,
                        vincitoreNome: vincitore.nome,
                        cartaVincitrice: cartaVincitriceTesto,
                        cartaNera: carteNeraCorrente,
                        countdown: 10
                    });

                    if (vincitore.punti >= PUNTEGGIO_PER_VINCERE) {
                        inviaMessaggioChatSistema(`${vincitore.nome} won the game!`);
                        setTimeout(terminaPartita, 10000); // Termina la partita dopo 10 secondi
                    } else {
                        setTimeout(iniziaNuovoTurno, 10000); // Nuovo turno dopo 10 secondi
                    }
                }
            }
        }
    });
    
    socket.on('invia-messaggio-chat', (messaggio) => {
        const giocatore = getGiocatore(socket.id);
        if (giocatore) {
            io.emit('nuovo-messaggio-chat', {
                nome: giocatore.nome,
                messaggio: messaggio,
                isSystem: false
            });
        }
    });

    socket.on('disconnect', () => {
        console.log(`User ${socket.id} disconnected`);
        const giocatoreDisconnesso = getGiocatore(socket.id);
        const nomeDisconnesso = giocatoreDisconnesso ? giocatoreDisconnesso.nome : "A player";

        giocatori = giocatori.filter(g => g.id !== socket.id);

        if (giocatori.length === 0) {
            hostID = null;
            partitaInCorso = false;
        } else if (socket.id === hostID) {
            hostID = giocatori[0].id; // Assegna il nuovo host al primo giocatore rimanente
            inviaMessaggioChatSistema(`${nomeDisconnesso} disconnected. ${giocatori[0].nome} is now the host.`);
        } else {
            inviaMessaggioChatSistema(`${nomeDisconnesso} has left the lobby.`);
        }

        aggiornaStatoLobby();

        // Se la partita è in corso e il master si disconnette
        if (partitaInCorso && socket.id === masterCorrenteID) {
            inviaMessaggioChatSistema(`The Master (${nomeDisconnesso}) disconnected. The game is stopping.`);
            terminaPartita();
        }
        // Se la partita è in corso e un giocatore si disconnette
        else if (partitaInCorso) {
            // Controlla se tutti gli altri giocatori non master hanno giocato
            const nonMasterPlayers = giocatori.filter(g => g.id !== masterCorrenteID && !g.inAttesa);
            const tuttiHannoGiocato = nonMasterPlayers.every(g => g.haGiocato);

            // Se eravamo in fase di gioco e il giocatore disconnesso non era il master
            if (masterCorrenteID && socket.id !== masterCorrenteID && tuttiHannoGiocato && !carteBiancheGiocate.every(c => c.rivelata)) {
                // Se tutti gli altri non master hanno giocato e il master non ha ancora rivelato tutte le carte
                // Forziamo il passaggio alla rivelazione
                 io.emit('inizia-fase-rivelazione', { numCarte: carteBiancheGiocate.length });
                 io.to(masterCorrenteID).emit('sei-pronto-a-rivelare');
                 inviaMessaggioChatSistema("All active players have played their cards. Master, please reveal.");
            }
        }
    });
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser to play!`);
});
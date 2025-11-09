const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname));
app.use('/style', express.static(__dirname + '/style'));
app.use('/img', express.static(__dirname + '/img')); 
app.use('/sound', express.static(__dirname + '/sound'));

let giocatori = [];
let hostID = null;
let partitaInCorso = false;
let carteNere = require('./decks/black_cards.json');
let carteBianche = require('./decks/white_cards.json');

let mazzoCarteNere = [...carteNere];
let mazzoCarteBianche = [...carteBianche];
let carteNeraCorrente = '';
let carteBiancheGiocate = []; 
let masterCorrenteID = null;
let roundAttuale = 0;
const MAX_CARTE_MANO = 7;
const NUM_CARTE_MASTER = 1; 
const PUNTEGGIO_PER_VINCERE = 5; // Punteggio per vincere la partita

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function pescaCartaNera() {
    if (mazzoCarteNere.length === 0) {
        mazzoCarteNere = shuffle([...carteNere]); 
    }
    return mazzoCarteNere.pop();
}

function pescaCartaBianca(numero = 1) {
    if (mazzoCarteBianche.length < numero) {
        mazzoCarteBianche = shuffle([...carteBianche]); 
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
    return giocatore ? giocatore.nome : "Unkown Player"; 
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
    
    if (giocatori.length > 0) {
        const masterIndex = (giocatori.findIndex(g => g.id === masterCorrenteID) + 1) % giocatori.length;
        masterCorrenteID = giocatori[masterIndex].id;
    } else {
        masterCorrenteID = null; 
    }

    carteNeraCorrente = pescaCartaNera();

    giocatori.forEach(g => {
        g.haGiocato = false;
        if (g.inAttesa) { 
            g.inAttesa = false;
            if (!g.nome.startsWith("Player")) { 
                 inviaMessaggioChatSistema(`${g.nome} is now playing!`);
            }
        }
        if (g.id !== masterCorrenteID) {  
            const carteDaPescare = MAX_CARTE_MANO - g.mano.length;
            if (carteDaPescare > 0) {
                g.mano.push(...pescaCartaBianca(carteDaPescare));
            }
        } else {
            g.mano = []; 
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
    aggiornaStatoLobby(); 
}

function terminaPartita() {
    partitaInCorso = false;
    masterCorrenteID = null;
    giocatori.forEach(g => {
        g.mano = [];
        g.punti = 0;
        g.haGiocato = false;
        g.inAttesa = false; 
        io.to(g.id).emit('aggiorna-mano', []); 
    });
    inviaMessaggioChatSistema("The game has ended. Returning to lobby.");
    aggiornaStatoLobby();
}

io.on('connection', (socket) => {
    console.log(`User ${socket.id} connected`);

    // Assegna nome di default 
    let playerName = `Player${giocatori.length + 1}`;
    giocatori.push({
        id: socket.id,
        nome: playerName,
        punti: 0,
        mano: [],
        haGiocato: false,
        inAttesa: false 
    });

    if (giocatori.length === 1) {
        hostID = socket.id;
    }

    socket.emit('imposta-nome-default', playerName);

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
            shuffle(giocatori); 
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
                    ordine: Math.random() 
                });
                giocatore.haGiocato = true;
                io.to(socket.id).emit('aggiorna-mano', giocatore.mano); 
                aggiornaStatoLobby(); 
                const nonMasterPlayers = giocatori.filter(g => g.id !== masterCorrenteID && !g.inAttesa);
                const tuttiHannoGiocato = nonMasterPlayers.every(g => g.haGiocato);

                if (tuttiHannoGiocato) {
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
                const cartaRivelata = shuffle(carteBiancheGiocate.filter(c => !c.rivelata))[0]; 
                if (cartaRivelata) {
                    cartaRivelata.rivelata = true;
                    const actualIndex = carteBiancheGiocate.findIndex(c => c === cartaRivelata);

                    io.emit('carta-rivelata', {
                        index: actualIndex, 
                        testoCarta: cartaRivelata.carta
                    });

                    const tutteRivelate = carteBiancheGiocate.every(c => c.rivelata);
                    if (tutteRivelate) {
                        io.to(masterCorrenteID).emit('mostra-pulsante-scegli');
                        io.emit('attendi-scelta-finale'); 
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
            hostID = giocatori[0].id; 
            inviaMessaggioChatSistema(`${nomeDisconnesso} disconnected. ${giocatori[0].nome} is now the host.`);
        } else {
            inviaMessaggioChatSistema(`${nomeDisconnesso} has left the lobby.`);
        }

        aggiornaStatoLobby();

        if (partitaInCorso && socket.id === masterCorrenteID) {
            inviaMessaggioChatSistema(`The Master (${nomeDisconnesso}) disconnected. The game is stopping.`);
            terminaPartita();
        }
        else if (partitaInCorso) {
            const nonMasterPlayers = giocatori.filter(g => g.id !== masterCorrenteID && !g.inAttesa);
            const tuttiHannoGiocato = nonMasterPlayers.every(g => g.haGiocato);

            if (masterCorrenteID && socket.id !== masterCorrenteID && tuttiHannoGiocato && !carteBiancheGiocate.every(c => c.rivelata)) {
                
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
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
app.use('/client', express.static(__dirname + '/client')); 

// --- Deck Loading ---
const carteNereBase = require('./decks/black_cards.json');
const carteBiancheBase = require('./decks/white_cards.json');

// --- ROOM MANAGER ---
let stanze = new Map(); 
let lobbyPubbliche = new Map(); 

// --- Game Constants ---
const MAX_CARTE_MANO = 7;
const PUNTEGGIO_PER_VINCERE = 5;

// ==================================================================
// HELPER FUNCTIONS
// ==================================================================

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function generaCodiceLobby() {
    let codice = '';
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
    do {
        codice = '';
        for (let i = 0; i < 5; i++) {
            codice += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (stanze.has(codice)); 
    return codice;
}

function getGiocatore(stanza, id) {
    if (!stanza) return null;
    return stanza.giocatori.find(g => g.id === id);
}

function broadcastListaLobby() {
    io.emit('aggiorna-lobby-pubbliche', Array.from(lobbyPubbliche.values()));
}

function inviaMessaggioChatSistema(codice, messaggio) {
    io.to(codice).emit('nuovo-messaggio-chat', {
        nome: "System",
        messaggio: messaggio,
        isSystem: true
    });
}

function aggiornaStatoLobby(codice) {
    const stanza = stanze.get(codice);
    if (!stanza) return;

    // Aggiorna la lista pubblica SOLO SE la lobby è pubblica
    if (!stanza.isPrivate) {
        const lobbyPub = lobbyPubbliche.get(codice);
        if (lobbyPub) {
            lobbyPub.numGiocatori = stanza.giocatori.length;
            broadcastListaLobby();
        }
    }

    io.to(codice).emit('aggiorna-lista-giocatori', {
        giocatori: stanza.giocatori.map(g => ({
            id: g.id,
            nome: g.nome,
            punti: g.punti,
            inAttesa: g.inAttesa,
            haGiocato: g.haGiocato
        })),
        hostID: stanza.hostID,
        partitaInCorso: stanza.partitaInCorso,
        maxGiocatori: stanza.maxGiocatori, 
        numGiocatori: stanza.giocatori.length,
        isPrivate: stanza.isPrivate // <-- Invia lo stato di privacy
    });
}

// ==================================================================
// GAME LOGIC (Per-Room)
// ==================================================================

function pescaCartaNera(stanza) {
    if (stanza.mazzoCarteNere.length === 0) {
        stanza.mazzoCarteNere = shuffle([...carteNereBase]); 
    }
    return stanza.mazzoCarteNere.pop();
}

function pescaCartaBianca(stanza, numero = 1) {
    if (stanza.mazzoCarteBianche.length < numero) {
        stanza.mazzoCarteBianche = shuffle([...carteBiancheBase]); 
    }
    const pescate = [];
    for (let i = 0; i < numero; i++) {
        pescate.push(stanza.mazzoCarteBianche.pop());
    }
    return pescate;
}

function distribuisciCarteIniziali(stanza) {
    stanza.giocatori.forEach(g => {
        g.mano = pescaCartaBianca(stanza, MAX_CARTE_MANO);
        g.punti = 0;
        g.haGiocato = false;
        g.inAttesa = false;
    });
}

function iniziaNuovoTurno(codice) {
    const stanza = stanze.get(codice);
    if (!stanza || stanza.giocatori.length < 2) {
        if (stanza) terminaPartita(codice, "Not enough players to continue.");
        return;
    }
    
    stanza.roundAttuale++;
    stanza.carteBiancheGiocate = [];
    
    const masterIndex = (stanza.giocatori.findIndex(g => g.id === stanza.masterCorrenteID) + 1) % stanza.giocatori.length;
    stanza.masterCorrenteID = stanza.giocatori[masterIndex].id;

    stanza.carteNeraCorrente = pescaCartaNera(stanza);

    stanza.giocatori.forEach(g => {
        g.haGiocato = false;
        if (g.inAttesa) { 
            g.inAttesa = false;
            inviaMessaggioChatSistema(codice, `${g.nome} is now playing!`);
        }
        if (g.id !== stanza.masterCorrenteID) {
            const carteDaPescare = MAX_CARTE_MANO - g.mano.length;
            if (carteDaPescare > 0) {
                g.mano.push(...pescaCartaBianca(stanza, carteDaPescare));
            }
        } else {
            g.mano = []; 
        }
    });

    io.to(codice).emit('nuovo-turno', {
        cartaNera: stanza.carteNeraCorrente,
        masterID: stanza.masterCorrenteID,
        round: stanza.roundAttuale
    });

    stanza.giocatori.forEach(g => {
        io.to(g.id).emit('aggiorna-mano', g.mano);
        io.to(g.id).emit('aggiorna-stato-ruolo', { isMaster: g.id === stanza.masterCorrenteID });
    });
    aggiornaStatoLobby(codice); 
}

function terminaPartita(codice, messaggio = "The game has ended. Returning to lobby.") {
    const stanza = stanze.get(codice);
    if (!stanza) return;

    stanza.partitaInCorso = false;
    stanza.masterCorrenteID = null;
    stanza.giocatori.forEach(g => {
        g.mano = [];
        g.punti = 0;
        g.haGiocato = false;
        g.inAttesa = false; 
        io.to(g.id).emit('aggiorna-mano', []); 
    });
    inviaMessaggioChatSistema(codice, messaggio);
    aggiornaStatoLobby(codice);
}


// ==================================================================
// CONNECTION HANDLING
// ==================================================================

io.on('connection', (socket) => {
    console.log(`User ${socket.id} connected`);
    
    socket.emit('aggiorna-lobby-pubbliche', Array.from(lobbyPubbliche.values()));

    // --- LOBBY LOGIC ---

    socket.on('crea-lobby', (dati) => {
        const codice = generaCodiceLobby();
        const nomeStanza = dati.nome.substring(0, 20); 
        const isPrivate = dati.isPrivate || false; 

        const host = {
            id: socket.id,
            nome: `Player1`,
            punti: 0,
            mano: [],
            haGiocato: false,
            inAttesa: false
        };

        const nuovaStanza = {
            codice: codice,
            nome: nomeStanza, 
            maxGiocatori: dati.maxGiocatori,
            isPrivate: isPrivate, 
            hostID: socket.id,
            giocatori: [host],
            partitaInCorso: false,
            mazzoCarteNere: shuffle([...carteNereBase]),
            mazzoCarteBianche: shuffle([...carteBiancheBase]),
            carteNeraCorrente: '',
            carteBiancheGiocate: [],
            masterCorrenteID: null,
            roundAttuale: 0
        };

        stanze.set(codice, nuovaStanza);

        if (!isPrivate) {
            lobbyPubbliche.set(codice, {
                codice: codice,
                nome: nomeStanza, 
                numGiocatori: 1,
                maxGiocatori: dati.maxGiocatori
            });
            broadcastListaLobby();
        }
        
        socket.join(codice);
        socket.stanzaCorrente = codice;

        socket.emit('imposta-nome-default', host.nome);
        socket.emit('unito-alla-lobby', { codice: codice, nome: nomeStanza });
        
        aggiornaStatoLobby(codice); 
        console.log(`User ${socket.id} created lobby ${codice} (Private: ${isPrivate})`);
    });

    socket.on('unisciti-con-codice', (codice) => {
        const stanza = stanze.get(codice);

        if (!stanza) {
            socket.emit('errore-lobby', 'Code not found. Please check and try again.');
            return;
        }
        if (stanza.giocatori.length >= stanza.maxGiocatori) {
            socket.emit('errore-lobby', 'This lobby is full.');
            return;
        }

        const nuovoGiocatore = {
            id: socket.id,
            nome: `Player${stanza.giocatori.length + 1}`,
            punti: 0,
            mano: [],
            haGiocato: false,
            inAttesa: stanza.partitaInCorso 
        };
        
        stanza.giocatori.push(nuovoGiocatore);
        
        socket.join(codice);
        socket.stanzaCorrente = codice;
        
        socket.emit('imposta-nome-default', nuovoGiocatore.nome);
        socket.emit('unito-alla-lobby', { codice: codice, nome: stanza.nome });
        
        inviaMessaggioChatSistema(codice, `${nuovoGiocatore.nome} has joined the lobby!`);
        
        aggiornaStatoLobby(codice); 
        console.log(`User ${socket.id} joined lobby ${codice}`);
    });


    socket.on('toggle-lobby-privacy', (isPrivate) => {
        const codice = socket.stanzaCorrente;
        if (!codice) return;
        const stanza = stanze.get(codice);
        if (!stanza) return;
        if (socket.id !== stanza.hostID) {
            return; 
        }

        stanza.isPrivate = isPrivate;

        if (isPrivate) {
            if (lobbyPubbliche.has(codice)) {
                lobbyPubbliche.delete(codice);
                broadcastListaLobby();
            }
        } else {
            lobbyPubbliche.set(codice, {
                codice: codice,
                nome: stanza.nome,
                numGiocatori: stanza.giocatori.length,
                maxGiocatori: stanza.maxGiocatori
            });
            broadcastListaLobby();
        }

        inviaMessaggioChatSistema(codice, `The host made the lobby ${isPrivate ? 'private' : 'public'}.`);
        aggiornaStatoLobby(codice); 
    });


    socket.on('imposta-nome', (nuovoNome) => {
        const codice = socket.stanzaCorrente;
        if (!codice) return;
        const stanza = stanze.get(codice);
        if (!stanza) return;
        
        const giocatore = getGiocatore(stanza, socket.id);
        if (giocatore) {
            const oldName = giocatore.nome;
            giocatore.nome = nuovoNome.substring(0, 20);
            inviaMessaggioChatSistema(codice, `${oldName} changed their name to ${giocatore.nome}.`);
            aggiornaStatoLobby(codice);
        }
    });

    socket.on('inizia-partita', () => {
        const codice = socket.stanzaCorrente;
        if (!codice) return;
        const stanza = stanze.get(codice);
        if (!stanza) return;

        if (socket.id === stanza.hostID && stanza.giocatori.length >= 2 && !stanza.partitaInCorso) {
            stanza.partitaInCorso = true;
            shuffle(stanza.giocatori); 
            distribuisciCarteIniziali(stanza);
            inviaMessaggioChatSistema(codice, "The game is starting!");
            iniziaNuovoTurno(codice);
        } else {
            socket.emit('errore', 'You cannot start the game (must be host, >= 2 players).');
        }
    });

    socket.on('gioca-carta', (cartaScelta) => {
        const codice = socket.stanzaCorrente;
        if (!codice) return;
        const stanza = stanze.get(codice);
        if (!stanza) return;
        
        const giocatore = getGiocatore(stanza, socket.id);
        if (giocatore && !giocatore.haGiocato && giocatore.id !== stanza.masterCorrenteID && stanza.partitaInCorso) {
            const indiceCarta = giocatore.mano.indexOf(cartaScelta);
            if (indiceCarta > -1) {
                giocatore.mano.splice(indiceCarta, 1);
                stanza.carteBiancheGiocate.push({
                    giocatoreID: socket.id,
                    nome: giocatore.nome,
                    carta: cartaScelta,
                    ordine: Math.random() 
                });
                giocatore.haGiocato = true;
                io.to(socket.id).emit('aggiorna-mano', giocatore.mano); 
                aggiornaStatoLobby(codice); 

                const nonMasterPlayers = stanza.giocatori.filter(g => g.id !== stanza.masterCorrenteID && !g.inAttesa);
                const tuttiHannoGiocato = nonMasterPlayers.every(g => g.haGiocato);

                if (tuttiHannoGiocato) {
                    io.to(codice).emit('inizia-fase-rivelazione', { numCarte: stanza.carteBiancheGiocate.length });
                    io.to(stanza.masterCorrenteID).emit('sei-pronto-a-rivelare');
                }
            }
        }
    });
    
    socket.on('rivolgi-carta', (data) => {
        const codice = socket.stanzaCorrente;
        if (!codice) return;
        const stanza = stanze.get(codice);
        if (!stanza) return;

        if (socket.id === stanza.masterCorrenteID && stanza.partitaInCorso) {
            const index = parseInt(data.index);
            const carteOrdinate = stanza.carteBiancheGiocate.sort((a,b) => a.ordine - b.ordine);
            const cartaDaRivelare = carteOrdinate[index];

            if (cartaDaRivelare && !cartaDaRivelare.rivelata) {
                cartaDaRivelare.rivelata = true;
                
                io.to(codice).emit('carta-rivelata', {
                    index: index,
                    testoCarta: cartaDaRivelare.carta
                });

                const tutteRivelate = stanza.carteBiancheGiocate.every(c => c.rivelata);
                if (tutteRivelate) {
                    io.to(stanza.masterCorrenteID).emit('mostra-pulsante-scegli');
                    io.to(codice).emit('attendi-scelta-finale');
                }
            }
        }
    });

    socket.on('scegli-vincitore', (cartaVincitriceTesto) => {
        const codice = socket.stanzaCorrente;
        if (!codice) return;
        const stanza = stanze.get(codice);
        if (!stanza) return;

        if (socket.id === stanza.masterCorrenteID && stanza.partitaInCorso) {
            const cartaVincitriceObj = stanza.carteBiancheGiocate.find(c => c.carta === cartaVincitriceTesto);
            if (cartaVincitriceObj) {
                const vincitore = getGiocatore(stanza, cartaVincitriceObj.giocatoreID);
                if (vincitore) {
                    vincitore.punti++;
                    io.to(codice).emit('annuncia-vincitore', {
                        vincitoreID: vincitore.id,
                        vincitoreNome: vincitore.nome,
                        cartaVincitrice: cartaVincitriceTesto,
                        cartaNera: stanza.carteNeraCorrente,
                        countdown: 10
                    });

                    if (vincitore.punti >= PUNTEGGIO_PER_VINCERE) {
                        inviaMessaggioChatSistema(codice, `${vincitore.nome} won the game!`);
                        setTimeout(() => terminaPartita(codice), 10000); 
                    } else {
                        setTimeout(() => iniziaNuovoTurno(codice), 10000); 
                    }
                }
            }
        }
    });
    
    socket.on('invia-messaggio-chat', (messaggio) => {
        const codice = socket.stanzaCorrente;
        if (!codice) return;
        const stanza = stanze.get(codice);
        if (!stanza) return;
        
        const giocatore = getGiocatore(stanza, socket.id);
        if (giocatore) {
            io.to(codice).emit('nuovo-messaggio-chat', {
                id: socket.id, 
                nome: giocatore.nome,
                messaggio: messaggio,
                isSystem: false
            });
        }
    });

    socket.on('disconnect', () => {
        console.log(`User ${socket.id} disconnected`);
        const codice = socket.stanzaCorrente;
        if (!codice) {
            console.log("User was not in a lobby.");
            return; 
        }

        const stanza = stanze.get(codice);
        if (!stanza) {
            console.log(`Lobby ${codice} not found.`);
            return;
        }

        const giocatoreDisconnesso = getGiocatore(stanza, socket.id);
        const nomeDisconnesso = giocatoreDisconnesso ? giocatoreDisconnesso.nome : "A player";

        stanza.giocatori = stanza.giocatori.filter(g => g.id !== socket.id);

        if (stanza.giocatori.length === 0) {
            stanze.delete(codice);
            if (lobbyPubbliche.has(codice)) {
                lobbyPubbliche.delete(codice); 
                broadcastListaLobby(); 
            }
            console.log(`Lobby ${codice} is empty and has been deleted.`);
            return;
        }
        
        if (socket.id === stanza.hostID) {
            stanza.hostID = stanza.giocatori[0].id; 
            inviaMessaggioChatSistema(codice, `${nomeDisconnesso} (Host) disconnected. ${stanza.giocatori[0].nome} is now the host.`);
        } else {
            inviaMessaggioChatSistema(codice, `${nomeDisconnesso} has left the lobby.`);
        }

        if (stanza.partitaInCorso) {
            if (socket.id === stanza.masterCorrenteID) {
                inviaMessaggioChatSistema(codice, `The Master (${nomeDisconnesso}) disconnected. The game is stopping.`);
                terminaPartita(codice);
            }
            else {
                const nonMasterPlayers = stanza.giocatori.filter(g => g.id !== stanza.masterCorrenteID && !g.inAttesa);
                const tuttiHannoGiocato = nonMasterPlayers.every(g => g.haGiocato);

                if (tuttiHannoGiocato && stanza.carteBiancheGiocate.length > 0) {
                     io.to(codice).emit('inizia-fase-rivelazione', { numCarte: stanza.carteBiancheGiocate.length });
                     io.to(stanza.masterCorrenteID).emit('sei-pronto-a-rivelare');
                     inviaMessaggioChatSistema(codice, `${nomeDisconnesso} disconnected. All active players have played. Master, please reveal.`);
                }
            }
        }
        
        aggiornaStatoLobby(codice);
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
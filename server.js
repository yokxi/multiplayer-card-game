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

// --- Caricamento Mazzi (globale, non cambia) ---
const carteNereBase = require('./decks/black_cards.json');
const carteBiancheBase = require('./decks/white_cards.json');

// --- GESTORE STANZE (NUOVO) ---
// Tutta la logica del gioco ora vive qui dentro.
// La chiave è il 'codiceLobby', il valore è l'oggetto 'stanza'.
let stanze = new Map();

// --- Costanti di Gioco ---
const MAX_CARTE_MANO = 7;
const PUNTEGGIO_PER_VINCERE = 5;

// ==================================================================
// FUNZIONI HELPER (Molte ora richiedono la 'stanza' come parametro)
// ==================================================================

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Genera un codice lobby unico di 5 caratteri
function generaCodiceLobby() {
    let codice = '';
    const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'; // Esclusa la O per evitare confusione con 0
    do {
        codice = '';
        for (let i = 0; i < 5; i++) {
            codice += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (stanze.has(codice)); // Continua a generare finché non è unico
    return codice;
}

function getGiocatore(stanza, id) {
    if (!stanza) return null;
    return stanza.giocatori.find(g => g.id === id);
}

// Invia un messaggio di sistema SOLO a una stanza
function inviaMessaggioChatSistema(codice, messaggio) {
    io.to(codice).emit('nuovo-messaggio-chat', {
        nome: "System",
        messaggio: messaggio,
        isSystem: true
    });
}

// Aggiorna lo stato della lobby SOLO per i giocatori in quella stanza
function aggiornaStatoLobby(codice) {
    const stanza = stanze.get(codice);
    if (!stanza) return; // Se la stanza non esiste (es. è stata chiusa), non fare nulla

    io.to(codice).emit('aggiorna-lista-giocatori', {
        giocatori: stanza.giocatori.map(g => ({
            id: g.id,
            nome: g.nome,
            punti: g.punti,
            inAttesa: g.inAttesa,
            haGiocato: g.haGiocato
        })),
        hostID: stanza.hostID,
        partitaInCorso: stanza.partitaInCorso
    });
}

// ==================================================================
// LOGICA DI GIOCO (Ora tutto per-stanza)
// ==================================================================

function pescaCartaNera(stanza) {
    if (stanza.mazzoCarteNere.length === 0) {
        stanza.mazzoCarteNere = shuffle([...carteNereBase]); // Ricarica
    }
    return stanza.mazzoCarteNere.pop();
}

function pescaCartaBianca(stanza, numero = 1) {
    if (stanza.mazzoCarteBianche.length < numero) {
        stanza.mazzoCarteBianche = shuffle([...carteBiancheBase]); // Ricarica
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
        // Se la stanza non esiste o ci sono meno di 2 giocatori, termina la partita
        if (stanza) terminaPartita(codice, "Not enough players to continue.");
        return;
    }
    
    stanza.roundAttuale++;
    stanza.carteBiancheGiocate = [];
    
    // Assegna il prossimo Master
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
            g.mano = []; // Master non ha carte bianche
        }
    });

    // Emetti SOLO alla stanza
    io.to(codice).emit('nuovo-turno', {
        cartaNera: stanza.carteNeraCorrente,
        masterID: stanza.masterCorrenteID,
        round: stanza.roundAttuale
    });

    stanza.giocatori.forEach(g => {
        io.to(g.id).emit('aggiorna-mano', g.mano);
        io.to(g.id).emit('aggiorna-stato-ruolo', { isMaster: g.id === stanza.masterCorrenteID });
    });
    aggiornaStatoLobby(codice); // Aggiorna lo stato dei giocatori
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
// GESTIONE CONNESSIONI (Molto diverso ora)
// ==================================================================

io.on('connection', (socket) => {
    console.log(`User ${socket.id} connected`);
    
    // Non facciamo nulla qui. L'utente è nel "menu".
    // Aspettiamo che crei o si unisca a una lobby.

    // --- NUOVA LOGICA LOBBY ---

    socket.on('crea-lobby', (dati) => {
        const codice = generaCodiceLobby();
        
        // Crea il giocatore (che è l'host)
        const host = {
            id: socket.id,
            nome: `Player1`,
            punti: 0,
            mano: [],
            haGiocato: false,
            inAttesa: false
        };

        // Crea la nuova stanza
        const nuovaStanza = {
            codice: codice,
            nome: dati.nome,
            maxGiocatori: dati.maxGiocatori,
            hostID: socket.id,
            giocatori: [host],
            partitaInCorso: false,
            // Stato di gioco per questa stanza
            mazzoCarteNere: shuffle([...carteNereBase]),
            mazzoCarteBianche: shuffle([...carteBiancheBase]),
            carteNeraCorrente: '',
            carteBiancheGiocate: [],
            masterCorrenteID: null,
            roundAttuale: 0
        };

        // Salva la stanza
        stanze.set(codice, nuovaStanza);

        // Aggiungi il socket alla "room" di Socket.IO per il broadcast
        socket.join(codice);
        // Salva il codice della stanza sul socket per trovarlo al disconnect
        socket.stanzaCorrente = codice;

        // Invia al client il suo nome e che si è unito
        socket.emit('imposta-nome-default', host.nome);
        socket.emit('unito-alla-lobby', { codice: codice });
        
        // Aggiorna la lobby per il creatore
        aggiornaStatoLobby(codice);
        console.log(`User ${socket.id} created lobby ${codice}`);
    });

    socket.on('unisciti-con-codice', (codice) => {
        const stanza = stanze.get(codice);

        // Controlli
        if (!stanza) {
            socket.emit('errore-lobby', 'Codice non trovato. Controlla e riprova.');
            return;
        }
        if (stanza.giocatori.length >= stanza.maxGiocatori) {
            socket.emit('errore-lobby', 'Questa lobby è piena.');
            return;
        }

        // Crea il nuovo giocatore
        const nuovoGiocatore = {
            id: socket.id,
            nome: `Player${stanza.giocatori.length + 1}`,
            punti: 0,
            mano: [],
            haGiocato: false,
            inAttesa: stanza.partitaInCorso // Se la partita è in corso, entra in attesa
        };
        
        // Aggiungi il giocatore alla stanza
        stanza.giocatori.push(nuovoGiocatore);
        
        // Aggiungi il socket alla room
        socket.join(codice);
        socket.stanzaCorrente = codice;
        
        // Invia al client il suo nome e che si è unito
        socket.emit('imposta-nome-default', nuovoGiocatore.nome);
        socket.emit('unito-alla-lobby', { codice: codice });
        
        inviaMessaggioChatSistema(codice, `${nuovoGiocatore.nome} has joined the lobby!`);
        
        // Aggiorna la lobby per tutti
        aggiornaStatoLobby(codice);
        console.log(`User ${socket.id} joined lobby ${codice}`);
    });


    // --- LOGICA DI GIOCO (Ora "room-aware") ---
    // Tutti gli eventi ora devono prima trovare la stanza

    socket.on('imposta-nome', (nuovoNome) => {
        const codice = socket.stanzaCorrente;
        if (!codice) return;
        const stanza = stanze.get(codice);
        if (!stanza) return;
        
        const giocatore = getGiocatore(stanza, socket.id);
        if (giocatore) {
            const oldName = giocatore.nome;
            giocatore.nome = nuovoNome.substring(0, 20); // Limita lunghezza
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
            // Ordiniamo le carte in base all'ordine random e prendiamo quella all'indice cliccato
            const carteOrdinate = stanza.carteBiancheGiocate.sort((a,b) => a.ordine - b.ordine);
            const cartaDaRivelare = carteOrdinate[index];

            if (cartaDaRivelare && !cartaDaRivelare.rivelata) {
                cartaDaRivelare.rivelata = true;
                
                io.to(codice).emit('carta-rivelata', {
                    index: index, // Invia l'indice della carta nel suo ordine
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
                id: socket.id, // Invia l'ID per il confronto 'tu'
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
            return; // L'utente non era in nessuna stanza
        }

        const stanza = stanze.get(codice);
        if (!stanza) {
            console.log(`Lobby ${codice} not found for disconnected user.`);
            return; // La stanza non esiste più
        }

        const giocatoreDisconnesso = getGiocatore(stanza, socket.id);
        const nomeDisconnesso = giocatoreDisconnesso ? giocatoreDisconnesso.nome : "A player";

        // Rimuovi il giocatore dalla lista
        stanza.giocatori = stanza.giocatori.filter(g => g.id !== socket.id);

        if (stanza.giocatori.length === 0) {
            // Se la stanza è vuota, eliminala
            stanze.delete(codice);
            console.log(`Lobby ${codice} is empty and has been deleted.`);
            return;
        }

        // Se l'host si disconnette, assegna un nuovo host
        if (socket.id === stanza.hostID) {
            stanza.hostID = stanza.giocatori[0].id; // Assegna al primo giocatore rimasto
            inviaMessaggioChatSistema(codice, `${nomeDisconnesso} (Host) disconnected. ${stanza.giocatori[0].nome} is now the host.`);
        } else {
            inviaMessaggioChatSistema(codice, `${nomeDisconnesso} has left the lobby.`);
        }

        // Se la partita è in corso
        if (stanza.partitaInCorso) {
            // Se il Master si disconnette, termina la partita
            if (socket.id === stanza.masterCorrenteID) {
                inviaMessaggioChatSistema(codice, `The Master (${nomeDisconnesso}) disconnected. The game is stopping.`);
                terminaPartita(codice);
            }
            // Se un giocatore (non master) si disconnette, controlla se era l'ultimo a dover giocare
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

        // Infine, aggiorna la lobby per tutti quelli rimasti
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
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORTA = 3000;
app.use(express.static(__dirname));

const MAZZO_CARTE_NERE = require('./decks/black_cards.json');
const MAZZO_CARTE_BIANCHE = require('./decks/white_cards.json');

function mischiaMazzo(mazzo) {
    let mazzoMischiato = [...mazzo]; 
    for (let i = mazzoMischiato.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [mazzoMischiato[i], mazzoMischiato[j]] = [mazzoMischiato[j], mazzoMischiato[i]];
    }
    return mazzoMischiato;
}

let statoPartita = {
    giocatori: {}, 
    mazzoNero: [],
    mazzoBianco: [],
    carteScartateBianche: [],
    masterCorrente: null,
    cartaNeraDelTurno: null,
    carteGiocateDelTurno: {}, 
    carteDaRivelare: [],
    carteRivelate: {},
    partitaInCorso: false
};

let playerCounter = 1;

function pescaCartaBianca() {
    if (statoPartita.mazzoBianco.length === 0) {
        console.log("White deck empty! Reshuffling discards...");
        statoPartita.mazzoBianco = mischiaMazzo(statoPartita.carteScartateBianche);
        statoPartita.carteScartateBianche = [];
    }
    if (statoPartita.mazzoBianco.length === 0) {
        console.warn("WARNING: All decks empty! Using fallback card.");
        return "A generic white card";
    }
    return statoPartita.mazzoBianco.pop();
}

function aggiornaELinviaListaGiocatori() {
    const hostID = Object.keys(statoPartita.giocatori)[0] || null;
    
    const listaGiocatori = Object.values(statoPartita.giocatori).map(g => ({
        id: g.id,
        punti: g.punti,
        nome: g.nome,
        inAttesa: g.inAttesa,
        haGiocato: g.haGiocato
    }));
    
    io.emit('aggiorna-lista-giocatori', {
        giocatori: listaGiocatori,
        hostID: hostID,
        partitaInCorso: statoPartita.partitaInCorso
    });
}

io.on('connection', (socket) => {
    
    console.log(`🎉 A new player connected! ID: ${socket.id}`);

    statoPartita.giocatori[socket.id] = {
        id: socket.id,
        punti: 0,
        mano: [],
        nome: "Player" + playerCounter, 
        inAttesa: statoPartita.partitaInCorso,
        haGiocato: false
    };
    playerCounter++; 
    
    aggiornaELinviaListaGiocatori(); 

    socket.on('disconnect', () => {
        console.log(`😢 A player disconnected: ${socket.id}`);
        delete statoPartita.giocatori[socket.id];
        
        if (Object.keys(statoPartita.giocatori).length === 0) {
            playerCounter = 1; 
        }
        
        aggiornaELinviaListaGiocatori(); 
    });
    
    socket.on('imposta-nome', (nome) => {
        if (statoPartita.partitaInCorso) {
            console.log(`Player ${socket.id} tried to change name mid-game, but was blocked.`);
            return;
        }

        const nomePulito = String(nome).substring(0, 20).trim() || 'AnonymousPlayer';
        
        if (statoPartita.giocatori[socket.id]) {
            statoPartita.giocatori[socket.id].nome = nomePulito;
            console.log(`Player ${socket.id} set name to: ${nomePulito}`);
            aggiornaELinviaListaGiocatori();
        }
    });

    socket.on('inizia-partita', () => {
        const hostID = Object.keys(statoPartita.giocatori)[0] || null;
        if (socket.id !== hostID) return;
        
        const numGiocatori = Object.keys(statoPartita.giocatori).length;
        if (numGiocatori < 2) { 
            socket.emit('errore', 'Need at least 2 players to start (3 is better).');
            return;
        }
        if (statoPartita.partitaInCorso) return;

        console.log("🚀 Starting game!");
        statoPartita.partitaInCorso = true;
        
        statoPartita.mazzoBianco = mischiaMazzo(MAZZO_CARTE_BIANCHE);
        statoPartita.mazzoNero = mischiaMazzo(MAZZO_CARTE_NERE);
        statoPartita.carteScartateBianche = [];
        
        iniziaNuovoTurno();
    });

    function iniziaNuovoTurno() {
        console.log("Starting a new round...");
        if (!statoPartita.masterCorrente) {
            statoPartita.masterCorrente = Object.keys(statoPartita.giocatori)[0];
        }
        console.log('The Master is:', statoPartita.masterCorrente);
        
        statoPartita.carteGiocateDelTurno = {};
        statoPartita.carteDaRivelare = [];
        statoPartita.carteRivelate = {}; 

        for (const giocatoreID in statoPartita.giocatori) {
            const giocatore = statoPartita.giocatori[giocatoreID];
            if (giocatore.inAttesa) {
                console.log(`Activating waiting player: ${giocatoreID}`);
                giocatore.inAttesa = false;
            }
            giocatore.haGiocato = false;
        }
        
        statoPartita.cartaNeraDelTurno = statoPartita.mazzoNero.pop();
        if (!statoPartita.cartaNeraDelTurno) {
            console.log("Black cards empty! Reshuffling.");
            statoPartita.mazzoNero = mischiaMazzo(MAZZO_CARTE_NERE); 
            statoPartita.cartaNeraDelTurno = statoPartita.mazzoNero.pop();
        }

        aggiornaELinviaListaGiocatori();

        io.emit('nuovo-turno', {
            cartaNera: statoPartita.cartaNeraDelTurno,
            masterID: statoPartita.masterCorrente
        });

        for (const giocatoreID in statoPartita.giocatori) {
            const giocatore = statoPartita.giocatori[giocatoreID];
            
            if (giocatore.id !== statoPartita.masterCorrente && !giocatore.inAttesa) {
                while(giocatore.mano.length < 10) {
                    giocatore.mano.push(pescaCartaBianca());
                }
                io.to(giocatore.id).emit('aggiorna-mano', giocatore.mano);
                io.to(giocatore.id).emit('aggiorna-stato-ruolo', { isMaster: false });
            } else {
                giocatore.mano = []; 
                io.to(giocatore.id).emit('aggiorna-mano', []); 
                io.to(giocatore.id).emit('aggiorna-stato-ruolo', { isMaster: true });
            }
        }
    }
    
    socket.on('gioca-carta', (testoCarta) => {
        if (!statoPartita.partitaInCorso) return;
        if (socket.id === statoPartita.masterCorrente) return;
        if (statoPartita.carteGiocateDelTurno[socket.id]) return;

        statoPartita.carteGiocateDelTurno[socket.id] = testoCarta;
        const giocatore = statoPartita.giocatori[socket.id];
        giocatore.mano = giocatore.mano.filter(carta => carta !== testoCarta);
        statoPartita.carteScartateBianche.push(testoCarta);
        giocatore.haGiocato = true;
        aggiornaELinviaListaGiocatori();

        let numGiocatoriAttivi = 0;
        for (const id in statoPartita.giocatori) {
            if (!statoPartita.giocatori[id].inAttesa && id !== statoPartita.masterCorrente) {
                numGiocatoriAttivi++;
            }
        }
        const numCarteGiocate = Object.keys(statoPartita.carteGiocateDelTurno).length;

        if (numCarteGiocate === numGiocatoriAttivi && numGiocatoriAttivi > 0) {
            console.log("All players have played! Starting reveal phase.");
            
            statoPartita.carteDaRivelare = mischiaMazzo(Object.values(statoPartita.carteGiocateDelTurno));
            statoPartita.carteRivelate = {}; 

            io.emit('inizia-fase-rivelazione', { numCarte: statoPartita.carteDaRivelare.length });
            io.to(statoPartita.masterCorrente).emit('sei-pronto-a-rivelare');
        }
    });
    
    socket.on('rivolgi-carta', (data) => {
        if (!statoPartita.partitaInCorso || socket.id !== statoPartita.masterCorrente) {
            return;
        }
        
        const index = data.index;
        if (statoPartita.carteDaRivelare[index] && !statoPartita.carteRivelate[index]) {
            
            const testoCarta = statoPartita.carteDaRivelare[index];
            statoPartita.carteRivelate[index] = true;
            
            console.log(`Master revealed card ${index}: ${testoCarta}`);
            
            io.emit('carta-rivelata', { index: index, testoCarta: testoCarta });
            
            if (Object.keys(statoPartita.carteRivelate).length === statoPartita.carteDaRivelare.length) {
                console.log("All cards revealed. Activating Master choice.");
                io.to(statoPartita.masterCorrente).emit('mostra-pulsante-scegli');
                socket.broadcast.emit('attendi-scelta-finale');
            }
        }
    });

    socket.on('scegli-vincitore', (testoCartaScelta) => {
        if (!statoPartita.partitaInCorso || socket.id !== statoPartita.masterCorrente) {
            return;
        }
        let vincitoreID = null;
        for (const id in statoPartita.carteGiocateDelTurno) {
            if (statoPartita.carteGiocateDelTurno[id] === testoCartaScelta) {
                vincitoreID = id;
                break;
            }
        }
        if (vincitoreID && statoPartita.giocatori[vincitoreID]) {
            statoPartita.giocatori[vincitoreID].punti += 1;
            statoPartita.masterCorrente = vincitoreID;
            io.emit('annuncia-vincitore', {
                vincitoreID: vincitoreID,
                cartaVincitrice: testoCartaScelta,
                cartaNera: statoPartita.cartaNeraDelTurno
            });
            setTimeout(() => {
                iniziaNuovoTurno();
            }, 5000); 
        } else {
            console.log("Error: could not find winner for card:", testoCartaScelta);
        }
    });

});

server.listen(PORTA, () => {
    console.log(`🚀 Server listening on port ${PORTA}`);
    console.log(`Open http://localhost:${PORTA} in your browser to play!`);
});
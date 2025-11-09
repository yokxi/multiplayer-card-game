import { socket } from './socket.js';
import * as ui from './ui.js';
import { playSfx } from './audio.js'; // Importa la funzione per suonare SFX

// Stato locale del gioco
let stato = {
    mioRuolo: { isMaster: false },
    listaGiocatoriLocale: [], 
    masterCorrenteID: null,
    countdownInterval: null
};

// --- Funzioni Profilo ---
function attivaModificaNome() {
    ui.profiloNomeTesto.style.display = 'none';
    ui.profiloNomeInput.style.display = 'inline-block';
    ui.profiloNomeInput.value = ui.profiloNomeTesto.textContent;
    ui.profiloNomeInput.focus();
    ui.profiloEditIcon.textContent = '✅';
}

function salvaModificaNome() {
    const nuovoNome = ui.profiloNomeInput.value;
    const nomeAttuale = ui.profiloNomeTesto.textContent;
    
    if (nuovoNome && nuovoNome !== nomeAttuale) {
        socket.emit('imposta-nome', nuovoNome);
    }
    
    ui.profiloNomeInput.style.display = 'none';
    ui.profiloNomeTesto.style.display = 'inline-block';
    ui.profiloEditIcon.textContent = '✏️';
}

// --- Funzione di Inizializzazione ---
export function initGame() {
    ui.btnInizia.addEventListener('click', () => {
        socket.emit('inizia-partita');
        ui.btnInizia.style.display = 'none'; 
    });

    ui.btnAttivaScelta.addEventListener('click', () => {
        ui.btnAttivaScelta.style.display = 'none';
        ui.zonaMaster.textContent = "Choose the winning card!";
        const carteRivelate = ui.zonaCarteGiocate.querySelectorAll('.carta-bianca');
        carteRivelate.forEach(cartaDiv => {
            cartaDiv.className = 'carta-scelta';
            cartaDiv.onclick = () => {
                const testoScelto = cartaDiv.dataset.testo;
                socket.emit('scegli-vincitore', testoScelto); 
                ui.zonaCarteGiocate.innerHTML = `<p style="font-size: 1.5em; color: green;">You chose! Announcing winner...</p>`;
            };
        });
    });

    ui.profiloEditIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        if (ui.profiloEditIcon.textContent === '✏️') {
            attivaModificaNome();
        } else {
            salvaModificaNome();
        }
    });

    ui.profiloNomeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            salvaModificaNome();
        }
    });
}

// --- Gestori di Eventi Socket.IO ---

export function handleErrore(messaggio) {
    ui.areaMessaggi.innerHTML = `<p style="color: red;">${messaggio}</p>`;
}

export function handleAggiornaListaGiocatori(data) {
    const { giocatori, hostID, partitaInCorso, maxGiocatori, numGiocatori } = data; 
    
    ui.sidebarLobbyConteggio.textContent = `${numGiocatori} / ${maxGiocatori}`;

    stato.listaGiocatoriLocale = giocatori; 
    ui.listaGiocatoriContainer.innerHTML = ''; 
    
    giocatori.forEach(g => {
        const giocatoreDiv = document.createElement('div');
        giocatoreDiv.className = 'giocatore-sidebar-item'; 
        const nomeDiv = document.createElement('div');
        nomeDiv.className = 'giocatore-nome';
        let nomeTesto = g.nome;
        if (g.id === hostID) {
            nomeTesto = `👑 ${nomeTesto}`;
        }
        nomeDiv.textContent = nomeTesto;
        giocatoreDiv.appendChild(nomeDiv);
        
        const puntiDiv = document.createElement('div');
        puntiDiv.className = 'giocatore-punti';
        puntiDiv.textContent = `Points: ${g.punti}`;
        giocatoreDiv.appendChild(puntiDiv);
        
        if (g.id === socket.id) {
            giocatoreDiv.classList.add('tu');
        }
        if (g.inAttesa) {
            giocatoreDiv.classList.add('in-attesa');
        } else if (g.id === stato.masterCorrenteID) {
            giocatoreDiv.classList.add('master-turno');
        } else if (g.haGiocato) {
            giocatoreDiv.classList.add('ha-giocato');
        }
        ui.listaGiocatoriContainer.appendChild(giocatoreDiv);
    });
    
    const mioDato = giocatori.find(g => g.id === socket.id);

    if (!partitaInCorso) {
        ui.zonaLobby.style.display = 'block';
        
        if (mioDato) {
            ui.zonaProfiloGiocatore.style.display = 'block';
            ui.profiloEditIcon.style.display = 'inline-block';
            
            if (ui.profiloNomeInput.style.display === 'none') {
                ui.profiloNomeTesto.textContent = mioDato.nome;
            }
        }
        
        ui.lobbyConteggio.textContent = `Players in lobby: ${giocatori.length}`;
        if (socket.id === hostID) {
            ui.btnInizia.style.display = 'block';
            ui.lobbyAttesaHost.textContent = "You are the Host! You can start the game when ready.";
        } else {
            ui.btnInizia.style.display = 'none';
            const nomeHost = ui.getNomeGiocatore(hostID, stato.listaGiocatoriLocale);
            ui.lobbyAttesaHost.textContent = `Waiting for ${nomeHost} to start the game.`;
        }
    } else {
        ui.zonaLobby.style.display = 'none';
        ui.zonaProfiloGiocatore.style.display = 'none'; 
        ui.btnInizia.style.display = 'none';
        
        if (mioDato && mioDato.inAttesa) {
            ui.zonaLobby.style.display = 'block'; 
            ui.lobbyConteggio.textContent = `Game in progress...`;
            ui.lobbyAttesaHost.textContent = "Waiting for the next round to join the game.";
        }
    }
}

export function handleNuovoTurno(dati) {
    if (stato.countdownInterval) clearInterval(stato.countdownInterval);
    
    stato.masterCorrenteID = dati.masterID;
    
    ui.zonaLobby.style.display = 'none'; 
    ui.zonaProfiloGiocatore.style.display = 'none'; 
    ui.btnInizia.style.display = 'none';
    ui.areaMessaggi.innerHTML = '';
    ui.zonaManoGiocatore.innerHTML = ''; 
    ui.zonaCarteGiocate.innerHTML = '';
    ui.zonaCarteGiocate.style.display = 'none';
    ui.btnAttivaScelta.style.display = 'none'; 
    
    ui.zonaCartaNera.style.display = 'block';
    ui.testoCartaNera.textContent = dati.cartaNera;
    
    if (dati.masterID === socket.id) {
        ui.infoMaster.textContent = "You are the Master!";
    } else {
        ui.infoMaster.textContent = `This round's Master is: ${ui.getNomeGiocatore(dati.masterID, stato.listaGiocatoriLocale)}`;
    }
}

export function handleAggiornaStatoRuolo(dati) { 
    stato.mioRuolo.isMaster = dati.isMaster;
    if (stato.mioRuolo.isMaster) {
        ui.zonaMaster.textContent = "Waiting for players to choose...";
        ui.zonaMaster.style.display = 'block';
        ui.zonaManoGiocatore.style.display = 'none'; 
    } else {
        ui.zonaMaster.textContent = "Choose your best card.";
        ui.zonaMaster.style.display = 'block';
        ui.zonaManoGiocatore.style.display = 'flex'; 
    }
}

export function handleAggiornaMano(mano) { 
    ui.zonaManoGiocatore.innerHTML = ''; 
    if (mano.length === 0) {
        ui.zonaManoGiocatore.style.display = 'none';
        return;
    }
    ui.zonaManoGiocatore.style.display = 'flex';
    mano.forEach(testoCarta => {
        const cartaDiv = document.createElement('div');
        cartaDiv.className = 'carta-bianca carta-giocabile'; 
        cartaDiv.textContent = testoCarta;
        cartaDiv.addEventListener('click', () => {
            if (!stato.mioRuolo.isMaster && ui.zonaManoGiocatore.style.display !== 'none') {
                socket.emit('gioca-carta', testoCarta);
                ui.zonaManoGiocatore.innerHTML = '<p style="font-size: 1.2em; color: #555;">You played! Waiting for others...</p>';
                ui.zonaManoGiocatore.style.display = 'block';
            }
        });
        ui.zonaManoGiocatore.appendChild(cartaDiv);
    });
}

export function handleIniziaFaseRivelazione(data) {
    ui.zonaManoGiocatore.innerHTML = '';
    ui.zonaManoGiocatore.style.display = 'none';
    ui.zonaCarteGiocate.innerHTML = '';
    ui.zonaCarteGiocate.style.display = 'flex';
    
    for (let i = 0; i < data.numCarte; i++) {
        const cartaDiv = document.createElement('div');
        cartaDiv.className = 'carta-coperta';
        cartaDiv.dataset.index = i;
        ui.zonaCarteGiocate.appendChild(cartaDiv);
    }
    
    if (!stato.mioRuolo.isMaster) {
        ui.zonaMaster.textContent = "All players have played! The Master is revealing the cards...";
        ui.zonaMaster.style.display = 'block';
    }
}

export function handleSeiProntoARivelare() {
    ui.zonaMaster.textContent = "Reveal the cards by clicking them!";
    ui.zonaMaster.style.display = 'block';
    
    const carteCoperte = ui.zonaCarteGiocate.querySelectorAll('.carta-coperta');
    carteCoperte.forEach(cartaDiv => {
        cartaDiv.classList.add('cliccabile');
        cartaDiv.onclick = () => {
            socket.emit('rivolgi-carta', { index: cartaDiv.dataset.index });
            cartaDiv.onclick = null;
            cartaDiv.classList.remove('cliccabile');
        };
    });
}

export function handleCartaRivelata(data) {
    playSfx(ui.sfxCartaGirata); 
    
    const cartaDaRivelare = ui.zonaCarteGiocate.querySelector(`.carta-coperta[data-index="${data.index}"]`);
    
    if (cartaDaRivelare) {
        const cartaNuova = document.createElement('div');
        cartaNuova.className = 'carta-bianca';
        cartaNuova.dataset.index = data.index;
        cartaNuova.dataset.testo = data.testoCarta;
        cartaNuova.textContent = data.testoCarta;
        
        cartaDaRivelare.replaceWith(cartaNuova);
    }
}

export function handleAttendiSceltaFinale() {
    ui.zonaMaster.textContent = "All cards revealed. Waiting for the Master's choice.";
    ui.zonaMaster.style.display = 'block';
}

export function handleMostraPulsanteScegli() {
    ui.zonaMaster.textContent = "All cards are revealed! Press the button to decide.";
    ui.zonaMaster.style.display = 'block';
    ui.btnAttivaScelta.style.display = 'block';
}

export function handleAnnunciaVincitore(dati) {
    stato.masterCorrenteID = dati.vincitoreID;
    
    ui.zonaManoGiocatore.innerHTML = '';
    ui.zonaManoGiocatore.style.display = 'none';
    ui.zonaCarteGiocate.innerHTML = '';
    ui.btnAttivaScelta.style.display = 'none';
    ui.zonaCarteGiocate.style.display = 'flex'; 
    
    ui.zonaCartaNera.style.display = 'block';
    ui.testoCartaNera.textContent = dati.cartaNera;
    
    const cartaVincitriceDiv = document.createElement('div');
    cartaVincitriceDiv.className = 'carta-bianca carta-vincitrice'; 
    cartaVincitriceDiv.textContent = dati.cartaVincitrice;
    ui.zonaCarteGiocate.appendChild(cartaVincitriceDiv);
    
    let messaggio = '';
    const nomeVincitore = ui.getNomeGiocatore(dati.vincitoreID, stato.listaGiocatoriLocale); 
    if (dati.vincitoreID === socket.id) {
        messaggio = "You won this round! You are the new Master.";
        ui.zonaMaster.style.borderColor = "var(--colore-master)";
        ui.zonaMaster.style.color = "var(--colore-giocatore-ha-giocato)";
        playSfx(ui.sfxVincitore);
    } else {
        messaggio = `Player ${nomeVincitore} won! They are the next Master.`; 
        ui.zonaMaster.style.borderColor = "var(--colore-master)";
        ui.zonaMaster.style.color = "var(--colore-testo-scuro)";
    }
    ui.zonaMaster.textContent = messaggio;
    ui.zonaMaster.style.display = 'block';
    
    let timer = dati.countdown || 10;

    if (stato.countdownInterval) clearInterval(stato.countdownInterval);

    ui.infoMaster.textContent = `Next round starts in ${timer}...`; 

    stato.countdownInterval = setInterval(() => {
        timer--;
        if (timer > 0) {
            ui.infoMaster.textContent = `Next round starts in ${timer}...`;
        } else {
            ui.infoMaster.textContent = "Starting next round..."; 
            clearInterval(stato.countdownInterval);
        }
    }, 1000);
}
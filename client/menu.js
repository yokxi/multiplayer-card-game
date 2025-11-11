import { socket } from './socket.js';
import * as ui from './ui.js'; 

export function initMenu() {
    ui.btnMostraCreaLobby.addEventListener('click', () => {
        ui.boxCreaLobby.style.display = 'block';
        ui.btnMostraCreaLobby.style.display = 'none';
    });

    ui.btnCreaLobby.addEventListener('click', () => {
        const nomeStanza = ui.inputNomeStanza.value || "Unnamed Room";
        const maxGiocatori = parseInt(ui.inputMaxGiocatori.value, 10);
        
        socket.emit('crea-lobby', { 
            nome: nomeStanza, 
            maxGiocatori: maxGiocatori 
        });
    });

    ui.btnUniscitiCodice.addEventListener('click', () => {
        const codice = ui.inputCodiceLobby.value.trim().toUpperCase();
        if (codice.length === 5) {
            socket.emit('unisciti-con-codice', codice);
        } else {
            alert("Code must be 5 characters long.");
        }
    });

    ui.copiaCodiceIcon.addEventListener('click', () => {
        const codice = ui.codiceLobbyDisplay.textContent;
        navigator.clipboard.writeText(codice).then(() => {
            alert(`Code "${codice}" copied!`);
        }, () => {
            alert('Failed to copy code.');
        });
    });
}

export function handleAggiornaLobbyPubbliche(listaLobby) {
    ui.listaLobbyContainer.innerHTML = ''; 
    
    if (listaLobby.length === 0) {
        ui.listaLobbyContainer.innerHTML = '<p><i>(No lobbies available...)</i></p>';
        return;
    }

    listaLobby.forEach(lobby => {
        const lobbyDiv = document.createElement('div');
        lobbyDiv.className = 'lobby-item';

        const lobbyInfo = document.createElement('div');
        lobbyInfo.className = 'lobby-item-info';
        lobbyInfo.innerHTML = `<strong>${lobby.nome}</strong> (${lobby.numGiocatori} / ${lobby.maxGiocatori})`;
        lobbyInfo.title = `${lobby.nome} (${lobby.numGiocatori} / ${lobby.maxGiocatori})`;
        
        const lobbyBtn = document.createElement('button');
        lobbyBtn.className = 'lobby-item-join-btn';
        lobbyBtn.textContent = 'Join';
        lobbyBtn.onclick = () => {
            socket.emit('unisciti-con-codice', lobby.codice);
        };
        
        lobbyDiv.appendChild(lobbyInfo);
        lobbyDiv.appendChild(lobbyBtn);
        ui.listaLobbyContainer.appendChild(lobbyDiv);
    });
}

export function handleUnitoAllaLobby(datiLobby) {
    ui.schermataMenuPrincipale.style.display = 'none';
    ui.schermataGioco.style.display = 'flex'; 

    ui.infoCodiceLobby.style.display = 'block';
    ui.codiceLobbyDisplay.textContent = datiLobby.codice;
}

export function handleErroreLobby(messaggio) {
    alert(messaggio); 
}

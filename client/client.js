import { socket } from './socket.js';
import { statoConnessioneEl } from './ui.js';

import { initAudio } from './audio.js';
import { initChat, handleNuovoMessaggioChat } from './chat.js';
import { initMenu, handleAggiornaLobbyPubbliche, handleUnitoAllaLobby, handleErroreLobby } from './menu.js';
import { 
    initGame, handleErrore, handleAggiornaListaGiocatori, handleNuovoTurno,
    handleAggiornaStatoRuolo, handleAggiornaMano, handleIniziaFaseRivelazione,
    handleSeiProntoARivelare, handleCartaRivelata, handleAttendiSceltaFinale,
    handleMostraPulsanteScegli, handleAnnunciaVincitore
} from './game.js';

initAudio();
initChat();
initMenu();
initGame();

socket.on('connect', () => {
    statoConnessioneEl.style.display = 'none';
});

socket.on('disconnect', () => {
    statoConnessioneEl.style.display = 'block';
    statoConnessioneEl.style.color = 'red';
});

socket.on('aggiorna-lobby-pubbliche', handleAggiornaLobbyPubbliche);
socket.on('unito-alla-lobby', handleUnitoAllaLobby);
socket.on('errore-lobby', handleErroreLobby);

socket.on('nuovo-messaggio-chat', handleNuovoMessaggioChat);

socket.on('errore', handleErrore);
socket.on('aggiorna-lista-giocatori', handleAggiornaListaGiocatori);
socket.on('nuovo-turno', handleNuovoTurno);
socket.on('aggiorna-stato-ruolo', handleAggiornaStatoRuolo);
socket.on('aggiorna-mano', handleAggiornaMano);
socket.on('inizia-fase-rivelazione', handleIniziaFaseRivelazione);
socket.on('sei-pronto-a-rivelare', handleSeiProntoARivelare);
socket.on('carta-rivelata', handleCartaRivelata);
socket.on('attendi-scelta-finale', handleAttendiSceltaFinale);
socket.on('mostra-pulsante-scegli', handleMostraPulsanteScegli);
socket.on('annuncia-vincitore', handleAnnunciaVincitore);
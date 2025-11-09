// --- Elementi Comuni ---
export const statoConnessioneEl = document.getElementById('stato-connessione');
export const areaMessaggi = document.getElementById('area-messaggi');

// --- Elementi Menu Principale ---
export const schermataMenuPrincipale = document.getElementById('schermata-menu-principale');
export const listaLobbyContainer = document.getElementById('lista-lobby-container'); 
export const inputCodiceLobby = document.getElementById('input-codice-lobby');
export const btnUniscitiCodice = document.getElementById('btn-unisciti-codice');
export const inputNomeStanza = document.getElementById('input-nome-stanza');
export const inputMaxGiocatori = document.getElementById('input-max-giocatori');
export const btnCreaLobby = document.getElementById('btn-crea-lobby');
export const btnMostraCreaLobby = document.getElementById('btn-mostra-crea-lobby');
export const boxCreaLobby = document.getElementById('box-crea-lobby');

// --- Elementi Schermata Gioco ---
export const schermataGioco = document.getElementById('schermata-gioco');
export const btnInizia = document.getElementById('btn-inizia');
export const zonaMaster = document.getElementById('zona-master');
export const zonaCartaNera = document.getElementById('zona-carta-nera');
export const testoCartaNera = document.getElementById('testo-carta-nera');
export const infoMaster = document.getElementById('info-master');
export const zonaManoGiocatore = document.getElementById('zona-mano-giocatore');
export const zonaCarteGiocate = document.getElementById('zona-carte-giocate'); 
export const listaGiocatoriContainer = document.getElementById('lista-giocatori-container');
export const sidebarLobbyConteggio = document.getElementById('sidebar-lobby-conteggio'); 
export const zonaLobby = document.getElementById('zona-lobby');
export const lobbyConteggio = document.getElementById('lobby-conteggio');
export const lobbyAttesaHost = document.getElementById('lobby-attesa-host');
export const btnAttivaScelta = document.getElementById('btn-attiva-scelta');
export const infoCodiceLobby = document.getElementById('info-codice-lobby');
export const codiceLobbyDisplay = document.getElementById('codice-lobby-display');
export const copiaCodiceIcon = document.getElementById('copia-codice-icon');

// --- Elementi Profilo ---
export const zonaProfiloGiocatore = document.getElementById('zona-profilo-giocatore');
export const profiloNomeTesto = document.getElementById('profilo-nome-testo');
export const profiloEditIcon = document.getElementById('profilo-edit-icon');
export const profiloNomeInput = document.getElementById('profilo-nome-input');

// --- Elementi Chat ---
export const chatContainer = document.getElementById('chat-container');
export const chatForm = document.getElementById('chat-form');
export const chatInput = document.getElementById('chat-input');
export const chatMessaggiLista = document.getElementById('chat-messaggi-lista');

// --- Elementi Audio ---
export const musicaSfondo = document.getElementById('musica-sfondo');
export const iconaVolumeMusica = document.getElementById('icona-volume-musica');
export const sliderVolumeMusica = document.getElementById('slider-volume-musica');
export const iconaVolumeSfx = document.getElementById('icona-volume-sfx');
export const sliderVolumeSfx = document.getElementById('slider-volume-sfx');
export const sfxCartaGirata = document.getElementById('sfx-carta-girata');
export const sfxVincitore = document.getElementById('sfx-vincitore');

// --- Funzioni di Utilità UI ---
export function getNomeGiocatore(id, listaGiocatoriLocale) {
    const giocatore = listaGiocatoriLocale.find(g => g.id === id);
    return giocatore ? giocatore.nome : "Player...";
}
import { socket } from './socket.js';
import { chatForm, chatInput, chatMessaggiLista } from './ui.js';

export function initChat() {
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault(); 
        const messaggio = chatInput.value;
        
        if (messaggio.trim() !== '') {
            socket.emit('invia-messaggio-chat', messaggio);
            chatInput.value = '';
        }
    });
}

export function handleNuovoMessaggioChat(data) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'messaggio-chat';
    
    if (data.isSystem) {
        msgDiv.classList.add('sistema');
        msgDiv.textContent = data.messaggio;
    } else {
        const nomeSpan = document.createElement('span');
        nomeSpan.className = 'nome';
        nomeSpan.textContent = `${data.nome}: `;
        
        if (data.id === socket.id) {
            msgDiv.classList.add('tu');
        }
        
        const testoSpan = document.createElement('span');
        testoSpan.className = 'testo';
        testoSpan.textContent = data.messaggio;
        
        msgDiv.appendChild(nomeSpan);
        msgDiv.appendChild(testoSpan);
    }
    
    chatMessaggiLista.appendChild(msgDiv);
    chatMessaggiLista.scrollTop = chatMessaggiLista.scrollHeight; 
}
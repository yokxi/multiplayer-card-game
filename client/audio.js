import {
    musicaSfondo, iconaVolumeMusica, sliderVolumeMusica,
    iconaVolumeSfx, sliderVolumeSfx, sfxCartaGirata, sfxVincitore
} from './ui.js';

let sfxVolume = sliderVolumeSfx.value / 100;
let sfxMuted = false;

export function playSfx(audioElement) {
    if (sfxMuted || sfxVolume === 0) return;
    audioElement.volume = sfxVolume;
    audioElement.currentTime = 0;
    audioElement.play().catch(e => console.warn("SFX play failed", e));
}

function avviaMusicaAlPrimoClick() {
    musicaSfondo.play().catch(e => {
        console.warn("Autoplay was blocked.", e);
    });
    document.body.removeEventListener('click', avviaMusicaAlPrimoClick);
}

function aggiornaIconaMusica() {
    if (musicaSfondo.muted || musicaSfondo.volume === 0) {
        iconaVolumeMusica.textContent = '🔇';
        if (musicaSfondo.volume === 0) sliderVolumeMusica.value = 0;
    } else {
        iconaVolumeMusica.textContent = '🎵';
        sliderVolumeMusica.value = musicaSfondo.volume * 100;
    }
}

function aggiornaIconaSfx() {
    if (sfxMuted || sfxVolume === 0) {
        iconaVolumeSfx.textContent = '🔇';
        if (sfxVolume === 0) sliderVolumeSfx.value = 0;
    } else if (sfxVolume < 0.5) {
        iconaVolumeSfx.textContent = '🔉';
        sliderVolumeSfx.value = sfxVolume * 100;
    } else {
        iconaVolumeSfx.textContent = '🔊';
        sliderVolumeSfx.value = sfxVolume * 100;
    }
}

export function initAudio() {
    musicaSfondo.volume = sliderVolumeMusica.value / 100;
    document.body.addEventListener('click', avviaMusicaAlPrimoClick, { once: true });

    sliderVolumeMusica.addEventListener('input', () => {
        const volumeVal = sliderVolumeMusica.value / 100;
        musicaSfondo.volume = volumeVal;
        if (volumeVal > 0) {
            musicaSfondo.muted = false;
        }
        aggiornaIconaMusica();
    });

    iconaVolumeMusica.addEventListener('click', () => {
        musicaSfondo.muted = !musicaSfondo.muted;
        aggiornaIconaMusica();
    });

    sliderVolumeSfx.addEventListener('input', () => {
        sfxVolume = sliderVolumeSfx.value / 100;
        if (sfxVolume > 0) {
            sfxMuted = false;
        }
        aggiornaIconaSfx();
    });

    iconaVolumeSfx.addEventListener('click', () => {
        sfxMuted = !sfxMuted;
        aggiornaIconaSfx();
    });
}
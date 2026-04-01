// ==UserScript== s
// @name         Phantoms over g alarm and blackout mod
// @namespace    http://tampermonkey.net/
// @version      1.6.1
// @description  geofs over g and blackout
// @match        *://*.geo-fs.com/*
// @match        *://geo-fs.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function() {
    'use strict';


    const AUDIO_G_LIMIT = 9.0;
    const VIGNETTE_START = 7.0;
    const GLOC_LIMIT = 17.0;
    const GLOC_DURATION = 6000;  
    const BASE_RECOVERY = 0.020; 

    const fighterPlanes = ["F-16", "F-15", "Su-35", "F-18", "F-14", "F-22", "Mig-21", "F-4", "Gripen", "Mirage", "F-5", "MiG-29", "A-10", "F-35", "Eurofighter", "Rafale", "J-20", "Su-57", "Phantom"];

    const soundUrls = {
        overG: "https://raw.githubusercontent.com/nvzeleks/over-g-alarm/main/222-%5BAudioTrimmer.com%5D.mp3",
        overspeed: "https://github.com/avramovic/geofs-alerts/raw/master/audio/md-80-overspeed.mp3"
    };

    let audioCtx, gainNode, overGSource;
    const audioObjects = {};
    let vignetteUI;
    let currentVignetteOpacity = 0;
    let glocEndTime = 0;
    let isGlocActive = false;

    async function initSystem() {
        if (audioCtx) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioCtx.createGain();
        gainNode.gain.value = 10.0;
        gainNode.connect(audioCtx.destination);

        const resp = await fetch(soundUrls.overG);
        const buf = await resp.arrayBuffer();
        window.overGBuffer = await audioCtx.decodeAudioData(buf);

        Object.keys(soundUrls).forEach(key => {
            if (key !== 'overG') {
                audioObjects[key] = new Audio(soundUrls[key]);
                audioObjects[key].volume = 1.0;
            }
        });

        vignetteUI = document.createElement('div');
        vignetteUI.style = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            pointer-events: none; z-index: 999999; opacity: 0;
            background: black;
        `;
        document.body.appendChild(vignetteUI);
        console.log("Fast Recovery Systems Online.");
    }

    function playOverG() {
        if (!window.overGBuffer || window.overGActive) return;
        window.overGActive = true;
        overGSource = audioCtx.createBufferSource();
        overGSource.buffer = window.overGBuffer;
        overGSource.loop = true;
        overGSource.connect(gainNode);
        overGSource.start(0);
    }

    function stopOverG() {
        if (overGSource) {
            try { overGSource.stop(); } catch(e) {}
            overGSource = null;
            window.overGActive = false;
        }
    }

    window.addEventListener('mousedown', () => {
        initSystem();
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    }, { once: true });

    function mainLoop() {
        if (typeof geofs === 'undefined' || !geofs.animation) return;

        const anim = geofs.animation.values;
        const gForce = Math.abs(anim.loadFactor || 0);
        const isFighter = fighterPlanes.some(p => geofs.aircraft.instance.aircraftRecord.name.includes(p));
        const now = Date.now();

        if (vignetteUI && isFighter) {
       
            if (gForce >= GLOC_LIMIT && !isGlocActive) {
                isGlocActive = true;
                glocEndTime = now + GLOC_DURATION;
            }

           
            if (now < glocEndTime) {
                currentVignetteOpacity = 1.0;
                vignetteUI.style.background = "black";
            } else {
                isGlocActive = false;

              
                let targetOpacity = (gForce - VIGNETTE_START) / (GLOC_LIMIT - VIGNETTE_START);
                targetOpacity = Math.max(0, Math.min(1, targetOpacity));

              if (currentVignetteOpacity > targetOpacity) {
                    currentVignetteOpacity -= BASE_RECOVERY;
                } else {
                    currentVignetteOpacity = targetOpacity;
                }

                vignetteUI.style.background = `radial-gradient(circle, transparent 15%, rgba(0,0,0,0.9) 65%, black 100%)`;
            }

          
            if (currentVignetteOpacity < 0.01) currentVignetteOpacity = 0;

            vignetteUI.style.opacity = currentVignetteOpacity;
            vignetteUI.style.backdropFilter = `blur(${currentVignetteOpacity * 15}px)`;
        }


        if (isFighter && gForce >= AUDIO_G_LIMIT) {
            playOverG();
        } else {
            stopOverG();
        }

       
        if (anim.kias > (anim.VNO || 350)) {
            if (audioObjects.overspeed.paused) audioObjects.overspeed.play();
        } else { audioObjects.overspeed.pause(); }
    }

    setInterval(mainLoop, 50);
})();

// ==========================================
// VARIABLES GLOBALES DEL JUEGO
// ==========================================
let listadoAlumnos = [];
let listadoEjercicios = [];
let seleccionesMundial = [];

let alumnosDisponibles = [];
let seleccionesDisponibles = [];

// 1. Pizarra en blanco (esto evita errores antes de que carguen los JSON)
let currentMatch = {
    alumnoA: "", alumnoB: "", teamA: null, teamB: null,
    scoreA: 0, scoreB: 0, penalesA: [], penalesB: [], 
    round: 0, subTurno: 'A', ejercicioActual: null, precisionPoints: 0,
    estado: 'NORMAL'
};

// ==========================================
// SISTEMA DE SONIDOS SINTETIZADOS (ESTILO ARCADE 8-BITS)
// ==========================================
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

// Función matemática para generar los tonos
function playTone(freq, type, duration, vol=0.1) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    let osc = audioCtx.createOscillator();
    let gain = audioCtx.createGain();
    osc.type = type; // 'sine', 'square', 'sawtooth', 'triangle'
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    // Envolvente de volumen (empieza fuerte y se apaga suave)
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

// Clase para engañar al resto de tu código y que funcione sin cambiar nada más
class SynthSound {
    constructor(playAction) { this.playAction = playAction; }
    play() { this.playAction(); }
    cloneNode() { return this; }
    set volume(v) { /* Propiedad ignorada, evita errores de código */ }
}

// 1. Tipeo / Clic (Onda senoidal suave)
const sfxClick = new SynthSound(() => playTone(600, 'sine', 0.1, 0.05));

// 2. Bolillero / Ruleta (Onda triangular rápida)
const sfxRuleta = new SynthSound(() => playTone(800, 'triangle', 0.05, 0.02));

// 3. Alarma de VAR (Onda de sierra grave, suena dos veces como chicharra)
const sfxVar = new SynthSound(() => {
    playTone(150, 'sawtooth', 0.4, 0.2);
    setTimeout(() => playTone(150, 'sawtooth', 0.4, 0.2), 500);
});

// 4. Robar Turno / Power Up (Escala ascendente rápida)
const sfxRobo = new SynthSound(() => {
    playTone(440, 'square', 0.1, 0.05);
    setTimeout(() => playTone(554, 'square', 0.1, 0.05), 100);
    setTimeout(() => playTone(659, 'square', 0.3, 0.05), 200);
});

// 5. Seguir Partido (Tono de cancelación suave)
const sfxSeguir = new SynthSound(() => playTone(300, 'sine', 0.2, 0.05));

// 6. Ganador / Victoria (Fanfarria musical épica de 8-bits)
const sfxGanador = new SynthSound(() => {
    const notas = [523.25, 659.25, 783.99]; // Acorde Do Mayor
    notas.forEach((freq, i) => {
        setTimeout(() => playTone(freq, 'square', 0.15, 0.08), i * 150);
    });
    setTimeout(() => playTone(1046.50, 'square', 0.6, 0.08), 450);
});




// ==========================================
// DICCIONARIO DE BANDERAS (48 EQUIPOS - FLAGCDN)
// ==========================================
const banderasCodigos = {
    // CONMEBOL (Sudamérica)
    "Argentina": "ar",
    "Brasil": "br",
    "Uruguay": "uy",
    "Colombia": "co",
    "Ecuador": "ec",
    "Venezuela": "ve",
    "Perú": "pe",
    "Chile": "cl",

    // UEFA (Europa)
    "Francia": "fr",
    "Alemania": "de",
    "España": "es",
    "Inglaterra": "gb-eng",
    "Portugal": "pt",
    "Países Bajos": "nl",
    "Italia": "it",
    "Bélgica": "be",
    "Croacia": "hr",
    "Suiza": "ch",
    "Dinamarca": "dk",
    "Serbia": "rs",
    "Polonia": "pl",
    "Ucrania": "ua",
    "Suecia": "se",
    "Austria": "at",

    // CONCACAF (Norte, Centroamérica y Caribe)
    "Estados Unidos": "us",
    "México": "mx",
    "Canadá": "ca",
    "Costa Rica": "cr",
    "Panamá": "pa",
    "Jamaica": "jm",

    // CAF (África)
    "Marruecos": "ma",
    "Senegal": "sn",
    "Egipto": "eg",
    "Argelia": "dz",
    "Nigeria": "ng",
    "Costa de Marfil": "ci",
    "Camerún": "cm",
    "Ghana": "gh",
    "Malí": "ml",

    // AFC (Asia)
    "Japón": "jp",
    "Corea del Sur": "kr",
    "Irán": "ir",
    "Australia": "au",
    "Arabia Saudita": "sa",
    "Qatar": "qa",
    "Irak": "iq",
    "Emiratos Árabes Unidos": "ae",

    // OFC (Oceanía)
    "Nueva Zelanda": "nz"
};


// ==========================================
// CARGA DE DATOS CON PROMESAS (FETCH API)
// ==========================================
async function cargarDatosJSON() {
    try {
        // Lanzamos las tres peticiones en paralelo
        const [resAlumnos, resEjercicios, resSelecciones] = await Promise.all([
            fetch('alumnos.json'),
            fetch('ejercicios.json'),
            fetch('selecciones.json')
        ]);

        if (!resAlumnos.ok || !resEjercicios.ok || !resSelecciones.ok) {
            throw new Error("No se pudo cargar uno o más archivos JSON.");
        }

        // Asignamos los datos a nuestras variables globales
        listadoAlumnos = await resAlumnos.json();
        listadoEjercicios = await resEjercicios.json();
        seleccionesMundial = await resSelecciones.json();

        return true;
    } catch (error) {
        console.error("Error al cargar los datos:", error);
        alert("Error al cargar los archivos JSON. Asegurate de estar usando un servidor local (como Live Server).");
        return false;
    }
}

// ==========================================
// LÓGICA PRINCIPAL
// ==========================================
async function initGame() {
    // Esperamos a que los datos se carguen antes de hacer cualquier otra cosa
    let cargaExitosa = await cargarDatosJSON();
    
    // Si la carga falló (por ejemplo, por no usar servidor local), no empezamos el juego
    if (!cargaExitosa) return;

    // Si todo salió bien, mezclamos los datos y preparamos el partido
    alumnosDisponibles = [...listadoAlumnos].sort(() => Math.random() - 0.5);
    seleccionesDisponibles = [...seleccionesMundial].sort(() => Math.random() - 0.5);
    
    nextMatchSetup();
}

function nextPenaltyTurn() {
    document.getElementById('main-answer-input').value = "";
    document.getElementById('var-block').style.display = "none";

    let jugadorIndex = currentMatch.round % 5;
    let kickerName = currentMatch.subTurno === 'A' ? currentMatch.teamA.jugadores[jugadorIndex] : currentMatch.teamB.jugadores[jugadorIndex];
    let currentTeamName = currentMatch.subTurno === 'A' ? `${currentMatch.teamA.pais} (${currentMatch.alumnoA})` : `${currentMatch.teamB.pais} (${currentMatch.alumnoB})`;

    document.getElementById('kicker-title').innerText = `Patea: ${kickerName}`;
    document.getElementById('display-team-current').innerText = currentTeamName;

    let randomIdx = Math.floor(Math.random() * listadoEjercicios.length);
    currentMatch.ejercicioActual = listadoEjercicios[randomIdx];

    let mathBox = document.getElementById('math-box');
    mathBox.innerHTML = `$$${currentMatch.ejercicioActual.latex}$$`;
    MathJax.typesetPromise([mathBox]).then(() => {
        startTimer(600); // Arranca el tiempo apenas termina de dibujar la fórmula
    });
}

function pressKey(val) {
    // Clonamos el audio para que se pueda escuchar aunque toquen rápido
    let clickSonido = sfxClick.cloneNode();
    clickSonido.play();

    let input = document.getElementById('main-answer-input');
    if (val === 'clear') input.value = "";
    else if (val === 'backspace') input.value = input.value.slice(0, -1);
    else input.value += val;
}

function parseFraction(str) {
    if(!str) return NaN;
    let parts = str.split('/');
    if(parts.length === 2) return parseFloat(parts[0]) / parseFloat(parts[1]);
    return parseFloat(str);
}

function playAnimation(type, callback) {
    let overlay = document.getElementById('animation-overlay');
    let video = document.getElementById('anim-video');
    
    if(type === 'goal') {
        video.src = 'gol.mp4';
    } else if(type === 'post') {
        video.src = 'palo.mp4';
    } else {
        video.src = 'afuera.mp4';
    }
    
    overlay.classList.add('active'); 
    video.play(); 

    video.onended = () => {
        overlay.classList.remove('active');
        setTimeout(callback, 300); 
    };
}

// ==========================================
// SISTEMA DE TIEMPO (10 MINUTOS)
// ==========================================
let countdownInterval;

function startTimer(seconds) {
    clearInterval(countdownInterval);
    let timeLeft = seconds;
    
    // Función interna para actualizar el texto en formato MM:SS
    function updateDisplay(t) {
        let m = Math.floor(t / 60);
        let s = t % 60;
        document.getElementById('timer-val').innerText = `${m}:${s.toString().padStart(2, '0')}`;
    }

    updateDisplay(timeLeft);
    document.getElementById('timer-box').style.color = "var(--gold)";
    
    countdownInterval = setInterval(() => {
        timeLeft--;
        updateDisplay(timeLeft);
        
        // Cambia a rojo en los últimos 15 segundos para dar tensión
        if(timeLeft <= 15) document.getElementById('timer-box').style.color = "var(--neon-red)"; 
        
        if(timeLeft <= 0) {
            clearInterval(countdownInterval);
            handleTimeOut();
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(countdownInterval);
}

function handleTimeOut() {
    if (currentMatch.estado === 'ESPERANDO_PULSADOR') {
        startTieBreaker(); // Si nadie toca, saca otro ejercicio y reinicia el reloj
    } else if (currentMatch.estado === 'VAR') {
        continuarSinVar(); // Se le pasó el tiempo para robar
    } else {
        document.getElementById('main-answer-input').value = "⏰ TIEMPO"; // Tiro normal o respondiendo empate
        submitPenalty(true); // Forzamos el error
    }
}

function nextMatchSetup() {
    sfxClick.play(); // Sonido al hacer clic en "Siguiente"

    if (alumnosDisponibles.length < 2) {
        alert("¡Torneo finalizado o no quedan suficientes alumnos!");
        showScreen('screen-setup');
        return;
    }


    if(seleccionesDisponibles.length < 2) {
        seleccionesDisponibles = [...seleccionesMundial].sort(() => Math.random() - 0.5);
    }

    // 1. Extraemos los valores REALES en secreto (esto asegura que no se repitan)
    currentMatch = {
        alumnoA: alumnosDisponibles.pop(),
        alumnoB: alumnosDisponibles.pop(),
        teamA: seleccionesDisponibles.pop(),
        teamB: seleccionesDisponibles.pop(),
        scoreA: 0, scoreB: 0,
        subTurno: 'A',
        ejercicioActual: null, 
        precisionPoints: 0,
        estado: 'NORMAL',
        round: 0 // 
    };

    // 2. Mostramos la pantalla
    showScreen('screen-versus');

    // Ocultamos el botón "Ir a los penales" para que no puedan saltarse la animación
    let btnPenales = document.querySelector('#screen-versus .btn');
    btnPenales.style.display = "none";

    // 3. EFECTO BOLILLERO
    let ticks = 0;
    let maxTicks = 20; // Son 2 segundos de animación (20 intervalos de 100ms)
    
    let drawInterval = setInterval(() => {
        // Hacemos sonar el tic de la ruleta en cada vuelta
        let tic = sfxRuleta.cloneNode();
        tic.volume = 0.4; // Volumen un poco más bajo para que no sature
        tic.play();
        // Elegimos datos aleatorios de la lista general solo para el efecto de parpadeo
        let randomTeamA = seleccionesMundial[Math.floor(Math.random() * seleccionesMundial.length)].pais;
        let randomTeamB = seleccionesMundial[Math.floor(Math.random() * seleccionesMundial.length)].pais;
        let randomStudentA = listadoAlumnos[Math.floor(Math.random() * listadoAlumnos.length)];
        let randomStudentB = listadoAlumnos[Math.floor(Math.random() * listadoAlumnos.length)];

        // Mostramos los nombres girando con un emoji de sorteo
        document.getElementById('vs-team-a-name').innerHTML = `🔄 ${randomTeamA}`;
        document.getElementById('vs-student-a').innerText = randomStudentA;
        document.getElementById('vs-team-b-name').innerHTML = `🔄 ${randomTeamB}`;
        document.getElementById('vs-student-b').innerText = randomStudentB;

        ticks++;
        
        // 4. Fin del sorteo: Frenamos y mostramos los competidores reales con sus banderas
        if (ticks >= maxTicks) {
            clearInterval(drawInterval);
            
            let imgBanderaA = banderasCodigos[currentMatch.teamA.pais] ? `<img src="https://flagcdn.com/w40/${banderasCodigos[currentMatch.teamA.pais]}.png" width="30" style="vertical-align: middle; margin-right: 8px; border-radius: 3px;">` : '';
            let imgBanderaB = banderasCodigos[currentMatch.teamB.pais] ? `<img src="https://flagcdn.com/w40/${banderasCodigos[currentMatch.teamB.pais]}.png" width="30" style="vertical-align: middle; margin-right: 8px; border-radius: 3px;">` : '';

            document.getElementById('vs-team-a-name').innerHTML = `${imgBanderaA} ${currentMatch.teamA.pais}`;
            document.getElementById('vs-student-a').innerText = currentMatch.alumnoA;
            
            document.getElementById('vs-team-b-name').innerHTML = `${imgBanderaB} ${currentMatch.teamB.pais}`;
            document.getElementById('vs-student-b').innerText = currentMatch.alumnoB;

            // Volvemos a mostrar el botón para avanzar al duelo
            btnPenales.style.display = "block";
        }
    }, 100);
}

function startMatchGameplay() {
    sfxClick.play();
    showScreen('screen-arena');
    document.getElementById('pulsador-block').style.display = "none";
    updateScoreboardUI();
    nextPenaltyTurn();
}

function updateScoreboardUI() {
    document.getElementById('score-text').innerText = `${currentMatch.scoreA} - ${currentMatch.scoreB}`;
    document.getElementById('precision-points-val').innerText = currentMatch.precisionPoints;
    document.getElementById('penalty-dots-current').innerHTML = ""; // Ocultamos los puntos de la vieja tanda
}

function continuarSinVar() {
    sfxSeguir.play(); // Sonido al rechazar el robo
    document.getElementById('var-block').style.display = "none";
    evaluarMarcador();
}

function triggerVarRobo() {
    sfxRobo.play(); // Sonido de confirmación heroica
    currentMatch.estado = 'VAR';
    document.getElementById('var-block').style.display = "none";
    document.getElementById('main-answer-input').value = "";

    let opponentName = currentMatch.subTurno === 'A' ? currentMatch.alumnoB : currentMatch.alumnoA;
    document.getElementById('kicker-title').innerText = `VAR: Responde ${opponentName}`;
    document.getElementById('display-team-current').innerText = "¡INTENTO DE ROBO!";
}

function submitPenalty(isTimeout = false) {
    stopTimer(); // Frenamos el reloj
    let userAns = document.getElementById('main-answer-input').value.trim();
    if(!userAns && !isTimeout) return; // Evita patear vacío sin querer

    let correctAns = currentMatch.ejercicioActual.answer.trim();
    let esCorrecto = false;

    if (!isTimeout) {
        if (userAns === correctAns) {
            esCorrecto = true;
        } else {
            let userVal = parseFraction(userAns);
            let correctVal = parseFraction(correctAns);
            if (!isNaN(userVal) && !isNaN(correctVal) && userVal === correctVal) esCorrecto = true;
        }
    }

    // CASO 1: MUERTE SÚBITA
    if (currentMatch.estado === 'TIEBREAKER') {
        if (esCorrecto) {
            playAnimation('goal', () => {
                if(currentMatch.subTurno === 'A') currentMatch.scoreA++; else currentMatch.scoreB++;
                endMatch();
            });
        } else {
            playAnimation('miss', () => {
                if(currentMatch.subTurno === 'A') currentMatch.scoreB++; else currentMatch.scoreA++;
                endMatch();
            });
        }
        return;
    }

    // CASO 2: ROBO DE VAR
    if (currentMatch.estado === 'VAR') {
        if (esCorrecto) {
            playAnimation('goal', () => {
                if(currentMatch.subTurno === 'A') currentMatch.scoreB++; else currentMatch.scoreA++;
                currentMatch.precisionPoints += 50;
                evaluarMarcador();
            });
        } else {
            playAnimation('miss', () => { evaluarMarcador(); });
        }
        return;
    }

    // CASO 3: TIRO NORMAL
    if (esCorrecto) {
        playAnimation('goal', () => {
            if(currentMatch.subTurno === 'A') currentMatch.scoreA++; else currentMatch.scoreB++;
            currentMatch.precisionPoints += 100;
            evaluarMarcador();
        });
    } else {
        let animType = 'miss';
        
        // Solo calculamos si tocó el palo si NO se le agotó el tiempo
        if (!isTimeout) {
            let userVal = parseFraction(userAns);
            let correctVal = parseFraction(correctAns);
            if (!isNaN(userVal) && !isNaN(correctVal)) {
                let diff = Math.abs(userVal - correctVal);
                if (diff === 0 || diff <= 1.5) animType = 'post';
            }
        }

        playAnimation(animType, () => {
            if (isTimeout) {
                // Si fue por tiempo, la tira afuera directo y no hay VAR
                evaluarMarcador(); 
            } else {
                let opponentStudent = currentMatch.subTurno === 'A' ? currentMatch.alumnoB : currentMatch.alumnoA;
                document.getElementById('var-text').innerText = `¡Oportunidad de VAR! Si ${opponentStudent} calcula la respuesta exacta, roba el punto.`;
                document.getElementById('var-block').style.display = "block";

                sfxVar.play();
                startTimer(600); // 10 segundos para robar el turno
            }
        });
    }
}

function evaluarMarcador() {
    updateScoreboardUI();

    // ¿Alguien llegó a 2 goles? Gana el partido.
    if (currentMatch.scoreA === 2 || currentMatch.scoreB === 2) { 
        endMatch(); 
        return; 
    }

    // ¿Están empatados 1 a 1? Muerte súbita.
    if (currentMatch.scoreA === 1 && currentMatch.scoreB === 1) {
        startTieBreaker();
        return;
    }

    // Sumamos una ronda si el equipo B terminó su turno
    if (currentMatch.subTurno === 'B') {
        currentMatch.round++;
    }

    // Si nadie ganó ni empató en 1, cambia el turno y sigue normal.
    currentMatch.subTurno = currentMatch.subTurno === 'A' ? 'B' : 'A';
    currentMatch.estado = 'NORMAL';
    nextPenaltyTurn();
}
function startTieBreaker() {
    currentMatch.estado = 'ESPERANDO_PULSADOR';
    document.getElementById('main-answer-input').value = "";
    
    // Asignación de Iniciales Dinámicas
    currentMatch.teclaA = currentMatch.alumnoA.charAt(0).toUpperCase();
    currentMatch.teclaB = currentMatch.alumnoB.charAt(0).toUpperCase();
    
    // Si las iniciales son iguales, le damos la segunda letra al alumno B
    if (currentMatch.teclaA === currentMatch.teclaB) {
        currentMatch.teclaB = currentMatch.alumnoB.charAt(1).toUpperCase();
    }

    document.getElementById('btn-pul-a').innerText = currentMatch.teclaA;
    document.getElementById('btn-pul-b').innerText = currentMatch.teclaB;
    
    document.getElementById('kicker-title').innerText = `¡MANOS AL TECLADO!`;
    document.getElementById('display-team-current').innerText = "El más rápido responde...";

    document.getElementById('pul-player-a').innerText = currentMatch.alumnoA;
    document.getElementById('pul-player-b').innerText = currentMatch.alumnoB;
    document.getElementById('pulsador-block').style.display = "block";

    let randomIdx = Math.floor(Math.random() * listadoEjercicios.length);
    currentMatch.ejercicioActual = listadoEjercicios[randomIdx];
    let mathBox = document.getElementById('math-box');
    mathBox.innerHTML = `$$${currentMatch.ejercicioActual.latex}$$`;
    MathJax.typesetPromise([mathBox]).then(() => {
        startTimer(600); // Tienen 10 segundos para reaccionar
    });
}

function handlePulsador(key) {
    if (currentMatch.estado !== 'ESPERANDO_PULSADOR') return;
    
    let teclaPresionada = key.toUpperCase();

    if (teclaPresionada === currentMatch.teclaA || teclaPresionada === 'A_BTN') {
        currentMatch.subTurno = 'A';
        activarInputDespuesDePulsador(currentMatch.alumnoA, currentMatch.teamA.pais);
    } else if (teclaPresionada === currentMatch.teclaB || teclaPresionada === 'B_BTN') {
        currentMatch.subTurno = 'B';
        activarInputDespuesDePulsador(currentMatch.alumnoB, currentMatch.teamB.pais);
    }
}

function activarInputDespuesDePulsador(alumno, pais) {
    currentMatch.estado = 'TIEBREAKER';
    document.getElementById('pulsador-block').style.display = "none";
    document.getElementById('kicker-title').innerText = `¡RESPONDE: ${alumno}!`;
    document.getElementById('display-team-current').innerText = `Si acierta gana, si falla gana el rival.`;
    startTimer(600); // Tienen 10 segundos para ingresar el resultado
}

function endMatch() {
    sfxGanador.play(); // ¡Música de victoria!
    showScreen('screen-result');
    document.getElementById('final-match-score').innerText = `${currentMatch.scoreA} - ${currentMatch.scoreB}`;
    
    // Identificamos al país y al alumno ganador
    let winnerPais = currentMatch.scoreA > currentMatch.scoreB ? currentMatch.teamA.pais : currentMatch.teamB.pais;
    let winnerAlumno = currentMatch.scoreA > currentMatch.scoreB ? currentMatch.alumnoA : currentMatch.alumnoB;
    
    // Mostramos ambos en el texto final
    document.getElementById('final-winner-text').innerText = `¡Ganador: ${winnerPais} (${winnerAlumno})!`;
    document.getElementById('final-precision-text').innerText = `Puntos de precisión: ${currentMatch.precisionPoints} pts.`;
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

// ==========================================
// LISTENER GLOBAL DE TECLADO FÍSICO
// ==========================================
document.addEventListener('keydown', function(event) {
    if (!document.getElementById('screen-arena').classList.contains('active')) return;

    // Si estamos esperando el pulsador, SOLO escuchamos las letras asignadas
    if (currentMatch.estado === 'ESPERANDO_PULSADOR') {
        let teclaPresionada = event.key.toUpperCase();
        if (teclaPresionada === currentMatch.teclaA || teclaPresionada === currentMatch.teclaB) {
            handlePulsador(teclaPresionada);
        }
        return; 
    }

    // Teclas permitidas para responder el ejercicio
    const teclasPermitidas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '/', '^','.'];
    
    if (teclasPermitidas.includes(event.key)) {
        pressKey(event.key);
    } else if (event.key === 'Backspace') {
        pressKey('backspace');
    } else if (event.key === 'Enter') {
        event.preventDefault(); 
        submitPenalty();
    } else if (event.key.toLowerCase() === 'c') {
        pressKey('clear');
    }

    


});

import { GoogleGenerativeAI } from "@google/generative-ai";

import { marked } from "marked";
import JSZip from "jszip";
import { AuthService } from "./src/lib/auth";
import { AuthModal } from "./src/components/AuthModal";
import { renderContactModal } from "./src/components/ContactModal";
import { SessionsList } from "./src/components/SessionsList";
import { PdfList } from "./src/components/PdfList";
import { TranscriptionProgress } from "./src/components/TranscriptionProgress";
import { DatabaseService } from "./src/lib/database";
import { StorageService } from "./src/lib/storage";
import { PdfService } from "./src/lib/pdf-service";
import type { DictationSession, PdfDocument } from "./src/lib/supabase";
import type { User } from "@supabase/supabase-js";

import { supabase } from "./src/lib/supabase";
import { openProfileModal } from "./src/components/ProfileModal";
import { createProfileModal } from "./src/components/ProfileModal";

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

function getModel() {
  return "gpt-4.1-nano";
}

document
  .getElementById("showProfileBtn")
  ?.addEventListener("click", openProfileModal);
// Global variables
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let recordingStartTime: number = 0;
let recordingTimer: number | null = null;
let recordingDuration = 30; // Default 30 minutes
let maxRecordingTime = 30 * 60 * 1000; // 30 minutes in milliseconds
let currentAudioBlob: Blob | null = null;
let currentSessionId: string | null = null;
let currentUser: User | null = null;
let liveWaveformAnimationId: number | null = null;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let dataArray: Uint8Array | null = null;

// UI Components
let authModal: AuthModal;
let sessionsList: SessionsList;
let pdfList: PdfList;
let transcriptionProgress: TranscriptionProgress;

// Initialize Gemini AI with validation
//function initializeGeminiAI() {
// const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
// const genAI = new GoogleGenerativeAI(apiKey);
// if (!apiKey || apiKey.trim() === '' || apiKey === 'VITE_GEMINI_API_KEY') {
//  console.warn('Gemini API key is missing or using example key. Please set VITE_GEMINI_API_KEY in your .env file.');
//  return null;
//}

// return new GoogleGenerativeAI(apiKey);
//}

//const genAI = initializeGeminiAI();

// Microphone status tracking
let microphoneStatus = {
  available: false,
  permission: "unknown" as "granted" | "denied" | "prompt" | "unknown",
  error: null as string | null,
};

// Check microphone availability and permissions
async function checkMicrophoneStatus(): Promise<void> {
  try {
    // Reset status
    microphoneStatus = {
      available: false,
      permission: "unknown",
      error: null,
    };

    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      microphoneStatus.error =
        "Votre navigateur ne supporte pas l'enregistrement audio. Veuillez utiliser un navigateur moderne comme Chrome, Firefox ou Safari.";
      updateMicrophoneUI();
      return;
    }

    // Check if we're on HTTPS or localhost
    const isSecureContext =
      window.isSecureContext ||
      location.protocol === "https:" ||
      location.hostname === "localhost";
    if (!isSecureContext) {
      microphoneStatus.error =
        "L'accès au microphone nécessite une connexion sécurisée (HTTPS). Veuillez accéder à l'application via HTTPS.";
      updateMicrophoneUI();
      return;
    }

    // Check permissions if available
    if ("permissions" in navigator) {
      try {
        const permissionStatus = await navigator.permissions.query({
          name: "microphone" as PermissionName,
        });
        microphoneStatus.permission = permissionStatus.state;

        if (permissionStatus.state === "denied") {
          microphoneStatus.error =
            "L'accès au microphone a été refusé. Veuillez autoriser l'accès au microphone dans les paramètres de votre navigateur.";
          updateMicrophoneUI();
          return;
        }
      } catch (e) {
        console.log(
          "Permission API not fully supported, will try direct access"
        );
      }
    }

    // Try to enumerate devices to check for microphones
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(
        (device) => device.kind === "audioinput"
      );

      if (audioInputs.length === 0) {
        microphoneStatus.error =
          "Aucun microphone détecté. Veuillez connecter un microphone et actualiser la page.";
        updateMicrophoneUI();
        return;
      }
    } catch (e) {
      console.log("Could not enumerate devices, will try direct access");
    }

    // Try to get user media to test actual access
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Success! Clean up the test stream
      stream.getTracks().forEach((track) => track.stop());

      microphoneStatus.available = true;
      microphoneStatus.permission = "granted";
      microphoneStatus.error = null;
    } catch (error: any) {
      console.error("Microphone access error:", error);

      switch (error.name) {
        case "NotAllowedError":
          microphoneStatus.permission = "denied";
          microphoneStatus.error =
            "L'accès au microphone a été refusé. Cliquez sur l'icône de microphone dans la barre d'adresse pour autoriser l'accès.";
          break;
        case "NotFoundError":
          microphoneStatus.error =
            "Aucun microphone trouvé. Veuillez connecter un microphone et actualiser la page.";
          break;
        case "NotReadableError":
          microphoneStatus.error =
            "Le microphone est utilisé par une autre application. Fermez les autres applications utilisant le microphone et réessayez.";
          break;
        case "OverconstrainedError":
          microphoneStatus.error =
            "Les paramètres audio demandés ne sont pas supportés par votre microphone.";
          break;
        case "SecurityError":
          microphoneStatus.error =
            "Erreur de sécurité. L'accès au microphone nécessite une connexion sécurisée (HTTPS).";
          break;
        default:
          microphoneStatus.error = `Erreur d'accès au microphone: ${
            error.message || "Erreur inconnue"
          }`;
      }
    }

    updateMicrophoneUI();
  } catch (error) {
    console.error("Error checking microphone status:", error);
    microphoneStatus.error = "Erreur lors de la vérification du microphone.";
    updateMicrophoneUI();
  }
}

// Update UI based on microphone status
function updateMicrophoneUI(): void {
  const recordButton = document.getElementById(
    "recordButton"
  ) as HTMLButtonElement;
  const recordingStatus = document.getElementById(
    "recordingStatus"
  ) as HTMLElement;

  if (!recordButton || !recordingStatus) return;

  if (microphoneStatus.available) {
    recordButton.disabled = false;
    recordButton.title = "Commencer l'enregistrement";
    recordingStatus.textContent = "Prêt à enregistrer";
    recordButton.style.opacity = "1";
  } else {
    recordButton.disabled = true;
    recordButton.title = microphoneStatus.error || "Microphone non disponible";
    recordingStatus.textContent =
      microphoneStatus.error || "Microphone non disponible";
    recordButton.style.opacity = "0.5";
  }
}

// Show microphone help dialog
function showMicrophoneHelp(): void {
  const helpMessage =
    microphoneStatus.error || "Problème d'accès au microphone";

  let instructions = "";

  if (microphoneStatus.permission === "denied") {
    instructions = `
      <h3>Comment autoriser l'accès au microphone :</h3>
      <ol>
        <li>Cliquez sur l'icône de microphone ou de cadenas dans la barre d'adresse</li>
        <li>Sélectionnez "Autoriser" pour le microphone</li>
        <li>Actualisez la page</li>
      </ol>
      <p><strong>Ou dans les paramètres du navigateur :</strong></p>
      <ul>
        <li><strong>Chrome :</strong> Paramètres → Confidentialité et sécurité → Paramètres du site → Microphone</li>
        <li><strong>Firefox :</strong> Paramètres → Vie privée et sécurité → Permissions → Microphone</li>
        <li><strong>Safari :</strong> Préférences → Sites web → Microphone</li>
      </ul>
    `;
  } else if (!window.isSecureContext && location.protocol !== "https:") {
    instructions = `
      <h3>Connexion sécurisée requise :</h3>
      <p>L'accès au microphone nécessite une connexion HTTPS pour des raisons de sécurité.</p>
      <p>Veuillez accéder à l'application via une URL HTTPS.</p>
    `;
  } else {
    instructions = `
      <h3>Vérifications à effectuer :</h3>
      <ol>
        <li>Vérifiez qu'un microphone est connecté à votre ordinateur</li>
        <li>Fermez les autres applications utilisant le microphone (Zoom, Teams, etc.)</li>
        <li>Vérifiez les paramètres audio de votre système</li>
        <li>Actualisez la page et réessayez</li>
      </ol>
    `;
  }

  const modal = document.createElement("div");
  modal.className = "delete-confirmation-modal visible";
  modal.innerHTML = `
    <div class="delete-confirmation-content">
      <div class="delete-confirmation-icon">
        <i class="fas fa-microphone-slash"></i>
      </div>
      <h3 class="delete-confirmation-title">Problème de microphone</h3>
      <div class="delete-confirmation-message" style="text-align: left; max-height: 300px; overflow-y: auto;">
        <p style="margin-bottom: 16px;"><strong>Erreur :</strong> ${helpMessage}</p>
        ${instructions}
      </div>
      <div class="delete-confirmation-actions">
        <button class="delete-confirmation-btn cancel" id="helpCloseBtn">Fermer</button>
        <button class="delete-confirmation-btn confirm" id="helpRetryBtn">Réessayer</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = modal.querySelector("#helpCloseBtn") as HTMLButtonElement;
  const retryBtn = modal.querySelector("#helpRetryBtn") as HTMLButtonElement;

  closeBtn.addEventListener("click", () => {
    modal.remove();
  });

  retryBtn.addEventListener("click", async () => {
    modal.remove();
    await checkMicrophoneStatus();
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// Enhanced recording with pre-popup and proper processing
async function startRecording(): Promise<void> {
  try {
    // 1️⃣ Vérifie le micro
    if (!microphoneStatus.available) {
      showMicrophoneHelp();
      return;
    }

    // 2️⃣ Affiche le popup avant de démarrer l'enregistrement
    const selections = await showMultiSelectionPopup();
    if (!selections) {
      console.log("Enregistrement annulé : aucune sélection");
      return;
    }

    // 3️⃣ Récupère le flux audio
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 44100,
        channelCount: 1,
      },
    });

    // 4️⃣ Audio context pour visualisation
    audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    // 5️⃣ MediaRecorder setup
    const options: MediaRecorderOptions = {
      mimeType: "audio/webm;codecs=opus",
    };
    if (!MediaRecorder.isTypeSupported(options.mimeType!)) {
      options.mimeType = "audio/mp4";
      if (!MediaRecorder.isTypeSupported(options.mimeType))
        options.mimeType = "audio/wav";
    }

    mediaRecorder = new MediaRecorder(stream, options);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunks.push(event.data);
    };

    mediaRecorder.onerror = (event) => {
      console.error("MediaRecorder error:", event);
      stopRecording();
      alert("Erreur lors de l'enregistrement. Veuillez réessayer.");
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, {
        type: mediaRecorder?.mimeType || "audio/webm",
      });
      currentAudioBlob = audioBlob;

      // Stop all tracks
      stream.getTracks().forEach((track) => track.stop());

      // Cleanup audio context
      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }

      // 🔹 Passe les sélections au traitement
      await processRecording(audioBlob, selections);
    };

    // 6️⃣ Démarre l'enregistrement
    mediaRecorder.start(1000); // chunk toutes les secondes
    recordingStartTime = Date.now();

    // 7️⃣ Update UI et timer
    updateRecordingUI(true);
    startRecordingTimer(); // maxRecordingTime géré ici
    startLiveWaveform();

    // 8️⃣ Auto-stop au bout de maxRecordingTime
    setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state === "recording") stopRecording();
    }, maxRecordingTime);
  } catch (error: any) {
    console.error("Error starting recording:", error);

    await checkMicrophoneStatus();
    if (!microphoneStatus.available) {
      showMicrophoneHelp();
    } else {
      alert(`Erreur lors du démarrage de l'enregistrement: ${error.message}`);
    }
  }
}

function stopRecording(): void {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }

  updateRecordingUI(false);
  stopRecordingTimer();
  stopLiveWaveform();
}

function updateRecordingUI(isRecording: boolean): void {
  const recordButton = document.getElementById(
    "recordButton"
  ) as HTMLButtonElement;
  const recordingInterface = document.querySelector(
    ".recording-interface"
  ) as HTMLElement;
  const liveTitle = document.getElementById(
    "liveRecordingTitle"
  ) as HTMLElement;
  const liveCanvas = document.getElementById(
    "liveWaveformCanvas"
  ) as HTMLCanvasElement;
  const liveTimer = document.getElementById(
    "liveRecordingTimerDisplay"
  ) as HTMLElement;

  if (isRecording) {
    recordButton.classList.add("recording");
    recordingInterface.classList.add("is-live");

    if (liveTitle) {
      liveTitle.style.display = "block";
      liveTitle.textContent = "Enregistrement en cours...";
    }
    if (liveCanvas) liveCanvas.style.display = "block";
    if (liveTimer) liveTimer.style.display = "block";
  } else {
    recordButton.classList.remove("recording");
    recordingInterface.classList.remove("is-live");

    if (liveTitle) liveTitle.style.display = "none";
    if (liveCanvas) liveCanvas.style.display = "none";
    if (liveTimer) liveTimer.style.display = "none";
  }
}

function startRecordingTimer(): void {
  const maxRecordingTime = 20 * 60 * 1000; // 20 minutes en ms
  const timerDisplay = document.getElementById(
    "liveRecordingTimerDisplay"
  ) as HTMLElement;
  const recordingStartTime = Date.now();

  const recordingTimer = window.setInterval(() => {
    const elapsed = Date.now() - recordingStartTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    const centiseconds = Math.floor((elapsed % 1000) / 10);

    if (timerDisplay) {
      timerDisplay.textContent = `${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${centiseconds
        .toString()
        .padStart(2, "0")}`;
    }

    // Arrêt automatique si durée max atteinte
    if (elapsed >= maxRecordingTime) {
      stopRecording();
      clearInterval(recordingTimer);
    }
  }, 10);
}

function startLiveWaveform(): void {
  const canvas = document.getElementById(
    "liveWaveformCanvas"
  ) as HTMLCanvasElement;
  if (!canvas || !analyser || !dataArray) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const draw = () => {
    if (!analyser || !dataArray) return;

    liveWaveformAnimationId = requestAnimationFrame(draw);

    analyser.getByteFrequencyData(dataArray);

    ctx.fillStyle = "rgba(18, 18, 18, 0.3)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / dataArray.length) * 2.5;
    let barHeight;
    let x = 0;

    for (let i = 0; i < dataArray.length; i++) {
      barHeight = (dataArray[i] / 255) * canvas.height * 0.8;

      const gradient = ctx.createLinearGradient(
        0,
        canvas.height - barHeight,
        0,
        canvas.height
      );
      gradient.addColorStop(0, "#82aaff");
      gradient.addColorStop(1, "#c792ea");

      ctx.fillStyle = gradient;
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

      x += barWidth + 1;
    }
  };

  draw();
}

function stopLiveWaveform(): void {
  if (liveWaveformAnimationId) {
    cancelAnimationFrame(liveWaveformAnimationId);
    liveWaveformAnimationId = null;
  }
}

// Types pour clarté
type SelectionResult = {
  goal: string | null;
  industry: string | null;
  role: string | null;
};
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  if (!audioBlob || audioBlob.size === 0) {
    throw new Error("Fichier audio vide ou invalide");
  }

  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");
  formData.append("model", "whisper-1");

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur de transcription: ${errorText}`);
  }

  const result = await response.json();
  return result.text;
}

async function getUserActivity(): Promise<string | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("activity")
    .eq("id", user.id)
    .single();

  if (error || !data?.activity) return null;
  return data.activity;
}
// Types pour plus de clarté
type Selections = {
  goal: string;
  industry: string;
  role: string;
};

// Affiche popup avec 3 listes et retourne les 3 choix ou null si annulé
function showMultiSelectionPopup(): Promise<Selections | null> {
  return new Promise((resolve) => {
    // Overlay semi-transparent
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.6)";
    overlay.style.display = "flex";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.zIndex = "9999";

    const isLightMode = document.body.classList.contains("light-mode");

    // Popup container
    const popup = document.createElement("div");
    popup.style.background = isLightMode
      ? "var(--color-surface-light)"
      : "var(--color-surface-dark)";
    popup.style.color = isLightMode
      ? "var(--color-text-light)"
      : "var(--color-text-dark)";
    popup.style.padding = "20px";
    popup.style.borderRadius = "12px";
    popup.style.boxShadow = isLightMode
      ? "var(--shadow-md)"
      : "var(--shadow-lg)";
    popup.style.border = `1px solid ${
      isLightMode ? "var(--color-border-light)" : "var(--color-border-dark)"
    }`;
    popup.style.minWidth = "320px";
    popup.style.maxWidth = "90%";
    popup.style.transition = "var(--transition-normal)";
    popup.style.maxHeight = "80vh";
    popup.style.overflowY = "auto";

    popup.innerHTML = `<h3 style="margin-top: 0;">Paramétrez votre transcription</h3>`;

    // Fonction pour créer un select avec options et label
    function createSelect(
      labelText: string,
      options: string[]
    ): HTMLSelectElement {
      const container = document.createElement("div");
      container.style.marginBottom = "15px";

      const label = document.createElement("label");
      label.textContent = labelText;
      label.style.display = "block";
      label.style.marginBottom = "6px";

      const select = document.createElement("select");
      select.style.width = "100%";
      select.style.padding = "8px";
      select.style.borderRadius = "6px";
      select.style.border = `1px solid ${
        isLightMode ? "var(--color-border-light)" : "var(--color-border-dark)"
      }`;
      select.style.background = isLightMode
        ? "var(--color-bg-light)"
        : "var(--color-bg-dark)";
      select.style.color = isLightMode
        ? "var(--color-text-light)"
        : "var(--color-text-dark)";
      select.style.fontSize = "1rem";

      const defaultOption = document.createElement("option");
      defaultOption.textContent = `-- Choisissez ${labelText.toLowerCase()} --`;
      defaultOption.disabled = true;
      defaultOption.selected = true;
      select.appendChild(defaultOption);

      options.forEach((opt) => {
        const option = document.createElement("option");
        option.value = opt;
        option.textContent = opt;
        select.appendChild(option);
      });

      container.appendChild(label);
      container.appendChild(select);
      popup.appendChild(container);

      return select;
    }

    // Listes à choisir
    const goals = [
      "Transcrire des conversations en direct",
      "Obtenir une transcription mot à mot",
      "Résumé les points clés des réunions",
      "Créer des notes de réunions exploitables",
      "Résumer des vidéos et des podcasts",
      "Collaborer facilement avec mon équipe",
      "Autres",
    ];

    const industries = [
      "Ventes",
      "Youtuber/Réalisateur Vidéo",
      "Médecin Hospitalier",
      "Service Client",
      "Ecrivain",
      "Finance",
      "Coach/Consultant",
      "Educateur",
      "Etudiant",
      "Médecin Généraliste",
      "RP/Marketing",
      "Médical/Santé",
      "Ingénierie",
      "Infirmier/Soignant",
      "Ressources Humaines & Juridique",
      "Media/Podcasting",
      "Responsable Produit/Projet",
      "Autre",
    ];

    const roles = [
      "Cadre supérieur",
      "Cadre dirigeant/DG",
      "Directeur/Cadre",
      "Membre de l'équipe",
      "Travailleur indépendant",
      "Autres",
    ];

    // Crée les selects
    const goalSelect = createSelect("Je veux", goals);
    const industrySelect = createSelect("Je travaille en tant que", industries);
    const roleSelect = createSelect("Mon rôle est", roles);

    // Boutons
    const btns = document.createElement("div");
    btns.style.textAlign = "right";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Annuler";
    cancelBtn.style.marginRight = "10px";
    cancelBtn.style.padding = "6px 12px";
    cancelBtn.style.borderRadius = "6px";
    cancelBtn.style.border = "none";
    cancelBtn.style.backgroundColor = isLightMode ? "#ccc" : "#555";
    cancelBtn.style.color = isLightMode ? "#000" : "#fff";
    cancelBtn.style.cursor = "pointer";

    const okBtn = document.createElement("button");
    okBtn.textContent = "Valider";
    okBtn.disabled = true;
    okBtn.style.padding = "6px 12px";
    okBtn.style.borderRadius = "6px";
    okBtn.style.border = "none";
    okBtn.style.backgroundColor = isLightMode
      ? "var(--color-accent-light)"
      : "var(--color-accent-dark)";
    okBtn.style.color = "#fff";
    okBtn.style.cursor = "pointer";

    // Activation du bouton valider uniquement si les 3 selections sont faites
    function checkSelections() {
      okBtn.disabled = !(
        goalSelect.value &&
        industrySelect.value &&
        roleSelect.value
      );
    }

    goalSelect.addEventListener("change", checkSelections);
    industrySelect.addEventListener("change", checkSelections);
    roleSelect.addEventListener("change", checkSelections);

    cancelBtn.onclick = () => {
      document.body.removeChild(overlay);
      resolve(null);
    };

    okBtn.onclick = () => {
      document.body.removeChild(overlay);
      resolve({
        goal: goalSelect.value,
        industry: industrySelect.value,
        role: roleSelect.value,
      });
    };

    btns.appendChild(cancelBtn);
    btns.appendChild(okBtn);

    popup.appendChild(btns);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);
  });
}

// processRecording amélioré
async function processRecording(
  audioBlob: Blob,
  selections: Selections
): Promise<void> {
  if (!currentUser) {
    console.error("Aucun utilisateur connecté");
    alert("Vous devez être connecté pour enregistrer.");
    return;
  }

  const recordingDurationMs = Date.now() - recordingStartTime;
  const recordingDurationSeconds = Math.floor(recordingDurationMs / 1000);

  transcriptionProgress.show(() => {
    console.log("Transcription annulée");
  });

  try {
    transcriptionProgress.setStep(0, "Création de la session...");

    // Création de la session avec les sélections
    const sessionData: Partial<DictationSession> = {
      user_id: currentUser.id,
      title: "Nouvel enregistrement",
      recording_duration: recordingDurationSeconds,
      raw_transcription: "",
      summary: "",
      detailed_note: "",
      goal: selections.goal,
      industry: selections.industry,
      role: selections.role,
    };

    const session = await DatabaseService.createSession(sessionData);
    if (!session) throw new Error("Impossible de créer la session");

    window.currentSessionId = session.id;
    localStorage.setItem("currentSessionId", session.id);

    // Upload audio
    transcriptionProgress.setStep(1, "Téléversement de l'audio...");
    const audioFile = new File([audioBlob], `recording-${session.id}.webm`, {
      type: audioBlob.type,
    });

    const audioPath = await StorageService.uploadAudioFile(
      audioFile,
      currentUser.id,
      session.id
    );
    if (!audioPath) throw new Error("Échec du téléversement audio");

    await DatabaseService.updateSession(session.id, {
      audio_file_path: audioPath,
    });

    // Transcription
    transcriptionProgress.setStep(2, "Transcription par IA...");
    const transcription = await transcribeAudio(audioBlob);
    if (!transcription) throw new Error("Échec de la transcription");

    // Titre
    transcriptionProgress.setStep(3, "Génération du titre...");
    const title = await generateTitle(transcription, selections);

    // Résumé
    transcriptionProgress.setStep(4, "Création du résumé...");
    const summary = await generateSummary(transcription, selections);

    // Note détaillée
    transcriptionProgress.setStep(5, "Rédaction de la note détaillée...");
    const detailedNote = await generateDetailedNote(transcription, selections);

    // Mise à jour finale
    const updatedSession = await DatabaseService.updateSession(session.id, {
      title,
      raw_transcription: transcription,
      summary,
      detailed_note: detailedNote,
    });

    if (!updatedSession)
      throw new Error("Échec de la mise à jour de la session");

    // Affiche dans l'UI
    window.currentSessionId = updatedSession.id;
    localStorage.setItem("currentSessionId", updatedSession.id);
    loadSessionIntoUI(updatedSession);
    await sessionsList.loadSessions();

    transcriptionProgress.setSuccess("Enregistrement traité avec succès !");
  } catch (error) {
    console.error("Erreur lors du traitement :", error);
    transcriptionProgress.setError(
      `Erreur : ${error instanceof Error ? error.message : "Erreur inconnue"}`
    );
    alert(
      `Erreur lors du traitement : ${
        error instanceof Error ? error.message : "Erreur inconnue"
      }`
    );
  }
}

// Fonctions d'appel OpenAI adaptées à l'objet selections
export async function generateTitle(
  transcription: string,
  selections: Selections
): Promise<string> {
  const prompt = `
Contexte professionnel : Secteur - ${selections.industry}, Rôle - ${selections.role}
Objectif : ${selections.goal}
Génère un titre court et descriptif (max 60 caractères) pour la transcription suivante :

${transcription}
  `.trim();

  const response = await openai.chat.completions.create({
    model: getModel(),
    messages: [
      { role: "system", content: "Tu es un assistant expert en résumé." },
      { role: "user", content: prompt },
    ],
  });

  return response.choices[0].message?.content?.trim() || "Sans titre";
}

export async function generateSummary(
  transcription: string,
  selections: Selections
): Promise<string> {
  const prompt = `
Contexte professionnel : Secteur - ${selections.industry}, Rôle - ${selections.role}
Objectif : ${selections.goal}
Fais un résumé structuré et professionnel (3 à 5 phrases) pour la transcription suivante :

${transcription}
  `.trim();

  const response = await openai.chat.completions.create({
    model: getModel(),
    messages: [
      { role: "system", content: "Tu es un assistant expert en résumé." },
      { role: "user", content: prompt },
    ],
  });

  return response.choices[0].message?.content?.trim() || "";
}

export async function generateDetailedNote(
  transcription: string,
  selections: Selections
): Promise<string> {
  const prompt = `
Contexte professionnel : Secteur - ${selections.industry}, Rôle - ${selections.role}
Objectif : ${selections.goal}
Transforme cette transcription en une note professionnelle structurée en Markdown :

${transcription}
  `.trim();

  const response = await openai.chat.completions.create({
    model: getModel(),
    messages: [
      {
        role: "system",
        content: "Tu es un assistant de rédaction professionnelle.",
      },
      { role: "user", content: prompt },
    ],
  });

  return response.choices[0].message?.content?.trim() || "";
}

function loadSessionIntoUI(session: DictationSession): void {
  const titleElement = document.querySelector(".editor-title") as HTMLElement;
  if (titleElement) {
    titleElement.textContent = session.title;
  }

  const summaryEditor = document.getElementById("summaryEditor") as HTMLElement;
  const polishedNote = document.getElementById("polishedNote") as HTMLElement;
  const rawTranscription = document.getElementById(
    "rawTranscription"
  ) as HTMLElement;

  if (summaryEditor) {
    summaryEditor.innerHTML = marked.parse(session.summary || "");
  }
  if (polishedNote) {
    polishedNote.innerHTML = marked.parse(session.detailed_note || "");
  }
  if (rawTranscription) {
    rawTranscription.textContent = session.raw_transcription || "";
  }

  currentSessionId = session.id;
}

async function showAudioPlayback(
  audioPath: string,
  title: string
): Promise<void> {
  try {
    const audioUrl = await StorageService.getAudioFileUrl(audioPath);
    if (!audioUrl) return;

    const playbackControls = document.getElementById(
      "audioPlaybackControls"
    ) as HTMLElement;
    const audioPlayer = document.getElementById(
      "audioPlayer"
    ) as HTMLAudioElement;
    const playbackTitle = document.getElementById(
      "playbackTitle"
    ) as HTMLElement;
    const recordingInterface = document.querySelector(
      ".recording-interface"
    ) as HTMLElement;

    if (
      playbackControls &&
      audioPlayer &&
      playbackTitle &&
      recordingInterface
    ) {
      audioPlayer.src = audioUrl;
      playbackTitle.textContent = `Lecture: ${title}`;
      playbackControls.style.display = "block";
      recordingInterface.classList.add("is-playback");
    }
  } catch (error) {
    console.error("Error setting up audio playback:", error);
  }
}

// Audio playback controls
function setupAudioPlayback(): void {
  const playPauseBtn = document.getElementById(
    "playPauseBtn"
  ) as HTMLButtonElement;
  const stopPlaybackBtn = document.getElementById(
    "stopPlaybackBtn"
  ) as HTMLButtonElement;
  const audioSeeker = document.getElementById(
    "audioSeeker"
  ) as HTMLInputElement;
  const audioPlayer = document.getElementById(
    "audioPlayer"
  ) as HTMLAudioElement;
  const playbackTime = document.getElementById("playbackTime") as HTMLElement;

  if (
    !playPauseBtn ||
    !stopPlaybackBtn ||
    !audioSeeker ||
    !audioPlayer ||
    !playbackTime
  )
    return;

  playPauseBtn.addEventListener("click", () => {
    if (audioPlayer.paused) {
      audioPlayer.play();
      playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
      playPauseBtn.classList.add("playing");
    } else {
      audioPlayer.pause();
      playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
      playPauseBtn.classList.remove("playing");
    }
  });

  stopPlaybackBtn.addEventListener("click", () => {
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    playPauseBtn.classList.remove("playing");
    hideAudioPlayback();
  });

  audioSeeker.addEventListener("input", () => {
    const seekTime =
      (parseFloat(audioSeeker.value) / 100) * audioPlayer.duration;
    audioPlayer.currentTime = seekTime;
  });

  audioPlayer.addEventListener("timeupdate", () => {
    if (audioPlayer.duration) {
      const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
      audioSeeker.value = progress.toString();

      const currentTime = formatTime(audioPlayer.currentTime);
      const totalTime = formatTime(audioPlayer.duration);
      playbackTime.textContent = `${currentTime} / ${totalTime}`;
    }
  });

  audioPlayer.addEventListener("ended", () => {
    playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
    playPauseBtn.classList.remove("playing");
    audioSeeker.value = "0";
  });
}

function hideAudioPlayback(): void {
  const playbackControls = document.getElementById(
    "audioPlaybackControls"
  ) as HTMLElement;
  const recordingInterface = document.querySelector(
    ".recording-interface"
  ) as HTMLElement;

  if (playbackControls) {
    playbackControls.style.display = "none";
  }
  if (recordingInterface) {
    recordingInterface.classList.remove("is-playback");
  }
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

// File upload handlers
// Fonction générique pour afficher un message dans une popup simple
function showMessage(message, type = "info") {
  const existing = document.getElementById("messagePopup");
  if (existing) existing.remove();

  const popup = document.createElement("div");
  popup.id = "messagePopup";
  popup.style.position = "fixed";
  popup.style.top = "20px";
  popup.style.right = "20px";
  popup.style.padding = "12px 20px";
  popup.style.backgroundColor =
    type === "error" ? "#f44336" : type === "success" ? "#4CAF50" : "#2196f3";
  popup.style.color = "white";
  popup.style.borderRadius = "4px";
  popup.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
  popup.style.zIndex = 10000;
  popup.textContent = message;

  document.body.appendChild(popup);

  setTimeout(() => {
    popup.remove();
  }, 3000);
}

async function handleAudioUpload(file) {
  if (!currentUser) return;

  console.log(
    `Upload d'un fichier audio: ${file.name} (${(
      file.size /
      1024 /
      1024
    ).toFixed(2)} MB)`
  );

  transcriptionProgress.show();

  try {
    transcriptionProgress.setStep(
      0,
      `Traitement du fichier audio (${(file.size / 1024 / 1024).toFixed(
        2
      )} MB)...`
    );

    const sessionData = {
      user_id: currentUser.id,
      title: file.name.replace(/\.[^/.]+$/, ""),
      recording_duration: 0,
      raw_transcription: "",
      summary: "",
      detailed_note: "",
    };

    const session = await DatabaseService.createSession(sessionData);
    if (!session) {
      throw new Error("Impossible de créer la session");
    }

    currentSessionId = session.id;

    transcriptionProgress.setStep(1, "Téléversement du fichier...");
    const audioPath = await StorageService.uploadAudioFile(
      file,
      currentUser.id,
      session.id
    );
    if (!audioPath) {
      throw new Error("Impossible de téléverser le fichier");
    }

    await DatabaseService.updateSession(session.id, {
      audio_file_path: audioPath,
    });

    transcriptionProgress.setStep(
      2,
      "Transcription par IA (cela peut prendre du temps pour les gros fichiers)..."
    );
    const transcription = await transcribeAudio(file);

    transcriptionProgress.setStep(3, "Génération du titre...");
    const title = await generateTitle(transcription);

    transcriptionProgress.setStep(4, "Création du résumé...");
    const summary = await generateSummary(transcription);

    transcriptionProgress.setStep(5, "Rédaction de la note détaillée...");
    const detailedNote = await generateDetailedNote(transcription);

    const updatedSession = await DatabaseService.updateSession(session.id, {
      title: title || file.name.replace(/\.[^/.]+$/, ""),
      raw_transcription: transcription,
      summary: summary || "",
      detailed_note: detailedNote || "",
    });

    if (updatedSession) {
      loadSessionIntoUI(updatedSession);
      await sessionsList.loadSessions();
      transcriptionProgress.setSuccess("Fichier audio traité avec succès !");
    }
  } catch (error) {
    console.error("Error processing audio file:", error);
    transcriptionProgress.setError(
      `Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`
    );
    showMessage(
      `Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`,
      "error"
    );
  }
}

async function handlePdfUpload(file) {
  if (!currentUser) return;

  console.log(
    `Téléversement du fichier PDF : ${file.name} (${(
      file.size /
      1024 /
      1024
    ).toFixed(2)} MB)`
  );
  transcriptionProgress.show();

  try {
    transcriptionProgress.setStep(0, "Extraction du texte du PDF...");
    const extractedText = await PdfService.extractTextFromPdf(file);
    if (!extractedText)
      throw new Error("Impossible d'extraire le texte du fichier PDF.");

    const sessionData = {
      user_id: currentUser.id,
      title: file.name.replace(/\.[^/.]+$/, ""),
      recording_duration: 0,
      raw_transcription: "",
      summary: "",
      detailed_note: "",
    };

    const session = await DatabaseService.createSession(sessionData);
    if (!session) throw new Error("Impossible de créer la session.");
    currentSessionId = session.id;

    transcriptionProgress.setStep(1, "Téléversement du fichier PDF...");
    const pdfPath = await PdfService.uploadPdfFile(
      file,
      currentUser.id,
      session.id
    );
    if (!pdfPath) throw new Error("Échec du téléversement du fichier PDF.");

    const pdfDoc = await PdfService.createPdfDocument({
      user_id: currentUser.id,
      session_id: session.id,
      file_path: pdfPath,
      title: file.name.replace(/\.[^/.]+$/, ""),
      created_at: new Date().toISOString(),
    });
    if (!pdfDoc)
      throw new Error("Impossible d'enregistrer le document PDF en base.");

    transcriptionProgress.setStep(2, "Génération du titre...");
    let title = "";
    try {
      title = await generateTitle(extractedText);
    } catch (e) {
      console.warn("Erreur génération titre IA, fallback local", e);
      title = file.name.replace(/\.[^/.]+$/, "");
    }

    transcriptionProgress.setStep(3, "Création du résumé...");
    let summary = "";
    try {
      summary = await generateSummary(extractedText);
    } catch (e) {
      console.warn("Erreur génération résumé IA, fallback local", e);
      summary =
        extractedText
          .split(/[.!?]\s/)
          .slice(0, 3)
          .join(". ") + ".";
    }

    transcriptionProgress.setStep(4, "Rédaction de la note détaillée...");
    let detailedNote = "";
    try {
      detailedNote = await generateDetailedNote(extractedText);
    } catch (e) {
      console.warn("Erreur génération note détaillée IA, fallback local", e);
      detailedNote = `Texte extrait (longueur: ${extractedText.length} caractères).`;
    }

    const updatedSession = await DatabaseService.updateSession(session.id, {
      title: title || session.title,
      raw_transcription: extractedText,
      summary: summary || "",
      detailed_note: detailedNote || "",
    });
    if (!updatedSession)
      throw new Error("Erreur lors de la mise à jour de la session.");

    loadSessionIntoUI(updatedSession);

    transcriptionProgress.setStep(5, "Lecture du texte extrait...");
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(
        extractedText.slice(0, 1000)
      );
      utterance.lang = "fr-FR";
      utterance.rate = 1;
      window.speechSynthesis.speak(utterance);
    }

    await sessionsList.loadSessions();

    transcriptionProgress.setSuccess(
      "PDF traité avec succès avec résumé et note détaillée générés !"
    );
  } catch (error) {
    console.error("Erreur :", error);
    transcriptionProgress.setError(
      `Erreur : ${error instanceof Error ? error.message : "Erreur inconnue"}`
    );
    showMessage(
      `Erreur : ${error instanceof Error ? error.message : "Erreur inconnue"}`,
      "error"
    );
  }
}

document
  .getElementById("previewPdfButton")
  ?.addEventListener("click", async () => {
    if (!currentSessionId) {
      showMessage("Aucune session active", "error");
      return;
    }

    try {
      const pdfDocs = await PdfService.getSessionPdfDocuments(currentSessionId);
      if (!pdfDocs.length) {
        showMessage("Aucun PDF trouvé pour cette session", "error");
        return;
      }

      const url = await PdfService.getPdfFileUrl(pdfDocs[0].file_path);
      if (!url) {
        showMessage("Impossible d’obtenir l’URL du fichier PDF", "error");
        return;
      }

      window.open(url, "_blank");
    } catch (error) {
      console.error("Erreur de prévisualisation PDF :", error);
      showMessage(
        "Erreur lors de la prévisualisation du fichier PDF.",
        "error"
      );
    }
  });

// Utility functions
function clearCurrentNote(): void {
  const titleElement = document.querySelector(".editor-title") as HTMLElement;
  const summaryEditor = document.getElementById("summaryEditor") as HTMLElement;
  const polishedNote = document.getElementById("polishedNote") as HTMLElement;
  const rawTranscription = document.getElementById(
    "rawTranscription"
  ) as HTMLElement;

  if (titleElement) titleElement.textContent = "Untitled Note";
  if (summaryEditor) summaryEditor.innerHTML = "";
  if (polishedNote) polishedNote.innerHTML = "";
  if (rawTranscription) rawTranscription.textContent = "";

  currentSessionId = null;
  currentAudioBlob = null;
  hideAudioPlayback();
}

function toggleTheme(): void {
  document.body.classList.toggle("light-mode");
  const themeButton = document.getElementById(
    "themeToggleButton"
  ) as HTMLButtonElement;
  const icon = themeButton.querySelector("i") as HTMLElement;

  if (document.body.classList.contains("light-mode")) {
    icon.className = "fas fa-moon";
    localStorage.setItem("theme", "light");
  } else {
    icon.className = "fas fa-sun";
    localStorage.setItem("theme", "dark");
  }
}

function setupTabNavigation(): void {
  const tabButtons = document.querySelectorAll(".tab-button");
  const noteContents = document.querySelectorAll(".note-content");
  const activeIndicator = document.querySelector(
    ".active-tab-indicator"
  ) as HTMLElement;

  function updateActiveTab(activeButton: HTMLElement): void {
    const activeTab = activeButton.dataset.tab!;

    tabButtons.forEach((btn) => btn.classList.remove("active"));
    noteContents.forEach((content) => content.classList.remove("active"));

    activeButton.classList.add("active");
    const activeContent = document.getElementById(getContentId(activeTab));
    if (activeContent) {
      activeContent.classList.add("active");
    }

    // Update indicator position
    const buttonRect = activeButton.getBoundingClientRect();
    const containerRect = activeButton.parentElement!.getBoundingClientRect();
    const left = buttonRect.left - containerRect.left;
    const width = buttonRect.width;

    activeIndicator.style.left = `${left}px`;
    activeIndicator.style.width = `${width}px`;
  }

  function getContentId(tab: string): string {
    switch (tab) {
      case "summary":
        return "summaryEditor";
      case "note":
        return "polishedNote";
      case "raw":
        return "rawTranscription";
      default:
        return "summaryEditor";
    }
  }

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      updateActiveTab(button as HTMLElement);
    });
  });

  // Initialize first tab
  const firstTab = tabButtons[0] as HTMLElement;
  if (firstTab) {
    updateActiveTab(firstTab);
  }
}

// Copy and save functions
async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copié dans le presse-papiers !");
  } catch (error) {
    console.error("Error copying to clipboard:", error);
    showToast("Erreur lors de la copie");
  }
}

function downloadAsFile(
  content: string,
  filename: string,
  mimeType: string = "text/plain"
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function saveAllAsZip(): Promise<void> {
  try {
    const zip = new JSZip();

    const titleElement = document.querySelector(".editor-title") as HTMLElement;
    const title = titleElement?.textContent || "Untitled Note";

    const summaryEditor = document.getElementById(
      "summaryEditor"
    ) as HTMLElement;
    const polishedNote = document.getElementById("polishedNote") as HTMLElement;
    const rawTranscription = document.getElementById(
      "rawTranscription"
    ) as HTMLElement;

    const summary = summaryEditor?.textContent || "";
    const detailed = polishedNote?.textContent || "";
    const raw = rawTranscription?.textContent || "";

    zip.file("resume.txt", summary);
    zip.file("note_detaillee.md", detailed);
    zip.file("transcription_brute.txt", raw);

    if (currentAudioBlob) {
      zip.file("enregistrement.webm", currentAudioBlob);
    }

    const content = await zip.generateAsync({ type: "blob" });
    downloadAsFile(content as any, `${title}.zip`, "application/zip");

    showToast("Archive créée avec succès !");
  } catch (error) {
    console.error("Error creating zip:", error);
    showToast("Erreur lors de la création de l'archive");
  }
}

function showToast(message: string): void {
  const toast = document.createElement("div");
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--color-accent);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    z-index: 10000;
    animation: slideInRight 0.3s ease-out;
  `;
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "slideOutRight 0.3s ease-in forwards";
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

// Initialize application
async function initializeApp(): Promise<void> {
  // Initialize components
  authModal = new AuthModal();
  sessionsList = new SessionsList((session) => {
    loadSessionIntoUI(session);
  });
  pdfList = new PdfList();
  transcriptionProgress = new TranscriptionProgress();

  // Add sessions list to sidebar
  const appContainer = document.getElementById("mainApp") as HTMLElement;
  if (appContainer) {
    document.body.insertBefore(sessionsList.getElement(), appContainer);

    // Add PDF list to sessions list
    const sessionsContent = sessionsList
      .getElement()
      .querySelector(".sessions-content") as HTMLElement;
    if (sessionsContent) {
      sessionsContent.appendChild(pdfList.getElement());
    }
  }

  // Setup tab navigation
  setupTabNavigation();

  // Setup audio playback
  setupAudioPlayback();

  // Check microphone status on load
  await checkMicrophoneStatus();

  // Setup event listeners
  setupEventListeners();

  // Setup auth state listener
  AuthService.onAuthStateChange(async (user) => {
    currentUser = user;

    if (user) {
      authModal.hide();
      await sessionsList.loadSessions();
      await pdfList.loadDocuments();

      // Show app with entrance animation
      const appContainer = document.getElementById("mainApp") as HTMLElement;
      if (appContainer) {
        appContainer.classList.add("app-entrance");
      }
    } else {
      authModal.show();
    }
  });

  // Load saved theme
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light") {
    document.body.classList.add("light-mode");
    const themeButton = document.getElementById(
      "themeToggleButton"
    ) as HTMLButtonElement;
    const icon = themeButton?.querySelector("i") as HTMLElement;
    if (icon) icon.className = "fas fa-moon";
  }

  // Check initial auth state
  const user = await AuthService.getCurrentUser();
  if (!user) {
    authModal.show();
  }
}

function setupEventListeners(): void {
  // Recording button
  const recordButton = document.getElementById(
    "recordButton"
  ) as HTMLButtonElement;
  recordButton?.addEventListener("click", async () => {
    if (!microphoneStatus.available) {
      showMicrophoneHelp();
      return;
    }

    if (mediaRecorder && mediaRecorder.state === "recording") {
      stopRecording();
    } else {
      await startRecording();
    }
  });

  // Duration controls
  const durationInput = document.getElementById(
    "durationInput"
  ) as HTMLInputElement;
  const setDurationButton = document.getElementById(
    "setDurationButton"
  ) as HTMLButtonElement;

  setDurationButton?.addEventListener("click", () => {
    const duration = parseInt(durationInput.value);
    if (duration >= 1 && duration <= 120) {
      recordingDuration = duration;
      maxRecordingTime = duration * 60 * 1000;
      showToast(`Durée définie à ${duration} minute${duration > 1 ? "s" : ""}`);
    }
  });

  // File uploads
  const audioFileUpload = document.getElementById(
    "audioFileUpload"
  ) as HTMLInputElement;
  const uploadAudioButton = document.getElementById(
    "uploadAudioButton"
  ) as HTMLButtonElement;

  uploadAudioButton?.addEventListener("click", () => {
    audioFileUpload.click();
  });

  audioFileUpload?.addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      handleAudioUpload(file);
    }
  });

  const pdfFileUpload = document.getElementById(
    "pdfFileUpload"
  ) as HTMLInputElement;
  const uploadPdfButton = document.getElementById(
    "uploadPdfButton"
  ) as HTMLButtonElement;

  uploadPdfButton?.addEventListener("click", () => {
    pdfFileUpload.click();
  });

  pdfFileUpload?.addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      handlePdfUpload(file);
    }
  });

  // Action buttons
  const themeToggleButton = document.getElementById(
    "themeToggleButton"
  ) as HTMLButtonElement;
  themeToggleButton?.addEventListener("click", toggleTheme);

  const newButton = document.getElementById("newButton") as HTMLButtonElement;
  newButton?.addEventListener("click", clearCurrentNote);

  const logoutButton = document.getElementById(
    "logoutButton"
  ) as HTMLButtonElement;
  logoutButton?.addEventListener("click", async () => {
    await AuthService.signOut();
    clearCurrentNote();
  });

  // Copy buttons
  const copyRawButton = document.getElementById(
    "copyRawTranscriptionButton"
  ) as HTMLButtonElement;
  copyRawButton?.addEventListener("click", () => {
    const rawContent = document.getElementById(
      "rawTranscription"
    ) as HTMLElement;
    if (rawContent) {
      copyToClipboard(rawContent.textContent || "");
    }
  });

  const copySummaryButton = document.getElementById(
    "copySummaryButton"
  ) as HTMLButtonElement;
  copySummaryButton?.addEventListener("click", () => {
    const summaryContent = document.getElementById(
      "summaryEditor"
    ) as HTMLElement;
    if (summaryContent) {
      copyToClipboard(summaryContent.textContent || "");
    }
  });

  const copyDetailedButton = document.getElementById(
    "copyDetailedNoteButton"
  ) as HTMLButtonElement;
  copyDetailedButton?.addEventListener("click", () => {
    const detailedContent = document.getElementById(
      "polishedNote"
    ) as HTMLElement;
    if (detailedContent) {
      copyToClipboard(detailedContent.textContent || "");
    }
  });

  // Save buttons
  const saveSummaryButton = document.getElementById(
    "saveSummaryButton"
  ) as HTMLButtonElement;
  saveSummaryButton?.addEventListener("click", () => {
    const summaryContent = document.getElementById(
      "summaryEditor"
    ) as HTMLElement;
    const titleElement = document.querySelector(".editor-title") as HTMLElement;
    const title = titleElement?.textContent || "Untitled Note";

    if (summaryContent) {
      downloadAsFile(summaryContent.textContent || "", `${title}_resume.txt`);
    }
  });

  const saveDetailedButton = document.getElementById(
    "saveDetailedNoteButton"
  ) as HTMLButtonElement;
  saveDetailedButton?.addEventListener("click", () => {
    const detailedContent = document.getElementById(
      "polishedNote"
    ) as HTMLElement;
    const titleElement = document.querySelector(".editor-title") as HTMLElement;
    const title = titleElement?.textContent || "Untitled Note";

    if (detailedContent) {
      downloadAsFile(
        detailedContent.textContent || "",
        `${title}_note_detaillee.md`,
        "text/markdown"
      );
    }
  });

  const saveAllButton = document.getElementById(
    "saveAllButton"
  ) as HTMLButtonElement;
  saveAllButton?.addEventListener("click", saveAllAsZip);

  // Refresh buttons
  const refreshAllButton = document.getElementById(
    "refreshAllButton"
  ) as HTMLButtonElement;
  refreshAllButton?.addEventListener("click", async () => {
    if (!currentSessionId) return;

    const rawContent = document.getElementById(
      "rawTranscription"
    ) as HTMLElement;
    const transcription = rawContent?.textContent || "";

    if (!transcription) {
      showToast("Aucune transcription à traiter");
      return;
    }

    transcriptionProgress.show();

    try {
      transcriptionProgress.setStep(0, "Génération du titre...");
      const title = await generateTitle(transcription);

      transcriptionProgress.setStep(1, "Création du résumé...");
      const summary = await generateSummary(transcription);

      transcriptionProgress.setStep(2, "Rédaction de la note détaillée...");
      const detailedNote = await generateDetailedNote(transcription);

      // Update UI
      const titleElement = document.querySelector(
        ".editor-title"
      ) as HTMLElement;
      const summaryEditor = document.getElementById(
        "summaryEditor"
      ) as HTMLElement;
      const polishedNote = document.getElementById(
        "polishedNote"
      ) as HTMLElement;

      if (titleElement) titleElement.textContent = title;
      if (summaryEditor) summaryEditor.innerHTML = marked.parse(summary);
      if (polishedNote) polishedNote.innerHTML = marked.parse(detailedNote);

      // Update database
      await DatabaseService.updateSession(currentSessionId, {
        title,
        summary,
        detailed_note: detailedNote,
      });

      await sessionsList.loadSessions();
      transcriptionProgress.setSuccess("Contenu régénéré avec succès");
    } catch (error) {
      console.error("Error refreshing content:", error);
      transcriptionProgress.setError("Erreur lors de la régénération");
    }
  });

  const refreshNoteButton = document.getElementById(
    "refreshNoteFromSummaryButton"
  ) as HTMLButtonElement;
  refreshNoteButton?.addEventListener("click", async () => {
    if (!currentSessionId) return;

    const summaryContent = document.getElementById(
      "summaryEditor"
    ) as HTMLElement;
    const summary = summaryContent?.textContent || "";

    if (!summary) {
      showToast("Aucun résumé à traiter");
      return;
    }

    transcriptionProgress.show();

    try {
      transcriptionProgress.setStep(
        0,
        "Rédaction de la note détaillée à partir du résumé..."
      );
      const detailedNote = await generateDetailedNote(summary);

      const polishedNote = document.getElementById(
        "polishedNote"
      ) as HTMLElement;
      if (polishedNote) {
        polishedNote.innerHTML = marked.parse(detailedNote);
      }

      await DatabaseService.updateSession(currentSessionId, {
        detailed_note: detailedNote,
      });

      transcriptionProgress.setSuccess("Note détaillée mise à jour");
    } catch (error) {
      console.error("Error refreshing note:", error);
      transcriptionProgress.setError("Erreur lors de la mise à jour");
    }
  });

  // Search functionality
  const searchInput = sessionsList
    .getElement()
    .querySelector("#sessionSearchInput") as HTMLInputElement;
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const searchTerm = (e.target as HTMLInputElement).value;
      pdfList.filterDocuments(searchTerm);
    });
  }
}

//const openContactsBtn = document.getElementById('openContactModal');
//openContactsBtn?.addEventListener('click', () => {
// if (!currentUser) {
//   alert('Veuillez vous connecter');
//   return;
// }
// renderContactModal(currentUser.id);
//});

// Add CSS animations
const style = document.createElement("style");
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);
// Fonction générique pour afficher un message dans une popup simple

// Configuration des services de traduction
const TRANSLATION_SERVICE = {
  DEEPSEEK: "deepseek",
  LIBRE_TRANSLATE: "libre", // Alternative open-source
  FALLBACK: "libre", // Service de repli
};

// Fonction de traduction améliorée avec fallback
async function translateText(text, targetLanguage, sourceLanguage = "fr") {
  const apiKey = import.meta.env.VITE_API_DEEPSEEK_API_KEY;
  const translationService = apiKey
    ? TRANSLATION_SERVICE.DEEPSEEK
    : TRANSLATION_SERVICE.FALLBACK;

  try {
    if (translationService === TRANSLATION_SERVICE.DEEPSEEK) {
      return await translateWithDeepSeek(text, targetLanguage);
    } else {
      return await translateWithLibreTranslate(
        text,
        targetLanguage,
        sourceLanguage
      );
    }
  } catch (error) {
    console.error(
      "Échec de la traduction principale, utilisation du fallback:",
      error
    );
    return await translateWithLibreTranslate(
      text,
      targetLanguage,
      sourceLanguage
    );
  }
}

// Traduction via DeepSeek (adaptée à l'API réelle)
async function translateWithDeepSeek(text, targetLanguage) {
  const apiKey = import.meta.env.VITE_API_DEEPSEEK_API_KEY;
  const apiUrl = "https://api.deepseek.com/v1/chat/completions";

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        {
          role: "user",
          content: `Translate this to ${targetLanguage}: ${text}`,
        },
      ],
    }),
  });

  const rawResponse = await response.text();
  console.log("Raw API Response:", rawResponse);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${rawResponse}`);
  }

  if (!rawResponse.trim()) {
    throw new Error("Empty API response");
  }

  const json = JSON.parse(rawResponse);
  const translatedText = json.choices?.[0]?.message?.content;

  if (!translatedText) {
    throw new Error("Traduction introuvable dans la réponse DeepSeek");
  }

  return translatedText;
}

// Placeholder pour la fonction de traduction LibreTranslate, à adapter si tu l'utilises
async function translateWithLibreTranslate(
  text,
  targetLanguage,
  sourceLanguage = "fr"
) {
  // Implémentation selon l'API LibreTranslate
  // Par exemple :
  /*
  const response = await fetch('https://libretranslate.de/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source: sourceLanguage,
      target: targetLanguage,
      format: "text"
    })
  });
  if (!response.ok) throw new Error('Erreur traduction LibreTranslate');
  const data = await response.json();
  return data.translatedText;
  */
  throw new Error("translateWithLibreTranslate non implémentée");
}

// Récupération des contacts depuis Supabase
async function fetchContacts() {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Utilisateur non connecté");

  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("email, nom, prenom")
    .eq("user_id", user.id);

  if (error || !contacts) throw new Error("Erreur de chargement des contacts");
  if (contacts.length === 0) throw new Error("Aucun contact enregistré");

  return contacts;
}

// Envoi du résumé aux contacts sélectionnés
async function sendSummaryToContacts(
  sessionId,
  selectedEmails,
  targetLanguage = "fr"
) {
  if (
    !sessionId ||
    !Array.isArray(selectedEmails) ||
    selectedEmails.length === 0
  ) {
    showMessage("Session invalide ou aucun contact sélectionné.", "error");
    return;
  }

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Utilisateur non connecté");

    const { data: session, error: sessionError } = await supabase
      .from("dictation_sessions")
      .select("summary")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) throw new Error("Session introuvable.");
    if (!session.summary || session.summary.trim() === "")
      throw new Error("Résumé vide.");

    let summaryToSend = session.summary;

    // Traduction automatique si nécessaire
    if (targetLanguage !== "fr") {
      summaryToSend = await translateText(summaryToSend, targetLanguage);
    }

    const texts = {
      fr: {
        subject: "Résumé de votre dictée",
        greeting: "Bonjour,",
        intro:
          "Veuillez trouver ci-dessous le résumé généré automatiquement suite à votre dictée :",
        thanks:
          "Nous vous remercions d’avoir utilisé <strong>DictateAI</strong>.",
        closing: "Bien cordialement,",
        signatureNote: "Ce message a été généré automatiquement.",
      },
      en: {
        subject: "Your Dictation Summary",
        greeting: "Hello,",
        intro:
          "Please find below the automatically generated summary of your dictation:",
        thanks: "Thank you for using <strong>DictateAI</strong>.",
        closing: "Best regards,",
        signatureNote: "This message was generated automatically.",
      },
      de: {
        subject: "Zusammenfassung Ihres Diktats",
        greeting: "Hallo,",
        intro:
          "Nachfolgend finden Sie die automatisch generierte Zusammenfassung Ihres Diktats:",
        thanks: "Vielen Dank für die Nutzung von <strong>DictateAI</strong>.",
        closing: "Mit freundlichen Grüßen,",
        signatureNote: "Diese Nachricht wurde automatisch generiert.",
      },
      es: {
        subject: "Resumen de su dictado",
        greeting: "Hola,",
        intro:
          "A continuación encontrará el resumen generado automáticamente de su dictado:",
        thanks: "Gracias por utilizar <strong>DictateAI</strong>.",
        closing: "Atentamente,",
        signatureNote: "Este mensaje fue generado automáticamente.",
      },
      it: {
        subject: "Riepilogo del tuo dettato",
        greeting: "Ciao,",
        intro:
          "Di seguito trovi il riepilogo generato automaticamente del tuo dettato:",
        thanks: "Grazie per aver utilizzato <strong>DictateAI</strong>.",
        closing: "Cordiali saluti,",
        signatureNote: "Questo messaggio è stato generato automaticamente.",
      },
    };

    const t = texts[targetLanguage] || texts.fr;

    const signature = `
      <div style="border-top:1px solid #ddd; margin-top:20px; padding-top:10px; font-size: 14px; color: #555;">
        <p style="margin: 0;">${t.closing}</p>
        <p style="margin: 0;"><strong>Equipe AMG</strong></p>
        <p style="margin: 0;">Application <strong>DictateAI</strong></p>
        
        <p style="margin: 0;"><em>${t.signatureNote}</em></p>
      </div>
    `;

    const apiKey = import.meta.env.VITE_API_BREVO;
    const senderEmail = "fatmakamg@gmail.com";
    const recipients = new Set([...selectedEmails, user.email]);

    for (const email of recipients) {
      const payload = {
        sender: { name: "DictateAI", email: senderEmail },
        to: [{ email }],
        subject: t.subject,
        htmlContent: `
          <div style="font-family: 'Segoe UI', Roboto, sans-serif; font-size: 16px; color: #333; line-height: 1.6;">
            <h2 style="color: #3b82f6;">${t.subject}</h2>
            <p>${t.greeting}</p>
            <p>${t.intro}</p>
            <div style="background-color: #f9f9f9; padding: 1rem; border-left: 4px solid #3b82f6; margin: 1rem 0;">
              ${summaryToSend}
            </div>
            <p>${t.thanks}</p>
            ${signature}
          </div>
        `,
      };

      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Échec d'envoi à ${email} :`, errorData);
        throw new Error(`Échec d'envoi à ${email}`);
      }
    }

    showMessage(
      "Résumé envoyé avec succès aux contacts sélectionnés et à vous.",
      "success"
    );
  } catch (error) {
    console.error("Erreur d'envoi :", error);
    showMessage(
      error.message || "Erreur inconnue lors de l’envoi des emails.",
      "error"
    );
  }
}

// 3. Ouverture du popup avec recherche, sélection, sélection langue, envoi, fermeture externe
async function openContactSelectionPopup(sessionId) {
  let contacts;
  try {
    contacts = await fetchContacts();
  } catch (err) {
    showMessage(err.message, "error");
    return;
  }

  const isLight = document.body.classList.contains("light-mode");

  // Overlay
  const overlay = document.createElement("div");
  overlay.id = "summaryPopupOverlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100vw";
  overlay.style.height = "100vh";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.6)";
  overlay.style.display = "flex";
  overlay.style.justifyContent = "center";
  overlay.style.alignItems = "center";
  overlay.style.zIndex = "9999";

  // Modal
  const modal = document.createElement("div");
  modal.id = "summaryPopupModal";
  modal.style.background = isLight
    ? "var(--color-surface-light)"
    : "var(--color-surface-dark)";
  modal.style.color = isLight
    ? "var(--color-text-light)"
    : "var(--color-text-dark)";
  modal.style.padding = "24px";
  modal.style.borderRadius = "12px";
  modal.style.boxShadow = isLight ? "var(--shadow-md)" : "var(--shadow-lg)";
  modal.style.border = `1px solid ${
    isLight ? "var(--color-border-light)" : "var(--color-border-dark)"
  }`;
  modal.style.maxWidth = "500px";
  modal.style.width = "90%";

  modal.innerHTML = `
    <h2 style="margin-top: 0;"> Contacts</h2>
    <p style="margin-bottom: 1rem;">Choisissez les destinataires du résumé :</p>

    <label for="languageSelect" style="display: block; margin-bottom: 4px;">Langue de traduction :</label>
    <select id="languageSelect" style="
      width: 100%;
      margin-bottom: 16px;
      padding: 8px;
      background: ${isLight ? "var(--color-bg-light)" : "var(--color-bg-dark)"};
      color: ${isLight ? "var(--color-text-light)" : "var(--color-text-dark)"};
      border: 1px solid ${
        isLight ? "var(--color-border-light)" : "var(--color-border-dark)"
      };
      border-radius: 6px;
    ">
      <option value="fr" selected>Français</option>
      <option value="en">English</option>
      <option value="es">Español</option>
      <option value="de">Deutsch</option>
      <option value="it">Italiano</option>
    </select>

    <input type="search" id="contactSearchInput" placeholder="Rechercher un contact..." style="
      width: 100%;
      padding: 8px;
      margin-bottom: 16px;
      border-radius: 6px;
      border: 1px solid ${
        isLight ? "var(--color-border-light)" : "var(--color-border-dark)"
      };
      background: ${isLight ? "var(--color-bg-light)" : "var(--color-bg-dark)"};
      color: ${isLight ? "var(--color-text-light)" : "var(--color-text-dark)"};
    ">

    <ul id="contactsList" style="
      list-style: none;
      padding: 0;
      max-height: 200px;
      overflow-y: auto;
      margin-bottom: 16px;
    "></ul>

    <div style="text-align: right;">
      <button id="cancelSendSummaryBtn" style="
        margin-right: 8px;
        padding: 6px 12px;
        border: none;
        border-radius: 6px;
        background-color: ${isLight ? "#ccc" : "#555"};
        color: ${isLight ? "#000" : "#fff"};
        cursor: pointer;
      ">Annuler</button>
      <button id="confirmSendSummaryBtn" style="
        padding: 6px 12px;
        border: none;
        border-radius: 6px;
        background-color: ${
          isLight ? "var(--color-accent-light)" : "var(--color-accent-dark)"
        };
        color: white;
        cursor: pointer;
      ">Envoyer</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const contactsListEl = modal.querySelector("#contactsList");
  const searchInput = modal.querySelector("#contactSearchInput");
  const languageSelect = modal.querySelector("#languageSelect");

  function renderContactsList(filter = "") {
    const filtered = contacts.filter(
      (c) =>
        `${c.prenom} ${c.nom}`.toLowerCase().includes(filter.toLowerCase()) ||
        c.email.toLowerCase().includes(filter.toLowerCase())
    );

    contactsListEl.innerHTML = filtered
      .map(
        (c) =>
          `<li style="margin-bottom: 8px;">
        <label style="cursor: pointer;">
          <input type="checkbox" class="popup-contact-checkbox" value="${
            c.email
          }" style="margin-right: 8px;">
          <strong>${c.prenom} ${c.nom}</strong> <span style="color: ${
            isLight ? "#666" : "#aaa"
          };">(${c.email})</span>
        </label>
      </li>`
      )
      .join("");
  }

  renderContactsList();

  searchInput.addEventListener("input", (e) => {
    renderContactsList(e.target.value);
  });

  const closePopup = () => {
    document.body.removeChild(overlay);
    document.removeEventListener("keydown", escCloseHandler);
  };

  document
    .getElementById("cancelSendSummaryBtn")
    .addEventListener("click", closePopup);

  document
    .getElementById("confirmSendSummaryBtn")
    .addEventListener("click", async () => {
      const checkedBoxes = modal.querySelectorAll(
        ".popup-contact-checkbox:checked"
      );
      const selectedEmails = Array.from(checkedBoxes).map((cb) => cb.value);

      if (selectedEmails.length === 0) {
        showMessage("Veuillez sélectionner au moins un contact.", "error");
        return;
      }

      const selectedLanguage = languageSelect.value || "fr";

      try {
        await sendSummaryToContacts(
          sessionId,
          selectedEmails,
          selectedLanguage
        );
        closePopup();
        showMessage("Résumé envoyé avec succès.", "success");
      } catch (error) {
        console.error(error);
        showMessage(error.message || "Erreur lors de l’envoi.", "error");
      }
    });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closePopup();
  });

  const escCloseHandler = (e) => {
    if (e.key === "Escape") closePopup();
  };
  document.addEventListener("keydown", escCloseHandler);
}

// 4. Bouton principal pour ouvrir le popup
document.addEventListener("DOMContentLoaded", initializeApp);
document.addEventListener("DOMContentLoaded", () => {
  const sendBtn = document.getElementById("sendSummaryBtn");
  if (!sendBtn) {
    console.error("Bouton 'sendSummaryBtn' introuvable");
    return;
  }

  sendBtn.addEventListener("click", () => {
    const sessionId =
      window.currentSessionId || localStorage.getItem("currentSessionId");

    if (!sessionId) {
      alert("Aucune session active.");
      return;
    }

    openContactSelectionPopup(sessionId);
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const toggleBtn = document.getElementById("userMenuToggle");
  const dropdown = document.getElementById("userDropdown");

  if (toggleBtn && dropdown) {
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // empêche la fermeture immédiate
      dropdown.classList.toggle("hidden"); // toggle affichage
    });

    document.addEventListener("click", (e) => {
      if (
        !toggleBtn.contains(e.target as Node) &&
        !dropdown.contains(e.target as Node)
      ) {
        dropdown.classList.add("hidden"); // cacher si clic en dehors
      }
    });
  }

  const logoutButton = document.getElementById("logoutButton");
  logoutButton?.addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();
    if (error) alert("Erreur déconnexion");
    else window.location.href = "/login.html";
  });
});
